import { useState } from "react";
import { Link } from "react-router";
import { CheckCircle, Clock, AlertTriangle, Activity, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { QueryError, QueryLoading, InlineEmpty } from "@/components/globals/query-state";
import {
  useAnalyteIndex,
  useCollectSpecimen,
  useCriticalResults,
  useLabDashboard,
  useLabOrders,
  useLabResults,
  useReleaseLabOrder,
} from "@/hooks/laboratory/laboratory.hooks";
import { errorMessage } from "@/services/api/api-error";
import type { LabOrder } from "@/services/laboratory/laboratory.api";

const badgeClass: Record<string, string> = {
  PENDING: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
  COLLECTED: "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400",
  IN_PROGRESS: "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400",
  RESULTED: "bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-400",
  RELEASED: "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400",
  CANCELLED: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
  ROUTINE: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
  URGENT: "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400",
  STAT: "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400",
  HIGH: "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400",
  LOW: "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400",
  CRITICAL: "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400",
  NORMAL: "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400",
};

function Badge({ status }: { status: string }) {
  const label = status.replaceAll("_", " ");
  const cls = badgeClass[status] ?? badgeClass["ROUTINE"];
  return (
    <span className={cn("text-[11px] font-bold px-2.5 py-0.5 rounded-full", cls)}>{label}</span>
  );
}

const panelStyles = [
  { icon: Clock, bg: "bg-amber-100 dark:bg-amber-950", color: "text-amber-600" },
  { icon: Activity, bg: "bg-blue-100 dark:bg-blue-950", color: "text-blue-600" },
  { icon: CheckCircle, bg: "bg-green-100 dark:bg-green-950", color: "text-green-600" },
  { icon: AlertTriangle, bg: "bg-red-100 dark:bg-red-950", color: "text-red-600" },
];

const shortId = (id: string) => id.slice(0, 8).toUpperCase();

export default function LabDashboard() {
  const dashboard = useLabDashboard();
  const orders = useLabOrders({ pageSize: 10 });
  const nameSource = useLabOrders({ pageSize: 200 });
  const critical = useCriticalResults();
  const results = useLabResults({ pageSize: 8 });
  const analytes = useAnalyteIndex();

  const collect = useCollectSpecimen();
  const release = useReleaseLabOrder();
  const [actionError, setActionError] = useState<string | null>(null);

  const nameByPatientId = new Map(
    (nameSource.data?.rows ?? []).map((order) => [order.patientId, order.patientName]),
  );

  const panels = dashboard.data?.panels ?? [];
  const pendingCount = panels.find((panel) => panel.label === "Pending Orders")?.value ?? 0;
  const criticalRow = (critical.data ?? [])[0];
  const criticalAnalyte = criticalRow ? analytes.data.get(criticalRow.analyteId) : undefined;

  const runAction = (action: () => Promise<unknown>) => {
    setActionError(null);
    action().catch((error: unknown) => setActionError(errorMessage(error, "Action failed.")));
  };

  const renderAction = (order: LabOrder) => {
    if (order.status === "PENDING") {
      return (
        <button
          onClick={() => runAction(() => collect.mutateAsync({ orderId: order.id, input: {} }))}
          disabled={collect.isPending}
          className="px-3 py-1.5 bg-cyan-600 text-white border-none rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap disabled:opacity-50"
        >
          → Collect Sample
        </button>
      );
    }
    if (order.status === "COLLECTED" || order.status === "IN_PROGRESS") {
      return (
        <Link
          to={`/lab/results-entry?order=${order.id}`}
          className="px-3 py-1.5 bg-cyan-600 text-white border-none rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
        >
          → Enter Results
        </Link>
      );
    }
    if (order.status === "RESULTED") {
      return (
        <button
          onClick={() =>
            runAction(() =>
              release.mutateAsync({ orderId: order.id, input: { acknowledgedCriticalIds: [] } }),
            )
          }
          disabled={release.isPending}
          className="px-3 py-1.5 bg-green-600 text-white border-none rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap disabled:opacity-50"
        >
          → Release
        </button>
      );
    }
    return (
      <Link
        to={`/lab/results-entry?order=${order.id}`}
        className="px-3 py-1.5 bg-muted text-blue-600 border border-blue-600 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1"
      >
        <Upload size={11} /> Results
      </Link>
    );
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-foreground mb-1">Clinical Laboratory 🧪</h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}{" "}
          · {pendingCount} pending test {pendingCount === 1 ? "request" : "requests"}
        </p>
      </div>

      {/* Stats */}
      {dashboard.isLoading ? (
        <QueryLoading className="mb-6" text="Loading laboratory counters…" />
      ) : dashboard.isError ? (
        <QueryError error={dashboard.error} onRetry={() => void dashboard.refetch()} className="mb-6" />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {panels.map((panel, index) => {
            const style = panelStyles[index % panelStyles.length];
            const Icon = style.icon;
            return (
              <div
                key={panel.label}
                className="bg-card border border-border rounded-2xl p-5 flex gap-3.5 items-center card-shadow"
              >
                <div
                  className={cn(
                    "w-[46px] h-[46px] rounded-[14px] flex items-center justify-center",
                    style.bg,
                  )}
                >
                  <Icon size={20} className={style.color} />
                </div>
                <div>
                  <div className="text-[22px] font-extrabold text-foreground">{panel.value}</div>
                  <div className="text-xs text-muted-foreground">{panel.label}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Critical Alert */}
      {criticalRow && (
        <div className="flex items-center gap-3 bg-red-100 dark:bg-red-950/30 border-[1.5px] border-red-200 dark:border-red-800 rounded-xl py-3.5 px-4 mb-5">
          <AlertTriangle size={20} className="text-red-600 shrink-0" />
          <div className="flex-1">
            <span className="text-sm font-extrabold text-red-900 dark:text-red-300">
              ⚠ CRITICAL VALUE:{" "}
            </span>
            <span className="text-[13px] text-red-900 dark:text-red-400">
              {nameByPatientId.get(criticalRow.patientId) ?? `Patient ${shortId(criticalRow.patientId)}`}{" "}
              — {criticalAnalyte?.name ?? shortId(criticalRow.analyteId)}{" "}
              {criticalRow.valueNumeric ?? criticalRow.valueText ?? "—"}
              {criticalRow.unit ? ` ${criticalRow.unit}` : ""} ({criticalRow.flag ?? "CRITICAL"}).{" "}
            </span>
            <span className="text-[13px] font-bold text-red-600">
              Notify the ordering physician immediately.
            </span>
          </div>
          <Link
            to={`/lab/results-entry?order=${criticalRow.labOrderId}`}
            className="px-4 py-2 bg-red-600 text-white border-none rounded-lg text-[13px] font-bold cursor-pointer shrink-0"
          >
            Review Result
          </Link>
        </div>
      )}

      {actionError && (
        <div className="text-[13px] font-semibold text-red-600 dark:text-red-400 mb-4">
          {actionError}
        </div>
      )}

      {/* Test Requests */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-5 card-shadow">
        <h3 className="text-base font-bold text-foreground mb-4">Active Test Requests</h3>
        {orders.isLoading ? (
          <QueryLoading text="Loading test requests…" />
        ) : orders.isError ? (
          <QueryError error={orders.error} onRetry={() => void orders.refetch()} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b-2 border-border">
                  {["Lab ID", "Patient", "Specimens", "Tests", "Priority", "Ordered", "Status", "Action"].map(
                    (header) => (
                      <th
                        key={header}
                        className="text-left py-2 px-3 text-xs font-bold text-muted-foreground"
                      >
                        {header}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {(orders.data?.rows ?? []).map((order) => (
                  <tr key={order.id} className="border-b border-border">
                    <td className="py-3 px-3 font-mono text-xs text-blue-600 font-bold">
                      {shortId(order.id)}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-foreground">{order.patientName}</div>
                      <div className="text-[11px] text-muted-foreground">MRN {order.mrn}</div>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-muted-foreground">
                      {order.specimens.length > 0 ? order.specimens.join(", ") : "—"}
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-[11px] px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-semibold">
                        {order.itemCount} {order.itemCount === 1 ? "test" : "tests"}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <Badge status={order.priority} />
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-muted-foreground">
                      {new Date(order.orderedAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3 px-3">
                      <Badge status={order.status} />
                    </td>
                    <td className="py-3 px-3">{renderAction(order)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(orders.data?.rows ?? []).length === 0 && (
              <InlineEmpty text="No test requests in the laboratory queue." />
            )}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="bg-card border border-border rounded-2xl p-5 card-shadow">
        <h3 className="text-base font-bold text-foreground mb-4">Recent Lab Results</h3>
        {results.isLoading ? (
          <QueryLoading text="Loading recent results…" />
        ) : results.isError ? (
          <QueryError error={results.error} onRetry={() => void results.refetch()} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b-2 border-border">
                  {["Patient", "Test", "Result", "Reference Range", "Flag"].map((header) => (
                    <th
                      key={header}
                      className="text-left py-2 px-3 text-xs font-bold text-muted-foreground"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(results.data?.rows ?? []).map((row) => {
                  const analyte = analytes.data.get(row.analyteId);
                  const unit = row.unit ?? analyte?.unit ?? "";
                  const reference =
                    analyte?.referenceLow !== null && analyte?.referenceLow !== undefined
                      ? `${analyte.referenceLow} – ${analyte.referenceHigh ?? "—"} ${unit}`.trim()
                      : "—";
                  return (
                    <tr
                      key={row.id}
                      className={cn("border-b border-border", row.critical && "bg-red-50 dark:bg-red-950/20")}
                    >
                      <td className="py-3 px-3 font-semibold text-foreground">
                        {nameByPatientId.get(row.patientId) ?? shortId(row.patientId)}
                      </td>
                      <td className="py-3 px-3 text-foreground">{analyte?.name ?? shortId(row.analyteId)}</td>
                      <td
                        className={cn(
                          "py-3 px-3 font-mono font-bold",
                          row.flag === "HIGH" || row.flag === "CRITICAL" || row.critical
                            ? "text-red-600 dark:text-red-400"
                            : "text-green-600 dark:text-green-400",
                        )}
                      >
                        {row.valueNumeric ?? row.valueText ?? "—"} {unit}
                      </td>
                      <td className="py-3 px-3 font-mono text-xs text-muted-foreground">{reference}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <Badge status={row.flag ?? "NORMAL"} />
                          {row.critical && <AlertTriangle size={14} className="text-red-600" />}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {(results.data?.rows ?? []).length === 0 && (
              <InlineEmpty text="No results have been entered yet." />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
