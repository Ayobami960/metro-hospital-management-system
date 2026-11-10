import { useState } from "react";
import {
  Users,
  Stethoscope,
  Calendar,
  TrendingUp,
  Bed,
  Activity,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useAdminDashboard } from "@/hooks/dashboards/dashboard.hooks";
import { QueryError, QueryLoading, InlineEmpty } from "@/components/globals/query-state";
import { compactMoney, formatDate, money, number, pct, relativeTime } from "@/lib/format";

const typeColors: Record<string, string> = {
  info: "#2563eb",
  warning: "#d97706",
  danger: "#dc2626",
  success: "#16a34a",
};

/** Card chrome stays local; only the values come from the dashboard endpoint. */
const STAT_CARDS = [
  { key: "totalPatients", label: "Total Patients", icon: Users, color: "#2563eb", bg: "#dbeafe" },
  { key: "activeDoctors", label: "Active Doctors", icon: Stethoscope, color: "#7c3aed", bg: "#ede9fe" },
  { key: "todayAppointments", label: "Today's Appointments", icon: Calendar, color: "#0891b2", bg: "#cffafe" },
  { key: "monthRevenue", label: "Monthly Revenue", icon: TrendingUp, color: "#16a34a", bg: "#dcfce7" },
  { key: "bedsAvailable", label: "Beds Available", icon: Bed, color: "#d97706", bg: "#fef9c3" },
  { key: "emergencyCases", label: "Emergency Cases", icon: AlertCircle, color: "#dc2626", bg: "#fee2e2" },
  { key: "labTestsToday", label: "Lab Tests Today", icon: Activity, color: "#0891b2", bg: "#cffafe" },
  { key: "claims", label: "Insurance Claims", icon: ShieldCheck, color: "#d97706", bg: "#fef9c3" },
] as const;

