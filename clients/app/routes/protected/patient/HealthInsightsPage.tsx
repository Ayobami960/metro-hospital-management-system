import { Heart, Activity, Droplets, Weight, AlertTriangle, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { usePatientDashboard } from "@/hooks/dashboards/dashboard.hooks";
import { useMyClinicalSummary } from "@/hooks/clinical/clinical.hooks";
import { QueryError, QueryLoading, InlineEmpty } from "@/components/globals/query-state";
import { formatDate, formatDateTime, label as toLabel } from "@/lib/format";

export default function HealthInsightsPage() {
  const dashboard = usePatientDashboard();
  const summary = useMyClinicalSummary();

  if (dashboard.isLoading) {
    return (
      <div className="p-6">
        <QueryLoading text="Loading your health data…" />
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

  const { bpSeries, weightSeries, metrics, problems, allergies } = dashboard.data;
  const vitals = summary.data?.latestVitals ?? null;
  const latest = bpSeries[bpSeries.length - 1];
  const previous = bpSeries[bpSeries.length - 2];
  const latestWeight = weightSeries[weightSeries.length - 1];
  const previousWeight = weightSeries[weightSeries.length - 2];

  const cards = [
    {
      label: "Blood Pressure",
      value: vitals ? `${vitals.systolic ?? "—"}/${vitals.diastolic ?? "—"}` : latest ? `${latest.systolic}/${latest.diastolic}` : "—",
      unit: "mmHg",
      icon: Heart,
      previous: previous ? `${previous.systolic}/${previous.diastolic}` : "—",
      status:
        (vitals?.systolic ?? latest?.systolic ?? 0) >= 140 || (vitals?.diastolic ?? latest?.diastolic ?? 0) >= 90
          ? "High"
          : "Normal",
    },
    {
      label: "Heart Rate",
      value: vitals?.heartRate != null ? String(vitals.heartRate) : "—",
      unit: "bpm",
      icon: Activity,
      previous: "—",
      status: vitals?.heartRate != null && (vitals.heartRate < 60 || vitals.heartRate > 100) ? "Out of range" : "Normal",
    },
    {
      label: "O₂ Saturation",
      value: vitals?.spo2 != null ? String(vitals.spo2) : "—",
      unit: "%",
      icon: Droplets,
      previous: "—",
      status: vitals?.spo2 != null && vitals.spo2 < 95 ? "Low" : "Normal",
    },
    {
      label: "Weight",
      value: latestWeight ? String(latestWeight.weight) : "—",
      unit: "kg",
      icon: Weight,
      previous: previousWeight ? `${previousWeight.weight} kg` : "—",
      status: "Recorded",
    },
  ];

  const metricTypes = Array.from(new Set(metrics.map((metric) => metric.type)));
  const sleepSeries = metrics
    .filter((metric) => metric.type === "SLEEP")
    .slice(-7)
    .map((metric) => ({ day: formatDate(metric.recordedAt).slice(0, 6), value: metric.value }));
  const stepSeries = metrics
    .filter((metric) => metric.type === "STEPS")
    .slice(-7)
    .map((metric) => ({
      day: new Date(metric.recordedAt).toLocaleDateString(undefined, { weekday: "short" }),
      value: metric.value,
    }));
  const activitySeries = stepSeries.length > 0 ? stepSeries : sleepSeries;

  return (
    <div className="p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-[26px] font-extrabold text-foreground mb-1 font-['Plus_Jakarta_Sans',sans-serif]">Health Insights</h1>
          <p className="text-muted-foreground text-[15px]">
            Analysis of the vitals and observations on your record
            {vitals ? ` · Updated ${formatDate(vitals.recordedAt)}` : ""}
          </p>
        </div>
      </div>

      {/* Vitals Bar */}
      <div className="grid grid-cols-4 gap-3.5 mb-6">
        {cards.map((card) => {
          const Icon = card.icon;
          const normal = card.status === "Normal" || card.status === "Recorded";
          return (
            <div key={card.label} className="bg-card border border-border rounded-2xl p-6 card-shadow">
              <div className="flex items-center gap-2.5 mb-3">
                <div className={cn("w-9 h-9 rounded-[10px] flex items-center justify-center", normal ? "bg-green-100 dark:bg-green-950" : "bg-amber-100 dark:bg-amber-950")}>
                  <Icon size={18} className={normal ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"} />
                </div>
                <span className="text-xs font-bold text-muted-foreground">{card.label}</span>
              </div>
              <div className="text-2xl font-black text-foreground font-mono mb-1">
                {card.value} <span className="text-xs font-medium text-muted-foreground">{card.unit}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full", normal ? "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400" : "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400")}>
                  {card.status}
                </span>
                <span className="text-[11px] text-muted-foreground">prev: {card.previous}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-5 mb-5" style={{ gridTemplateColumns: "1fr 280px" }}>
        {/* BP Trend */}
        <div className="bg-card border border-border rounded-2xl p-6 card-shadow">
          <h3 className="text-[15px] font-bold text-foreground mb-4 font-['Plus_Jakarta_Sans',sans-serif]">Blood Pressure Trend</h3>
          {bpSeries.length === 0 ? (
            <InlineEmpty text="No blood pressure readings on file." />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={bpSeries}>
                <defs>
                  <linearGradient id="bp1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="bp2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="systolic" stroke="#2563eb" fill="url(#bp1)" strokeWidth={2.5} name="Systolic" />
                <Area type="monotone" dataKey="diastolic" stroke="#7c3aed" fill="url(#bp2)" strokeWidth={2.5} name="Diastolic" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Clinical snapshot */}
        <div className="bg-card border border-border rounded-2xl p-6 flex flex-col card-shadow">
          <h3 className="text-[15px] font-bold text-foreground mb-3 font-['Plus_Jakarta_Sans',sans-serif]">Record Snapshot</h3>
          <div className="flex flex-col gap-2.5 text-[13px]">
            {[
              { label: "Active problems", value: summary.data?.counts.activeProblems ?? 0 },
              { label: "Active allergies", value: summary.data?.counts.activeAllergies ?? 0 },
              { label: "Severe allergies", value: summary.data?.counts.severeAllergies ?? 0 },
              { label: "Active medications", value: summary.data?.counts.activeMedications ?? 0 },
              { label: "Recent encounters", value: summary.data?.recentEncounters.length ?? 0 },
            ].map((item) => (
              <div key={item.label} className="flex justify-between py-1.5 px-3 bg-muted rounded-lg">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-mono font-bold text-foreground">{item.value}</span>
              </div>
            ))}
          </div>
          {summary.data?.latestVitals && (
            <div className="mt-3 text-[11px] text-muted-foreground">
              Latest vitals captured {formatDateTime(summary.data.latestVitals.recordedAt)}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5 mb-5">
        {/* Weight */}
        <div className="bg-card border border-border rounded-2xl p-6 card-shadow">
          <h3 className="text-[15px] font-bold text-foreground mb-4 font-['Plus_Jakarta_Sans',sans-serif]">Weight Trend (kg)</h3>
          {weightSeries.length === 0 ? (
            <InlineEmpty text="No weight measurements on file." />
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={weightSeries}>
                <defs>
                  <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="weight" stroke="#16a34a" fill="url(#wg)" strokeWidth={2.5} name="Weight (kg)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Activity */}
        <div className="bg-card border border-border rounded-2xl p-6 card-shadow">
          <h3 className="text-[15px] font-bold text-foreground mb-4 font-['Plus_Jakarta_Sans',sans-serif]">Recorded Activity</h3>
          {stepSeries.length === 0 && sleepSeries.length === 0 ? (
            <InlineEmpty text="No activity or sleep observations recorded." />
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={activitySeries} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Record-derived notes */}
      <div className="bg-card border border-border rounded-2xl p-6 card-shadow">
        <div className="flex items-center gap-2 mb-4">
          <ClipboardList size={20} className="text-violet-600 dark:text-violet-400" />
          <h3 className="text-[15px] font-bold text-foreground font-['Plus_Jakarta_Sans',sans-serif]">From Your Record</h3>
          <span className="text-[11px] font-bold px-2.5 py-[3px] rounded-full bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 ml-auto">
            {metricTypes.length > 0 ? `${metricTypes.length} metric types` : "Clinical data"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3.5">
          <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400" />
              <span className="text-[13px] font-bold text-amber-800 dark:text-amber-300">Active Problems</span>
            </div>
            <p className="text-[13px] text-foreground leading-relaxed">
              {problems.length > 0 ? problems.join(", ") : "No active problems recorded."}
            </p>
          </div>
          <div className="p-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={16} className="text-red-600 dark:text-red-400" />
              <span className="text-[13px] font-bold text-red-800 dark:text-red-300">Allergies</span>
            </div>
            <p className="text-[13px] text-foreground leading-relaxed">
              {allergies.length > 0 ? allergies.join(", ") : "No known allergies."}
            </p>
          </div>
          {metrics.slice(-2).map((metric) => (
            <div key={`${metric.type}-${metric.recordedAt}`} className="p-4 rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30">
              <div className="flex items-center gap-2 mb-1">
                <Activity size={16} className="text-green-600 dark:text-green-400" />
                <span className="text-[13px] font-bold text-green-800 dark:text-green-300">{toLabel(metric.type)}</span>
              </div>
              <div className="text-2xl font-black text-foreground font-mono">
                {metric.value}
                {metric.secondaryValue != null ? ` / ${metric.secondaryValue}` : ""}{" "}
                <span className="text-xs font-medium text-muted-foreground">{metric.unit ?? ""}</span>
              </div>
              <div className="text-[11px] text-muted-foreground">{formatDateTime(metric.recordedAt)}</div>
            </div>
          ))}
        </div>
        <div className="mt-3.5 py-2.5 px-3.5 bg-muted rounded-[10px] text-xs text-muted-foreground">
          <strong>Disclaimer:</strong> These figures come directly from your medical record and are informational only; they are
          not medical advice.
        </div>
      </div>
    </div>
  );
}
