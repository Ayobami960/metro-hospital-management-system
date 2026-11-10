import { useMemo, useState } from "react";
import { Link } from "react-router";
import { TrendingUp, AlertCircle, CheckCircle, FileText, Download, Search } from "lucide-react";
import { cn } from '@/lib/utils';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { QueryError, QueryLoading, InlineEmpty } from "@/components/globals/query-state";
import { useBillingDashboard, useBillingReports, useClaims, useInvoices } from "@/hooks/billing/billing.hooks";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { compactMoney, formatDate, label, money } from "@/lib/format";

const statusClass: Record<string, string> = {
  DRAFT: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
  ISSUED: "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400",
  PARTIALLY_PAID: "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400",
  PAID: "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400",
  OVERDUE: "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400",
  VOID: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
  SUBMITTED: "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400",
  UNDER_REVIEW: "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400",
  APPROVED: "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400",
  PARTIALLY_APPROVED: "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400",
  DENIED: "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400",
  APPEALED: "bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-400",
};

function Badge({ status }: { status: string }) {
  const cls = statusClass[status] ?? statusClass["ISSUED"];
  return (
    <span className={cn('text-[11px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap', cls)}>
      {label(status)}
    </span>
  );
}

const monthKey = (day: string) => new Date(day).toLocaleDateString("en-US", { month: "short" });

