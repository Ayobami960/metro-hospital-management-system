import { Users, Calendar, Star, TrendingUp, Pill, CheckCircle, XCircle, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";

import { useDoctorDashboard } from "@/hooks/dashboards/dashboard.hooks";
import { useApproveAppointment, useCancelAppointment } from "@/hooks/appointments/appointments.hooks";
import { InlineEmpty, QueryError, QueryLoading } from "@/components/globals/query-state";
import { compactMoney, formatDate, formatTime, label as toLabel } from "@/lib/format";
import { errorMessage } from "@/services/api/api-error";

const statusClass: Record<string, string> = {
  COMPLETED: "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400",
  CHECKED_IN: "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400",
  IN_PROGRESS: "bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400",
  SCHEDULED: "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400",
  CONFIRMED: "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400",
  REQUESTED: "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400",
  CANCELLED: "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400",
  NO_SHOW: "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400",
  URGENT: "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400",
  STAT: "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400",
  ROUTINE: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
};

const DIAGNOSIS_COLORS = ["#2563eb", "#7c3aed", "#dc2626", "#d97706", "#94a3b8", "#0891b2"];

function Badge({ status }: { status: string }) {
  const cls = statusClass[status] ?? statusClass.ROUTINE;
  return (
    <span className={cn("text-[11px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap", cls)}>
      {toLabel(status)}
    </span>
  );
}

export default function DoctorDashboard() {
  const { data, isLoading, isError, error, refetch } = useDoctorDashboard();
  const approve = useApproveAppointment();
  const cancel = useCancelAppointment();

  if (isLoading) {
    return (
      <div className="p-6">
        <QueryLoading text="Loading your clinic day…" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-6">
        <QueryError error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  const { stats } = data;
  const statCards = [
    {
      label: "Today's Appointments",
      value: String(stats.todayAppointments),
      sub: `${stats.uniquePatientsToday} unique patients`,
      icon: Calendar,
      color: "text-blue-600",
      bg: "bg-blue-100 dark:bg-blue-950",
    },
    {
      label: "Completed Today",
      value: String(stats.completedToday),
      sub: `${stats.pendingLabOrders} lab orders pending`,
      icon: CheckCircle,
      color: "text-green-600",
      bg: "bg-green-100 dark:bg-green-950",
    },
    {
      label: "Active Prescriptions",
      value: String(stats.activePrescriptions),
      sub: "Across your panel",
      icon: Pill,
      color: "text-violet-600",
      bg: "bg-violet-100 dark:bg-violet-950",
    },
    {
      label: "Patient Rating",
      value: stats.rating === null ? "—" : stats.rating.toFixed(1),
      sub: `${stats.ratingCount} reviews`,
      icon: Star,
      color: "text-amber-600",
      bg: "bg-amber-100 dark:bg-amber-950",
    },
  ];

  const revenueData =
    stats.monthRevenueMinor > 0 ? [{ month: "This month", revenue: stats.monthRevenueMinor / 100 }] : [];
  const apptData = data.appointmentSeries.map((row) => ({
    day: row.day,
    completed: row.appointments,
    cancelled: 0,
  }));
  const diagnosisData = data.diagnosisDistribution.map((row, i) => ({
    name: row.name,
    value: row.value,
    color: DIAGNOSIS_COLORS[i % DIAGNOSIS_COLORS.length],
  }));

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-foreground mb-1">Good morning, Doctor 🩺</h1>
        <p className="text-sm text-muted-foreground">
          {formatDate(data.generatedAt)} · You have{" "}
          <strong className="text-blue-600">{stats.todayAppointments} appointments</strong> scheduled today
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-card border border-border rounded-2xl p-5 flex gap-3.5 items-start card-shadow">
              <div className={cn("w-[46px] h-[46px] rounded-[14px] flex items-center justify-center shrink-0", s.bg)}>
                <Icon size={20} className={s.color} />
              </div>
              <div>
                <div className="text-[22px] font-extrabold text-foreground">{s.value}</div>
                <div className="text-xs text-muted-foreground mb-0.5">{s.label}</div>
                <div className={cn("text-[11px] font-semibold", s.color)}>{s.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Today's Schedule */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-5 card-shadow">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-bold text-foreground">Today's Schedule</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{formatDate(data.generatedAt)}</span>
            <a href="/doctor/appointments" className="text-xs text-blue-600 font-semibold cursor-pointer bg-transparent border-none">
              View Calendar
            </a>
          </div>
        </div>
        <div className="flex flex-col">
          {data.todayPatients.length === 0 && <InlineEmpty text="No appointments scheduled today." />}
          {data.todayPatients.map((p, i) => (
            <div
              key={p.appointmentId}
              className={`flex items-center gap-4 py-3.5 ${i < data.todayPatients.length - 1 ? "border-b border-border" : ""}`}
            >
              <div className="w-14 text-center">
                <div className="text-[13px] font-bold text-blue-600">{formatTime(p.at)}</div>
              </div>
              <div className="w-[42px] h-[42px] rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-[13px] font-bold text-blue-600 dark:text-blue-400 shrink-0">
                {p.name.split(" ").map((n) => n[0]).join("")}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-bold text-foreground">{p.name}</span>
                  <span className="text-xs text-muted-foreground">· {p.age} yrs · {p.mrn}</span>
                  <Badge status={p.priority} />
                </div>
                <div className="text-xs text-muted-foreground">{p.reason ?? "No reason recorded"}</div>
              </div>
              <div className="flex items-center gap-2.5">
                <Badge status={p.status} />
                <span
                  className={cn(
                    "text-[11px] px-2 py-0.5 rounded-md font-semibold flex items-center gap-1",
                    p.mode === "VIRTUAL"
                      ? "bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
                  )}
                >
                  {p.mode === "VIRTUAL" && <Video size={10} />}
                  {toLabel(p.mode)}
                </span>
                <a
                  href={`/doctor/emr?patientId=${p.patientId}`}
                  className="px-3.5 py-[7px] bg-blue-600 text-white border-none rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Open Chart
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
        <div className="bg-card border border-border rounded-2xl p-5 card-shadow">
          <h3 className="text-base font-bold text-foreground mb-4">Weekly Appointments</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={apptData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="completed" fill="#2563eb" radius={[4, 4, 0, 0]} name="Appointments" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 card-shadow">
          <h3 className="text-base font-bold text-foreground mb-4">Common Diagnoses</h3>
          {diagnosisData.length === 0 ? (
            <InlineEmpty text="No diagnoses recorded yet." />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={diagnosisData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value">
                    {diagnosisData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-1.5 mt-2">
                {diagnosisData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="flex-1 text-foreground">{d.name}</span>
                    <span className="text-muted-foreground font-mono">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 card-shadow">
          <h3 className="text-base font-bold text-foreground mb-4">Revenue (This month)</h3>
          <div className="flex items-center justify-center h-[180px] flex-col gap-2">
            <div className="text-3xl font-extrabold text-foreground">{compactMoney(stats.monthRevenueMinor)}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp size={12} /> Billed to your patients this month
            </div>
            {revenueData.length > 0 && (
              <ResponsiveContainer width="100%" height={60}>
                <AreaChart data={revenueData}>
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} formatter={(v: unknown) => [`$${Number(v).toLocaleString()}`, "Revenue"]} />
                  <Area type="monotone" dataKey="revenue" stroke="#7c3aed" strokeWidth={2.5} fill="#ede9fe" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Pending Requests */}
        <div className="bg-card border border-border rounded-2xl p-5 card-shadow">
          <h3 className="text-base font-bold text-foreground mb-4">Pending Appointment Requests</h3>
          <div className="flex flex-col gap-3">
            {data.pendingRequests.length === 0 && <InlineEmpty text="No pending requests." />}
            {data.pendingRequests.map((req) => (
              <div key={req.id} className="flex items-center gap-3 p-3.5 bg-muted rounded-xl">
                <div className="w-[38px] h-[38px] rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-400 shrink-0">
                  {req.patientName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-bold text-foreground">{req.patientName}</div>
                  <div className="text-xs text-muted-foreground">
                    {req.reason ?? "No reason given"} · {formatDate(req.requestedFor)} · {toLabel(req.mode)}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {req.status === "REQUESTED" ? (
                    <>
                      <button
                        onClick={() =>
                          approve.mutate(req.id, {
                            onSuccess: () => toast.success("Appointment approved"),
                            onError: (approveError) =>
                              toast.error(errorMessage(approveError, "Could not approve.")),
                          })
                        }
                        disabled={approve.isPending}
                        className="px-2.5 py-1.5 bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400 border-none rounded-lg cursor-pointer flex items-center gap-1 text-xs font-semibold disabled:opacity-60"
                      >
                        <CheckCircle size={13} /> Accept
                      </button>
                      <button
                        onClick={() =>
                          cancel.mutate(
                            { appointmentId: req.id, reason: "Declined by doctor" },
                            {
                              onSuccess: () => toast.success("Request declined"),
                              onError: (cancelError) =>
                                toast.error(errorMessage(cancelError, "Could not decline.")),
                            },
                          )
                        }
                        disabled={cancel.isPending}
                        className="px-2.5 py-1.5 bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 border-none rounded-lg cursor-pointer flex items-center gap-1 text-xs font-semibold disabled:opacity-60"
                      >
                        <XCircle size={13} /> Decline
                      </button>
                    </>
                  ) : (
                    <Badge status={req.status} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Prescriptions */}
        <div className="bg-card border border-border rounded-2xl p-5 card-shadow">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-bold text-foreground">Recent Prescriptions</h3>
            <a href="/doctor/prescriptions" className="text-[13px] text-blue-600 bg-transparent border-none cursor-pointer font-semibold">
              + New Rx
            </a>
          </div>
          <div className="flex flex-col gap-2.5">
            {data.recentPrescriptions.length === 0 && <InlineEmpty text="No prescriptions issued yet." />}
            {data.recentPrescriptions.map((rx) => (
              <div key={rx.id} className="flex items-center gap-3 p-3.5 bg-muted rounded-xl">
                <div className="w-9 h-9 rounded-[10px] bg-purple-100 dark:bg-purple-950 flex items-center justify-center">
                  <Pill size={16} className="text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-bold text-foreground">
                    {rx.drugNames.join(", ") || "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">For {rx.patientName} · {formatDate(rx.createdAt)}</div>
                </div>
                <Badge status={rx.status} />
              </div>
            ))}
            <a href="/doctor/prescriptions" className="w-full py-2.5 bg-muted text-foreground border border-dashed border-border rounded-[10px] text-[13px] font-semibold cursor-pointer mt-1 text-center">
              View All Prescriptions
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
