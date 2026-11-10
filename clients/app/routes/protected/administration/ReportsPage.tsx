import { useState } from "react";
import { toast } from "sonner";
import { Download, DollarSign, Star, Bed, Clock, TrendingDown, BarChart2, FileText, Users, ShieldCheck, Activity } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

import { useFinancialReport, useReportCatalogue, useReportsOverview } from "@/hooks/reports/report.hooks";
import { QueryEmpty, QueryError, QueryLoading } from "@/components/globals/query-state";
import { downloadFile } from "@/services/api/client";
import { errorMessage } from "@/services/api/api-error";
import { formatDate, money, pct } from "@/lib/format";

const categories = [
  { id: "financial", label: "Financial", icon: DollarSign, color: "#16a34a" },
  { id: "clinical", label: "Clinical", icon: Activity, color: "#2563eb" },
  { id: "operational", label: "Operational", icon: BarChart2, color: "#7c3aed" },
  { id: "staff", label: "Staff", icon: Users, color: "#0891b2" },
  { id: "compliance", label: "Compliance", icon: ShieldCheck, color: "#d97706" },
];

export default function ReportsPage() {
  const [activeCategory, setActiveCategory] = useState("financial");
  const [downloading, setDownloading] = useState<string | null>(null);

  const overview = useReportsOverview();
  const financial = useFinancialReport(365);
  const catalogue = useReportCatalogue();

  const kpis = overview.data
    ? [
        {
          label: "Revenue (MTD)",
          value: money(overview.data.kpis.revenueThisMonthMinor),
          sub:
            overview.data.kpis.revenueChangePercent === null
              ? "No prior month"
              : `${overview.data.kpis.revenueChangePercent >= 0 ? "+" : ""}${pct(overview.data.kpis.revenueChangePercent, 1)} vs last month`,
          icon: DollarSign,
          color: "#16a34a",
          bg: "#dcfce7",
        },
        {
          label: "Patient Satisfaction",
          value: `${overview.data.kpis.satisfaction}/5.0`,
          sub: `${pct(overview.data.kpis.collectionRatePercent ?? 0, 0)} collection rate`,
          icon: Star,
          color: "#f59e0b",
          bg: "#fef9c3",
        },
        {
          label: "Bed Occupancy Rate",
          value: pct(overview.data.kpis.bedOccupancyPercent),
          sub: `${overview.data.kpis.occupiedBeds} of ${overview.data.kpis.totalBeds} beds`,
          icon: Bed,
          color: "#2563eb",
          bg: "#dbeafe",
        },
        {
          label: "Avg Length of Stay",
          value: `${overview.data.kpis.avgLengthOfStayDays} days`,
          sub: `${overview.data.kpis.completedLast30} completed / 30d`,
          icon: Clock,
          color: "#7c3aed",
          bg: "#ede9fe",
        },
        {
          label: "Readmission Rate",
          value: overview.data.kpis.readmissionRatePercent === null ? "—" : pct(overview.data.kpis.readmissionRatePercent, 1),
          sub: "Target: <5%",
          icon: TrendingDown,
          color: "#0891b2",
          bg: "#cffafe",
        },
      ]
    : [];

  const revenueData = (financial.data?.revenueSeries ?? []).map((row) => ({
    month: row.month,
    revenue: Math.round(row.collectedMinor / 100),
    expenses: Math.round(row.refundedMinor / 100),
  }));
  const deptPerformance = (financial.data?.departmentRevenue ?? []).map((row) => ({
    dept: row.department,
    revenue: Math.round(row.collectedMinor / 100),
  }));

  const reports = (catalogue.data ?? []).filter((entry) => entry.category === activeCategory);

  const download = async (entry: { id: string; name: string; endpoint: string; format: string }) => {
    setDownloading(entry.id);
    try {
      await downloadFile(`${entry.endpoint}?format=${entry.format}`, `${entry.id}.${entry.format}`);
    } catch (error) {
      toast.error(errorMessage(error, "Could not download the report."));
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground mb-1">Reports & Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Hospital performance metrics and downloadable reports
            {overview.data ? ` · updated ${formatDate(overview.data.generatedAt)}` : ""}
          </p>
        </div>
        <button
          onClick={() => {
            const entry = (catalogue.data ?? [])[0];
            if (!entry) {
              toast.error("No reports are available for your role.");
              return;
            }
            void download(entry);
          }}
          disabled={catalogue.isLoading || downloading !== null}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white border-none rounded-[10px] cursor-pointer font-bold text-[13px] disabled:opacity-60"
        >
          <Download size={15} /> Export Report
        </button>
      </div>

      {overview.isLoading && <QueryLoading text="Loading report metrics…" />}
      {overview.isError && <QueryError error={overview.error} onRetry={() => void overview.refetch()} />}

      {kpis.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 mb-6">
          {kpis.map((k) => {
            const Icon = k.icon;
            return (
              <div key={k.label} className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ backgroundColor: k.bg }}>
                    <Icon size={16} style={{ color: k.color }} />
                  </div>
                </div>
                <div className="text-xl font-extrabold text-foreground">{k.value}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{k.label}</div>
                <div className="text-[11px] font-semibold mt-1" style={{ color: k.color }}>{k.sub}</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-[15px] font-bold text-foreground mb-4">Monthly Collected vs Refunded (12 months)</h3>
          {financial.isLoading && <QueryLoading text="Loading revenue…" />}
          {financial.isError && <QueryError error={financial.error} onRetry={() => void financial.refetch()} />}
          {financial.data && revenueData.length === 0 && <QueryEmpty title="No payments in this period" />}
          {revenueData.length > 0 && (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} formatter={(v: unknown) => [`$${Number(v).toLocaleString()}`, ""]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={2.5} dot={{ r: 3 }} name="Collected" />
                <Line type="monotone" dataKey="expenses" stroke="#dc2626" strokeWidth={2.5} dot={{ r: 3 }} name="Refunded" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-[15px] font-bold text-foreground mb-4">Department Revenue</h3>
          {deptPerformance.length === 0 && financial.data && <QueryEmpty title="No department revenue yet" />}
          {deptPerformance.length > 0 && (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={deptPerformance} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="dept" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} formatter={(v: unknown) => [`$${Number(v).toLocaleString()}`, "Collected"]} />
                <Bar dataKey="revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-[13px] font-bold text-foreground mb-3">Categories</h3>
          <div className="flex flex-col gap-1">
            {categories.map((c) => {
              const Icon = c.icon;
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveCategory(c.id)}
                  className="flex items-center gap-2.5 px-3 py-2.5 border-none rounded-[10px] cursor-pointer font-semibold text-[13px] text-left"
                  style={{
                    background: activeCategory === c.id ? `${c.color}18` : "transparent",
                    color: activeCategory === c.id ? c.color : "var(--muted-foreground)",
                  }}
                >
                  <Icon size={15} />
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5 lg:col-span-3">
          <h3 className="text-[15px] font-bold text-foreground mb-4">
            {categories.find((c) => c.id === activeCategory)?.label} Reports
          </h3>
          {catalogue.isLoading && <QueryLoading text="Loading report catalogue…" />}
          {catalogue.isError && <QueryError error={catalogue.error} onRetry={() => void catalogue.refetch()} />}
          <div className="flex flex-col gap-2.5">
            {reports.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-3.5 bg-muted rounded-xl border border-border">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[10px] bg-blue-100 flex items-center justify-center">
                    <FileText size={16} className="text-blue-600" />
                  </div>
                  <div>
                    <div className="text-[13px] font-bold text-foreground">{r.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {r.format.toUpperCase()} · {r.endpoint}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => void download(r)}
                  disabled={downloading === r.id}
                  className="flex items-center gap-1.5 px-3.5 py-[7px] bg-blue-600 text-white border-none rounded-lg cursor-pointer font-semibold text-xs disabled:opacity-60"
                >
                  <Download size={12} /> {downloading === r.id ? "Preparing…" : "Download"}
                </button>
              </div>
            ))}
            {catalogue.data && reports.length === 0 && (
              <div className="text-center py-10 text-muted-foreground text-[13px]">
                No downloadable reports in this category.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