export default function BillingDashboard() {
  const [activeTab, setActiveTab] = useState<"invoices" | "claims">("invoices");
  const [searchVal, setSearchVal] = useState("");
  const search = useDebouncedValue(searchVal);

  const dashboard = useBillingDashboard();

  const sixMonthsAgo = useMemo(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 5, 1);
    return date.toISOString().slice(0, 10);
  }, []);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const reports = useBillingReports(sixMonthsAgo, today);

  const invoices = useInvoices({ page: 1, pageSize: 10, search: search || undefined });
  const claims = useClaims({ page: 1, pageSize: 10, search: search || undefined });

  const revenueByMonth = useMemo(() => {
    const buckets = new Map<string, number>();
    for (const row of reports.data?.revenueByDay ?? []) {
      const key = monthKey(row.day);
      buckets.set(key, (buckets.get(key) ?? 0) + row.amountMinor / 100);
    }
    return [...buckets.entries()].map(([month, revenue]) => ({ month, revenue }));
  }, [reports.data]);

  const dailyData = (dashboard.data?.revenueSeries ?? []).map((row) => ({
    day: new Date(row.day).toLocaleDateString("en-US", { weekday: "short" }),
    amount: row.amountMinor / 100,
  }));

  const stats = dashboard.data
    ? [
        {
          label: "Collected Today",
          value: money(dashboard.data.stats.collectedTodayMinor),
          sub: "Payments received today",
          icon: TrendingUp,
          bg: "bg-green-100 dark:bg-green-950",
          color: "text-green-600",
        },
        {
          label: "Outstanding",
          value: compactMoney(dashboard.data.stats.outstandingMinor),
          sub: "Open patient balance",
          icon: FileText,
          bg: "bg-blue-100 dark:bg-blue-950",
          color: "text-blue-600",
        },
        {
          label: "Overdue",
          value: compactMoney(dashboard.data.stats.overdueMinor),
          sub: "Past the due date",
          icon: AlertCircle,
          bg: "bg-red-100 dark:bg-red-950",
          color: "text-red-600",
        },
        {
          label: "Claims Pending",
          value: String(dashboard.data.stats.claimsPending),
          sub: "Awaiting insurer decision",
          icon: CheckCircle,
          bg: "bg-amber-100 dark:bg-amber-950",
          color: "text-amber-600",
        },
      ]
    : [];

  const invoiceRows = invoices.data?.rows ?? [];
  const claimRows = claims.data?.rows ?? [];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-foreground mb-1">Billing & Finance 💳</h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}{" "}
          · live billing cycle
        </p>
      </div>

      {/* Stats */}
      {dashboard.isLoading ? (
        <QueryLoading className="mb-6" text="Loading billing counters…" />
      ) : dashboard.isError ? (
        <QueryError error={dashboard.error} onRetry={() => void dashboard.refetch()} className="mb-6" />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-card border border-border rounded-2xl p-5 flex gap-3.5 items-center card-shadow">
                <div className={cn('w-[46px] h-[46px] rounded-[14px] flex items-center justify-center', s.bg)}>
                  <Icon size={20} className={s.color} />
                </div>
                <div>
                  <div className="text-xl font-extrabold text-foreground">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                  <div className={cn('text-[11px] font-semibold', s.color)}>{s.sub}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 mb-5">
        <div className="bg-card border border-border rounded-2xl p-5 lg:col-span-3 card-shadow">
          <h3 className="text-base font-bold text-foreground mb-4">Collected (6 Mo)</h3>
          {reports.isLoading ? (
            <QueryLoading text="Loading revenue…" />
          ) : reports.isError ? (
            <QueryError error={reports.error} onRetry={() => void reports.refetch()} />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={revenueByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} formatter={(v: unknown) => [`$${Number(v).toLocaleString()}`, "Collected"]} />
                  <Area type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={2} fill="#dcfce7" fillOpacity={0.5} />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex gap-5 mt-2">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="w-3 h-[3px] bg-green-600 rounded-sm inline-block" />Collected
                </div>
              </div>
            </>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 lg:col-span-2 card-shadow">
          <h3 className="text-base font-bold text-foreground mb-4">This Week Daily</h3>
          {dashboard.isLoading ? (
            <QueryLoading text="Loading daily revenue…" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} formatter={(v: unknown) => [`$${Number(v).toLocaleString()}`, "Revenue"]} />
                <Bar dataKey="amount" fill="#d97706" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Invoices / Claims Table */}
      <div className="bg-card border border-border rounded-2xl p-5 card-shadow">
        <div className="flex justify-between items-center mb-4">
          <div className="flex gap-1">
            {([["invoices", "Invoices"], ["claims", "Insurance Claims"]] as const).map(([tab, tabLabel]) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer border-none transition-colors ${
                  activeTab === tab ? "bg-blue-600 text-white" : "text-muted-foreground bg-transparent"
                }`}
              >
                {tabLabel}
              </button>
            ))}
          </div>
          <div className="flex gap-2.5 items-center">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                placeholder="Search..."
                className="pl-8 pr-2.5 py-2 border border-border rounded-lg text-[13px] bg-muted text-foreground outline-none w-44"
              />
            </div>
            <button className="flex items-center gap-1.5 px-3.5 py-2 bg-muted text-foreground border border-border rounded-lg text-[13px] font-semibold cursor-pointer">
              <Download size={14} /> Export
            </button>
          </div>
        </div>

        {activeTab === "invoices" ? (
          invoices.isLoading ? (
            <QueryLoading text="Loading invoices…" />
          ) : invoices.isError ? (
            <QueryError error={invoices.error} onRetry={() => void invoices.refetch()} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b-2 border-border">
                    {["Invoice ID", "Patient", "Items", "Date", "Total", "Paid", "Balance", "Status", "Action"].map((h) => (
                      <th key={h} className="text-left py-2 px-3 text-xs font-bold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoiceRows.map((inv) => (
                    <tr key={inv.id} className="border-b border-border">
                      <td className="py-3 px-3 font-mono text-xs text-blue-600 font-bold">{inv.invoiceNumber}</td>
                      <td className="py-3 px-3 font-semibold text-foreground">{inv.patientName}</td>
                      <td className="py-3 px-3 text-muted-foreground">{inv.itemCount}</td>
                      <td className="py-3 px-3 text-muted-foreground text-xs">{formatDate(inv.issuedAt)}</td>
                      <td className="py-3 px-3 font-mono font-bold text-foreground">{money(inv.totalMinor)}</td>
                      <td className="py-3 px-3 font-mono text-green-600 font-bold">{money(inv.amountPaidMinor)}</td>
                      <td className={cn('py-3 px-3 font-mono font-bold', inv.balanceMinor > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground')}>
                        {money(inv.balanceMinor)}
                      </td>
                      <td className="py-3 px-3"><Badge status={inv.status} /></td>
                      <td className="py-3 px-3">
                        <Link
                          to={`/billing/invoices?invoice=${inv.id}`}
                          className="px-2.5 py-1 bg-muted text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-md text-xs font-semibold cursor-pointer"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {invoiceRows.length === 0 && <InlineEmpty text="No invoices match this search." />}
            </div>
          )
        ) : claims.isLoading ? (
          <QueryLoading text="Loading claims…" />
        ) : claims.isError ? (
          <QueryError error={claims.error} onRetry={() => void claims.refetch()} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b-2 border-border">
                  {["Claim ID", "Patient", "Insurer", "Amount", "Submitted", "Days", "Status"].map((h) => (
                    <th key={h} className="text-left py-2 px-3 text-xs font-bold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {claimRows.map((clm) => {
                  const days = clm.submittedAt
                    ? Math.max(0, Math.round((Date.now() - new Date(clm.submittedAt).getTime()) / 86_400_000))
                    : null;
                  return (
                    <tr key={clm.id} className="border-b border-border">
                      <td className="py-3 px-3 font-mono text-xs text-blue-600 font-bold">{clm.claimNumber}</td>
                      <td className="py-3 px-3 font-semibold text-foreground">{clm.patientName}</td>
                      <td className="py-3 px-3 text-muted-foreground">{clm.insurer}</td>
                      <td className="py-3 px-3 font-mono font-bold text-foreground">{money(clm.claimedMinor)}</td>
                      <td className="py-3 px-3 text-muted-foreground text-xs">{formatDate(clm.submittedAt)}</td>
                      <td className="py-3 px-3 font-mono text-muted-foreground">{days === null ? "—" : `${days}d`}</td>
                      <td className="py-3 px-3"><Badge status={clm.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {claimRows.length === 0 && <InlineEmpty text="No insurance claims match this search." />}
          </div>
        )}
      </div>
    </div>
  );
}