const DEPT_COLORS = ["#dc2626", "#2563eb", "#16a34a", "#d97706", "#7c3aed", "#0891b2", "#ea580c", "#0f766e"];

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<"overview" | "doctors" | "departments">("overview");
  const { data, isLoading, isError, error, refetch } = useAdminDashboard();

  if (isLoading) {
    return (
      <div className="p-6">
        <QueryLoading text="Loading hospital dashboard…" />
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

  const statValues: Record<string, { value: string; sub: string }> = {
    totalPatients: {
      value: number(stats.totalPatients),
      sub: `+${number(stats.newPatientsThisMonth)} this month`,
    },
    activeDoctors: {
      value: number(stats.activeDoctors),
      sub: `${number(stats.doctorsOnLeave)} on leave`,
    },
    todayAppointments: {
      value: number(stats.todayAppointments),
      sub: `${number(stats.todayConfirmed)} confirmed`,
    },
    monthRevenue: {
      value: compactMoney(stats.monthRevenueMinor),
      sub:
        stats.revenueChangePercent === null
          ? "No prior month"
          : `${stats.revenueChangePercent >= 0 ? "+" : ""}${pct(stats.revenueChangePercent, 1)} vs last month`,
    },
    bedsAvailable: {
      value: `${number(stats.bedsAvailable)}/${number(stats.bedsTotal)}`,
      sub: `${pct(stats.occupancyPercent)} occupancy`,
    },
    emergencyCases: {
      value: number(stats.emergencyCases),
      sub: `${number(stats.criticalCases)} critical`,
    },
    labTestsToday: {
      value: number(stats.labTestsToday),
      sub: `${number(stats.labCompletedToday)} completed`,
    },
    claims: {
      value: `${number(stats.claimsPending)} pending`,
      sub: `${number(stats.claimsDenied)} denied`,
    },
  };

  const revenueData = data.revenueSeries.map((row) => ({
    month: row.month,
    revenue: Math.round(row.revenue / 100),
    expenses: Math.round(row.expenses / 100),
  }));
  const apptTrend = data.appointmentTrend.map((row) => ({
    month: row.month,
    appointments: row.appointments,
  }));
  const deptData = data.departmentDistribution.map((row, i) => ({
    dept: row.dept,
    patients: row.patients,
    color: DEPT_COLORS[i % DEPT_COLORS.length],
  }));

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-foreground mb-1">
          Hospital Administration ⚙️
        </h1>
        <p className="text-sm text-muted-foreground">
          {formatDate(data.generatedAt)} · Metro General Hospital · System Status:{" "}
          <span className="font-bold text-green-600">● All Systems Operational</span>
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-card border border-border rounded-xl p-1 w-fit">
        {(["overview", "doctors", "departments"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              activeTab === tab
                ? "bg-blue-600 text-white"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "overview" ? "Overview" : tab === "doctors" ? "Doctor Performance" : "Departments"}
          </button>
        ))}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
        {STAT_CARDS.map((card) => {
          const Icon = card.icon;
          const values = statValues[card.key];
          return (
            <div
              key={card.key}
              className="bg-card border border-border rounded-2xl p-5 flex gap-3 items-center"
            >
              <div
                className="w-11 h-11 rounded-[13px] flex items-center justify-center shrink-0"
                style={{ backgroundColor: card.bg }}
              >
                <Icon size={19} style={{ color: card.color }} />
              </div>
              <div className="min-w-0">
                <div className="text-xl font-extrabold text-foreground">{values.value}</div>
                <div className="text-[11px] text-muted-foreground truncate">{card.label}</div>
                <div className="text-[11px] font-semibold" style={{ color: card.color }}>
                  {values.sub}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {activeTab === "overview" && (
        <>
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
            {/* Revenue Chart */}
            <div className="bg-card border border-border rounded-2xl p-5 lg:col-span-2">
              <h3 className="text-base font-bold text-foreground mb-4">Revenue vs. Expenses (12 months)</h3>
              {revenueData.length === 0 ? (
                <InlineEmpty text="No payments recorded yet." />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                    <Tooltip
                      contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: unknown) => [`$${Number(v).toLocaleString()}`, ""]}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} fill="#dbeafe" fillOpacity={0.6} name="Revenue" />
                    <Area type="monotone" dataKey="expenses" stroke="#dc2626" strokeWidth={2} fill="#fee2e2" fillOpacity={0.4} name="Expenses" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Pie Chart */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="text-base font-bold text-foreground mb-4">Patients by Department</h3>
              {deptData.length === 0 ? (
                <InlineEmpty text="No department panels yet." />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={deptData} dataKey="patients" cx="50%" cy="50%" innerRadius={40} outerRadius={65}>
                        {deptData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-2 gap-1 mt-2">
                    {deptData.map((d) => (
                      <div key={d.dept} className="flex items-center gap-1.5 text-xs">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                        <span className="text-foreground truncate flex-1">{d.dept}</span>
                        <span className="text-muted-foreground font-mono">{d.patients}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Bottom Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Appointment Trend */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="text-base font-bold text-foreground mb-4">Appointment Volume (12 months)</h3>
              {apptTrend.length === 0 ? (
                <InlineEmpty text="No appointments recorded yet." />
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={apptTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                    <Line type="monotone" dataKey="appointments" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Activity Log */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="text-base font-bold text-foreground mb-4">Recent Activity Log</h3>
              <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto">
                {data.recentActivities.length === 0 ? (
                  <InlineEmpty text="No audit activity yet." />
                ) : (
                  data.recentActivities.map((a) => (
                    <div key={a.id} className="flex gap-2.5 text-[13px]">
                      <div
                        className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                        style={{ backgroundColor: typeColors[a.level] ?? typeColors.info }}
                      />
                      <div>
                        <span className="text-foreground">
                          {a.action}
                          {a.detail ? ` — ${typeof a.detail === "string" ? a.detail : a.module}` : ""}
                        </span>
                        <span className="text-muted-foreground text-[11px] ml-2">
                          {relativeTime(a.createdAt)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === "doctors" && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-base font-bold text-foreground mb-4">Doctor Performance Overview</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b-2 border-border">
                  {["Doctor", "Department", "Patients", "Rating", "Revenue", "Status", "Actions"].map((h) => (
                    <th key={h} className="text-left py-2 px-3.5 text-xs font-bold text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.doctorPerformance.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <InlineEmpty text="No doctor performance data yet." />
                    </td>
                  </tr>
                ) : (
                  data.doctorPerformance.map((doc) => (
                    <tr key={doc.id} className="border-b border-border">
                      <td className="py-3.5 px-3.5 font-bold text-foreground">{doc.name}</td>
                      <td className="py-3.5 px-3.5 text-muted-foreground">{doc.dept}</td>
                      <td className="py-3.5 px-3.5 font-mono font-bold text-foreground">{doc.patients}</td>
                      <td className="py-3.5 px-3.5">
                        <div className="flex items-center gap-1">
                          <span className="text-amber-500 text-sm">★</span>
                          <span className="font-bold text-foreground">
                            {doc.rating === null ? "—" : doc.rating.toFixed(1)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3.5 font-mono font-bold text-green-600">
                        {money(doc.revenueMinor)}
                      </td>
                      <td className="py-3.5 px-3.5">
                        <span
                          className="text-[11px] font-bold px-2.5 py-0.5 rounded-full"
                          style={{
                            backgroundColor: doc.status === "Active" ? "#dcfce7" : "#fef9c3",
                            color: doc.status === "Active" ? "#16a34a" : "#ca8a04",
                          }}
                        >
                          {doc.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-3.5">
                        <div className="flex gap-1.5">
                          <a
                            href="/administration/doctors"
                            className="px-2.5 py-1 bg-muted text-blue-600 border border-blue-200 rounded-md text-xs font-semibold cursor-pointer"
                          >
                            View
                          </a>
                          <a
                            href="/administration/doctors"
                            className="px-2.5 py-1 bg-muted text-foreground border border-border rounded-md text-xs font-semibold cursor-pointer"
                          >
                            Edit
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "departments" && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-base font-bold text-foreground mb-4">Department Status</h3>
          {data.departments.length === 0 ? (
            <InlineEmpty text="No departments configured yet." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {data.departments.map((dept) => {
                const pct = dept.beds > 0 ? Math.round((dept.occupied / dept.beds) * 100) : 0;
                return (
                  <div key={dept.id} className="p-4 bg-muted rounded-xl border border-border">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="text-[15px] font-extrabold text-foreground">{dept.name}</div>
                        <div className="text-xs text-muted-foreground">Head: {dept.head}</div>
                      </div>
                      <span
                        className="text-[11px] font-bold px-2.5 py-0.5 rounded-full"
                        style={{
                          backgroundColor: dept.status === "High Volume" ? "#fee2e2" : "#dcfce7",
                          color: dept.status === "High Volume" ? "#dc2626" : "#16a34a",
                        }}
                      >
                        {dept.status}
                      </span>
                    </div>
                    <div className="flex gap-4 mb-3">
                      <div>
                        <div className="text-[11px] text-muted-foreground">Doctors</div>
                        <div className="text-base font-extrabold text-blue-600">{dept.doctors}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-muted-foreground">Beds</div>
                        <div className="text-base font-extrabold text-foreground">
                          {dept.occupied}/{dept.beds}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-muted-foreground">Occupancy</div>
                        <div
                          className="text-base font-extrabold"
                          style={{ color: pct > 80 ? "#dc2626" : "#16a34a" }}
                        >
                          {pct}%
                        </div>
                      </div>
                    </div>
                    <div className="h-1.5 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: pct > 85 ? "#dc2626" : pct > 70 ? "#d97706" : "#16a34a",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
