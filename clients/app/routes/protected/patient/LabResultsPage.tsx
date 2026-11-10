import { useMemo, useState } from "react";
import { Download, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

import { useLabOrders, useLabResults } from "@/hooks/laboratory/laboratory.hooks";
import { QueryError, QueryLoading, InlineEmpty } from "@/components/globals/query-state";
import { ServerPager } from "@/components/globals/server-pager";
import { formatDate, formatDateTime, label as toLabel, relativeTime } from "@/lib/format";

export default function LabResultsPage() {
  const [page, setPage] = useState(1);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [resultPage, setResultPage] = useState(1);

  const orders = useLabOrders({ page, pageSize: 10, status: "RELEASED" });
  const orderRows = orders.data?.rows ?? [];
  const selectedOrder = orderRows.find((order) => order.id === selectedOrderId) ?? orderRows[0] ?? null;

  const results = useLabResults({ page: resultPage, pageSize: 50, patientId: selectedOrder?.patientId });
  const released = useMemo(
    () => (results.data?.rows ?? []).filter((row) => row.releasedAt),
    [results.data],
  );

  const abnormal = released.filter((row) => row.flag && row.flag !== "NORMAL");
  const recent = released.slice(0, 8).reverse();

  return (
    <div className="p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-[26px] font-extrabold text-foreground mb-1 font-['Plus_Jakarta_Sans',sans-serif]">Lab Results</h1>
          <p className="text-muted-foreground text-[15px]">
            {orders.data?.meta.total ?? orderRows.length} released panels
            {released[0] ? ` · Last updated ${relativeTime(released[0].releasedAt ?? released[0].enteredAt)}` : ""}
          </p>
        </div>
        <a href="/api/v1/exports/lab-results?format=csv" className="flex items-center gap-1.5 py-[9px] px-4 bg-blue-600 text-white border-none rounded-[10px] text-[13px] font-semibold cursor-pointer">
          <Download size={14} /> Download All Reports
        </a>
      </div>

      {abnormal.length > 0 && (
        <div className="flex items-start gap-3 bg-yellow-50 border-[1.5px] border-yellow-300 rounded-xl py-3.5 px-[18px] mb-5">
          <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400 shrink-0" />
          <div>
            <div className="text-sm font-bold text-yellow-800 mb-1">Attention Required</div>
            <div className="text-[13px] text-yellow-800">
              {abnormal.length} value(s) flagged outside the reference range. Please consult your doctor.
            </div>
          </div>
        </div>
      )}

      {/* Trend Chart */}
      <div className="bg-card border border-border rounded-2xl p-6 mb-5 card-shadow">
        <h3 className="text-base font-bold text-foreground mb-4 font-['Plus_Jakarta_Sans',sans-serif]">Recent Results</h3>
        {results.isLoading && <QueryLoading text="Loading results…" />}
        {results.isError && <QueryError error={results.error} onRetry={() => void results.refetch()} />}
        {!results.isLoading && !results.isError && (
          recent.length === 0 ? (
            <InlineEmpty text="No released results yet." />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={recent.map((row, index) => ({ label: `#${index + 1}`, value: Number(row.valueNumeric ?? 0) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4 }} name="Result" />
              </LineChart>
            </ResponsiveContainer>
          )
        )}
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 2fr" }}>
        {/* Order List */}
        <div className="bg-card border border-border rounded-2xl p-6 card-shadow">
          <h3 className="text-[15px] font-bold text-foreground mb-3.5 font-['Plus_Jakarta_Sans',sans-serif]">Lab Orders</h3>
          <div className="flex flex-col gap-2.5">
            {orderRows.map((order) => {
              const active = selectedOrder?.id === order.id;
              return (
                <button
                  key={order.id}
                  onClick={() => {
                    setSelectedOrderId(order.id);
                    setResultPage(1);
                  }}
                  className="py-3.5 px-3.5 rounded-xl cursor-pointer text-left transition-all duration-150"
                  style={{ border: `1.5px solid ${active ? "#2563eb" : "var(--border)"}`, background: active ? "var(--accent)" : "var(--muted)" }}
                >
                  <div className="text-xs font-bold text-blue-600 font-mono mb-1">{order.id.slice(0, 8)}</div>
                  <div className="text-[13px] font-bold text-foreground mb-0.5">{formatDate(order.orderedAt)}</div>
                  <div className="text-xs text-muted-foreground">
                    {order.itemCount} test{order.itemCount === 1 ? "" : "s"}
                    {order.specimens.length > 0 ? ` · ${order.specimens.join(", ")}` : ""}
                  </div>
                  <div className="mt-1.5">
                    <span className="text-[11px] font-bold px-2.5 py-[3px] rounded-full bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400">
                      {toLabel(order.status)}
                    </span>
                  </div>
                </button>
              );
            })}
            {!orders.isLoading && orderRows.length === 0 && <InlineEmpty text="No released lab orders." />}
            <ServerPager meta={orders.data?.meta} onPageChange={setPage} />
          </div>
        </div>

        {/* Results Detail */}
        <div className="bg-card border border-border rounded-2xl p-6 card-shadow">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[15px] font-bold text-foreground font-['Plus_Jakarta_Sans',sans-serif]">
              Results{selectedOrder ? ` — ${formatDate(selectedOrder.orderedAt)}` : ""}
            </h3>
            <a href="/api/v1/exports/lab-results?format=xlsx" className="flex items-center gap-1 py-[7px] px-3.5 bg-muted text-blue-600 border border-blue-200 rounded-lg text-xs font-semibold cursor-pointer">
              <Download size={13} /> XLSX
            </a>
          </div>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b-2 border-border">
                {["Result ID", "Value", "Unit", "Flag", "Released"].map((h) => (
                  <th key={h} className="py-2 px-3 text-left text-xs font-bold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {released.map((row) => {
                const flagged = Boolean(row.flag && row.flag !== "NORMAL");
                return (
                  <tr key={row.id} className={cn("border-b border-border", flagged && "bg-amber-50 dark:bg-amber-950/20")}>
                    <td className="py-3 px-3 font-mono text-xs text-muted-foreground">{row.id.slice(0, 8)}</td>
                    <td className={cn("py-3 px-3 font-mono font-bold text-sm", flagged ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400")}>
                      {row.valueNumeric ?? row.valueText ?? "—"}
                    </td>
                    <td className="py-3 px-3 text-muted-foreground font-mono text-xs">{row.unit ?? "—"}</td>
                    <td className="py-3 px-3">
                      <span className={cn("text-[11px] font-bold px-2.5 py-[3px] rounded-full", flagged ? "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400" : "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400")}>
                        {row.flag ? toLabel(row.flag) : "Normal"}
                      </span>
                      {row.critical && <span className="ml-1 text-[11px] font-bold text-red-600">CRITICAL</span>}
                    </td>
                    <td className="py-3 px-3 text-xs text-muted-foreground">
                      {row.releasedAt ? formatDateTime(row.releasedAt) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!results.isLoading && released.length === 0 && <InlineEmpty text="No released results for this order." />}
          <ServerPager meta={results.data?.meta} onPageChange={setResultPage} />
        </div>
      </div>
    </div>
  );
}
