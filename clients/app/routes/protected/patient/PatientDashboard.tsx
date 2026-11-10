import { useState } from "react";
import {
  Calendar,
  Pill,
  FlaskConical,
  CreditCard,
  Activity,
  Heart,
  AlertTriangle,
  MessageSquare,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { usePatientDashboard } from "@/hooks/dashboards/dashboard.hooks";
import { useSession } from "@/hooks/auth/use-session";
import { QueryError, QueryLoading, InlineEmpty } from "@/components/globals/query-state";
import { formatDate, formatTime, label as toLabel, money, relativeTime } from "@/lib/format";

const statusClass: Record<string, string> = {
  CONFIRMED: "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400",
  SCHEDULED: "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400",
  REQUESTED: "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400",
  SIGNED: "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400",
  SENT: "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400",
  DISPENSED: "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400",
  EXPIRED: "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400",
  CANCELLED: "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400",
};

function Badge({ status }: { status: string }) {
  const cls = statusClass[status] ?? "bg-muted text-muted-foreground";
  return <span className={cn("text-[11px] font-bold px-2.5 py-0.5 rounded-full", cls)}>{toLabel(status)}</span>;
}

const QUICK_ACTIONS = [
  { label: "Book Appointment", icon: Calendar, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-950", href: "/patient/appointments" },
  { label: "Request Prescription Refill", icon: Pill, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-100 dark:bg-violet-950", href: "/patient/prescriptions" },
  { label: "View Lab Results", icon: FlaskConical, color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-100 dark:bg-cyan-950", href: "/patient/lab-results" },
  { label: "Pay Bill", icon: CreditCard, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-950", href: "/patient/bills" },
  { label: "Message Care Team", icon: MessageSquare, color: "text-green-600 dark:text-green-400", bg: "bg-green-100 dark:bg-green-950", href: "/patient/messages" },
  { label: "Upload Document", icon: Upload, color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-100 dark:bg-slate-800", href: "/patient/medical-records" },
];

export default function PatientDashboard() {
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);
  const dashboard = usePatientDashboard();
  const { data: session } = useSession();

  if (dashboard.isLoading) {
    return (
      <div className="p-6">
        <QueryLoading text="Loading your health summary…" />
      </div>
    );
  }

  if (dashboard.isError || !dashboard.data) {
    return (
      <div className="p-6">
        <QueryError error={dashboard.error} onRetry={() => void dashboard.refetch()} />
      </div>
    );
  }

  const { stats, upcomingAppointments, prescriptions, labResults, bpSeries, weightSeries, allergies, careTeam } =
    dashboard.data;
  const nextAppointment = upcomingAppointments[0] ?? null;
  const latestWeight = weightSeries[weightSeries.length - 1]?.weight ?? null;
  const flaggedLab = labResults.find((result) => result.flag && result.flag !== "NORMAL");

  const statCards = [
    { label: "Upcoming Appointments", value: String(stats.upcomingAppointments), icon: Calendar, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-950" },
    { label: "Active Prescriptions", value: String(stats.activePrescriptions), icon: Pill, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-100 dark:bg-violet-950" },
    { label: "Lab Results Ready", value: String(stats.releasedLabResults), icon: FlaskConical, color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-100 dark:bg-cyan-950" },
    { label: "Outstanding Balance", value: money(stats.outstandingBalanceMinor), icon: CreditCard, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-950" },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-foreground mb-1">
          Good morning, {session?.name?.split(" ")[0] ?? "there"} 👋
        </h1>
        <p className="text-sm text-muted-foreground">
          {formatDate(new Date())}
          {nextAppointment ? (
            <>
              {" "}· Your next appointment is{" "}
              <strong className="text-blue-600">
                {formatDate(nextAppointment.at)} at {formatTime(nextAppointment.at)}
              </strong>
            </>
          ) : (
            " · No upcoming appointments"
          )}
          {careTeam?.doctorName ? ` · Care team: ${careTeam.doctorName}` : ""}
        </p>
      </div>

      {/* Alert */}
      {flaggedLab && (
        <div className="flex items-center gap-3 bg-yellow-50 dark:bg-yellow-950/30 border-[1.5px] border-yellow-200 dark:border-yellow-800 rounded-xl py-3 px-4 mb-6">
          <AlertTriangle size={18} className="text-yellow-600 dark:text-yellow-400 shrink-0" />
          <div className="flex-1">
            <span className="text-[13px] font-bold text-yellow-800 dark:text-yellow-300">Action Required: </span>
            <span className="text-[13px] text-yellow-800 dark:text-yellow-400">
              Your {flaggedLab.testName} result is flagged ({flaggedLab.valueText ?? toLabel(flaggedLab.flag ?? "")}{" "}
              {flaggedLab.unit ?? ""}). Contact your care team for a follow-up.
            </span>
            <a href="/patient/messages" className="text-[13px] text-blue-600 bg-transparent font-bold underline ml-1">
              Message Now
            </a>
          </div>
        </div>
      )}

      {allergies.length > 0 && (
        <div className="flex items-center gap-3 bg-red-50 dark:bg-red-950/30 border-[1.5px] border-red-200 dark:border-red-800 rounded-xl py-3 px-4 mb-6">
          <AlertTriangle size={18} className="text-red-600 dark:text-red-400 shrink-0" />
          <div className="text-[13px] text-red-800 dark:text-red-400">
            <span className="font-bold">Allergies on file: </span>
            {allergies.join(", ")}
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-card border border-border rounded-2xl p-5 flex items-center gap-3.5 card-shadow">
              <div className={cn("w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0", card.bg)}>
                <Icon size={22} className={card.color} />
              </div>
              <div>
                <div className="text-2xl font-extrabold text-foreground">{card.value}</div>
                <div className="text-xs text-muted-foreground">{card.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* BP Chart */}
        <div className="bg-card border border-border rounded-2xl p-5 card-shadow">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-bold text-foreground">Blood Pressure History</h3>
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-[3px] rounded-sm bg-blue-600 inline-block" />
                Systolic
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-[3px] rounded-sm bg-purple-600 inline-block" />
                Diastolic
              </span>
            </div>
          </div>
          {bpSeries.length === 0 ? (
            <InlineEmpty text="No blood pressure readings recorded yet." />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={bpSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="systolic" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="diastolic" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Weight Chart */}
        <div className="bg-card border border-border rounded-2xl p-5 card-shadow">
          <h3 className="text-base font-bold text-foreground mb-4">Weight Trend (kg)</h3>
          {weightSeries.length === 0 ? (
            <InlineEmpty text="No weight measurements recorded yet." />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={weightSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="weight" stroke="#16a34a" strokeWidth={2.5} fill="#dcfce7" />
              </AreaChart>
            </ResponsiveContainer>
          )}
          <div className="flex justify-between mt-3 p-2.5 bg-muted rounded-[10px]">
            <div className="text-center">
              <div className="text-base font-extrabold text-green-600">
                {weightSeries.length > 1 ? `${(weightSeries[weightSeries.length - 1].weight - weightSeries[0].weight).toFixed(1)} kg` : "—"}
              </div>
              <div className="text-[11px] text-muted-foreground">Change recorded</div>
            </div>
            <div className="text-center">
              <div className="text-base font-extrabold text-foreground">{latestWeight != null ? `${latestWeight} kg` : "—"}</div>
              <div className="text-[11px] text-muted-foreground">Current</div>
            </div>
            <div className="text-center">
              <div className="text-base font-extrabold text-blue-600">
                {stats.lastVisitAt ? formatDate(stats.lastVisitAt) : "—"}
              </div>
              <div className="text-[11px] text-muted-foreground">Last visit</div>
            </div>
          </div>
        </div>
      </div>

      {/* Appointments + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {/* Appointments */}
        <div className="bg-card border border-border rounded-2xl p-5 lg:col-span-2 card-shadow">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-bold text-foreground">Upcoming Appointments</h3>
            <a href="/patient/appointments" className="text-[13px] text-blue-600 bg-transparent font-semibold">
              + Book New
            </a>
          </div>
          <div className="flex flex-col gap-3">
            {upcomingAppointments.map((appointment) => (
              <div key={appointment.id} className="flex items-center gap-3.5 p-3.5 bg-muted rounded-xl">
                <div className="w-[42px] h-[42px] rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-[13px] font-bold text-blue-600 dark:text-blue-400 shrink-0">
                  {appointment.doctorName.split(" ").map((part) => part[0]).join("").slice(0, 2)}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-foreground">{appointment.doctorName}</div>
                  <div className="text-xs text-muted-foreground">
                    {appointment.specialty ?? "General"} · {formatDate(appointment.at)} at {formatTime(appointment.at)}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge status={appointment.status} />
                  <span className="text-[11px] text-muted-foreground">{toLabel(appointment.mode)}</span>
                </div>
              </div>
            ))}
            {upcomingAppointments.length === 0 && <InlineEmpty text="No upcoming appointments." />}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-card border border-border rounded-2xl p-5 card-shadow">
          <h3 className="text-base font-bold text-foreground mb-4">Quick Actions</h3>
          <div className="flex flex-col gap-2">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <a
                  key={action.label}
                  href={action.href}
                  onMouseEnter={() => setHoveredAction(action.label)}
                  onMouseLeave={() => setHoveredAction(null)}
                  className="flex items-center gap-3 p-2.5 rounded-[10px] border border-border bg-card cursor-pointer text-left transition-all"
                >
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", action.bg)}>
                    <Icon size={16} className={action.color} />
                  </div>
                  <span className="text-[13px] font-semibold text-foreground">{action.label}</span>
                </a>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Prescriptions */}
        <div className="bg-card border border-border rounded-2xl p-5 card-shadow">
          <h3 className="text-base font-bold text-foreground mb-4">Active Prescriptions</h3>
          <div className="flex flex-col gap-2.5">
            {prescriptions.map((prescription) => (
              <div key={prescription.id} className="p-3.5 bg-muted rounded-[10px]">
                <div className="flex justify-between mb-1 gap-2">
                  <div className="text-[13px] font-bold text-foreground">
                    {prescription.drugNames.join(", ") || "Prescription"}
                  </div>
                  <Badge status={prescription.status} />
                </div>
                <div className="text-xs text-muted-foreground">{prescription.doctorName}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Issued {formatDate(prescription.createdAt)}</div>
              </div>
            ))}
            {prescriptions.length === 0 && <InlineEmpty text="No active prescriptions." />}
          </div>
        </div>

        {/* Lab Results */}
        <div className="bg-card border border-border rounded-2xl p-5 card-shadow">
          <h3 className="text-base font-bold text-foreground mb-4">Recent Lab Results</h3>
          <div className="flex flex-col gap-2.5">
            {labResults.map((result) => {
              const flagged = Boolean(result.flag && result.flag !== "NORMAL");
              return (
                <div key={result.id} className={`p-3.5 rounded-[10px] ${flagged ? "bg-red-50 border border-red-200" : "bg-muted"}`}>
                  <div className="flex justify-between mb-1 gap-2">
                    <div className="text-[13px] font-bold text-foreground">{result.testName}</div>
                    <Badge status={flagged ? "EXPIRED" : "DISPENSED"} />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {result.valueText ?? "—"} {result.unit ?? ""} ·{" "}
                    {result.releasedAt ? relativeTime(result.releasedAt) : "Pending release"}
                  </div>
                </div>
              );
            })}
            {labResults.length === 0 && <InlineEmpty text="No released lab results." />}
          </div>
        </div>

        {/* Health Insights */}
        <div className="bg-card border border-border rounded-2xl p-5 card-shadow">
          <h3 className="text-base font-bold text-foreground mb-4">Health Insights</h3>
          <div className="flex flex-col gap-3">
            <div className="p-3.5 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <Heart size={14} className="text-green-600 dark:text-green-400" />
                <span className="text-[13px] font-bold text-green-800 dark:text-green-300">Heart Health</span>
              </div>
              <p className="text-xs text-green-700 dark:text-green-400">
                {bpSeries.length > 0
                  ? `Your latest reading was ${bpSeries[bpSeries.length - 1].systolic}/${bpSeries[bpSeries.length - 1].diastolic} mmHg on ${bpSeries[bpSeries.length - 1].date}.`
                  : "No blood pressure readings on file yet."}
              </p>
            </div>
            <div className="p-3.5 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <Activity size={14} className="text-yellow-600 dark:text-yellow-400" />
                <span className="text-[13px] font-bold text-yellow-800 dark:text-yellow-300">Active Problems</span>
              </div>
              <p className="text-xs text-yellow-700 dark:text-yellow-400">
                {dashboard.data.problems.length > 0 ? dashboard.data.problems.join(", ") : "No active problems recorded."}
              </p>
            </div>
            <div className="p-3.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <Pill size={14} className="text-blue-600 dark:text-blue-400" />
                <span className="text-[13px] font-bold text-blue-800 dark:text-blue-300">Care Team</span>
              </div>
              <p className="text-xs text-blue-700 dark:text-blue-400">
                {careTeam?.doctorName
                  ? `${careTeam.doctorName}${careTeam.specialty ? ` · ${careTeam.specialty}` : ""}${careTeam.department ? ` · ${careTeam.department}` : ""}`
                  : "No primary doctor assigned yet."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
