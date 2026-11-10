import { Users, CalendarCheck, Star, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

import { useDoctorAnalytics } from "@/hooks/reports/report.hooks";
import { QueryError, QueryLoading, InlineEmpty } from "@/components/globals/query-state";
import { pct } from "@/lib/format";

const TYPE_COLORS = ["#2563eb", "#7c3aed", "#16a34a", "#d97706", "#dc2626", "#0891b2"];

export default function AnalyticsPage() {
  const analytics = useDoctorAnalytics(90);

  if (analytics.isLoading) {
    return (
      <div className="p-6">
        <QueryLoading text="Loading your analytics…" />
      </div>
    );
  }

  if (analytics.isError || !analytics.data) {
    return (
      <div className="p-6">
        <QueryError error={analytics.error} onRetry={() => void analytics.refetch()} />
      </div>
    );
  }

  const { totals, appointmentsPerDay, satisfactionTrend, appointmentTypeDistribution, topDiagnoses } = analytics.data;

  const kpis = [
    {
      label: "Patients (90 days)",
      value: String(totals.uniquePatients),
      sub: `${totals.appointments} appointments`,
      icon: Users,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-100 dark:bg-blue-950",
    },
    {
      label: "Completed",
      value: String(totals.completed),
      sub: `${totals.noShows} no-shows · ${totals.cancellations} cancelled`,
      icon: CalendarCheck,
      color: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-100 dark:bg-violet-950",
    },
    {
      label: "Patient Satisfaction",
      value:
        satisfactionTrend.length > 0
          ? `${(satisfactionTrend[satisfactionTrend.length - 1].rating).toFixed(1)}/5`
          : "—",
      sub: satisfactionTrend.length > 0
        ? `From ${satisfactionTrend[satisfactionTrend.length - 1].responses} reviews`
        : "No ratings yet",
      icon: Star,
      color: "text-yellow-600 dark:text-yellow-400",
      bg: "bg-yellow-100 dark:bg-yellow-950",
    },
    {
      label: "Completion Rate",
      value: totals.appointments > 0 ? pct((totals.completed / totals.appointments) * 100) : "—",
      sub: "Last 90 days",
      icon: TrendingUp,
      color: "text-green-600 dark:text-green-400",
      bg: "bg-green-100 dark:bg-green-950",
    },
  ];

  const apptData = appointmentsPerDay.map((row) => ({
    day: row.date.slice(5),
    count: row.appointments,
    completed: row.completed,
  }));
  const satisfactionData = satisfactionTrend.map((row) => ({ month: row.month, score: row.rating }));
  const typeData = appointmentTypeDistribution.map((row, i) => ({
    name: row.type,
    value: row.total,
    color: TYPE_COLORS[i % TYPE_COLORS.length],
  }));
  const maxDiagnosis = Math.max(1, ...topDiagnoses.map((row) => row.value));

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-[26px] font-extrabold text-foreground mb-1 font-['Plus_Jakarta_Sans',sans-serif]">Analytics</h1>
        <p className="text-muted-foreground text-[15px]">Your practice performance — last {analytics.data.range.days} days</p>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {kpis.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-card border border-border rounded-2xl p-6 flex gap-3.5 items-start card-shadow">
              <div className={cn("w-[46px] h-[46px] rounded-[14px] flex items-center justify-center shrink-0", s.bg)}>
                <Icon size={20} className={s.color} />
              </div>
              <div>
                <div className="text-[22px] font-extrabold text-foreground font-mono">{s.value}</div>
                <div className="text-[11px] text-muted-foreground mb-0.5">{s.label}</div>
                <div className={cn("text-[11px] font-semibold", s.color)}>{s.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-2 gap-5 mb-5">
        <div className="bg-card border border-border rounded-2xl p-6 card-shadow">
          <div className="text-[15px] font-bold text-foreground mb-4 font-['Plus_Jakarta_Sans',sans-serif]">Appointments Per Day</div>
          {apptData.length === 0 ? (
            <InlineEmpty text="No appointments in this period." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={apptData} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" name="Appointments" fill="#2563eb" radius={[6, 6, 0, 0]} />
                <Bar dataKey="completed" name="Completed" fill="#16a34a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 card-shadow">
          <div className="text-[15px] font-bold text-foreground mb-4 font-['Plus_Jakarta_Sans',sans-serif]">Patient Satisfaction Trend</div>
          {satisfactionData.length === 0 ? (
            <InlineEmpty text="No satisfaction responses yet." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={satisfactionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 5]} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={(v) => Number(v).toFixed(1)} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} formatter={(v: unknown) => [Number(v).toFixed(1), "Score"]} />
                <Line type="monotone" dataKey="score" stroke="#ca8a04" strokeWidth={2.5} dot={{ fill: "#ca8a04", r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-2 gap-5">
        <div className="bg-card border border-border rounded-2xl p-6 card-shadow">
          <div className="text-[15px] font-bold text-foreground mb-4 font-['Plus_Jakarta_Sans',sans-serif]">Appointment Type Distribution</div>
          {typeData.length === 0 ? (
            <InlineEmpty text="No appointments in this period." />
          ) : (
            <div className="flex gap-6 items-center">
              <ResponsiveContainer width={200} height={200}>
                <PieChart>
                  <Pie data={typeData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={3}>
                    {typeData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 flex flex-col gap-3">
                {typeData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="flex-1 text-[13px] text-foreground">{d.name}</span>
                    <span className="text-[14px] font-bold text-foreground font-mono">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 card-shadow">
          <div className="text-[15px] font-bold text-foreground mb-4 font-['Plus_Jakarta_Sans',sans-serif]">Top Diagnoses</div>
          {topDiagnoses.length === 0 && <InlineEmpty text="No diagnoses recorded yet." />}
          <div className="flex flex-col gap-2.5">
            {topDiagnoses.map((d, i) => (
              <div key={d.name} className="flex items-center gap-3">
                <span className="text-[12px] font-bold text-muted-foreground w-[18px] font-mono">#{i + 1}</span>
                <span className="flex-1 text-[13px] text-foreground font-medium">{d.name}</span>
                <div className="w-20 h-1.5 rounded-[3px] bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-[3px] transition-all duration-500"
                    style={{ width: `${(d.value / maxDiagnosis) * 100}%`, backgroundColor: "#2563eb" }}
                  />
                </div>
                <span className="text-[12px] font-bold text-muted-foreground w-7 text-right font-mono">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
