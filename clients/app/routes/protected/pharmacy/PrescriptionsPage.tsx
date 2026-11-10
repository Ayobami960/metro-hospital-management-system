import { useState } from "react";
import { toast } from "sonner";
import { Pill, Clock, CheckCircle, Package, Search, AlertTriangle } from "lucide-react";

import {
  useMarkOrderReady,
  usePharmacyOrders,
  useProcessOrder,
} from "@/hooks/pharmacy/pharmacy.hooks";
import { QueryError, QueryLoading, InlineEmpty } from "@/components/globals/query-state";
import { ServerPager } from "@/components/globals/server-pager";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { errorMessage } from "@/services/api/api-error";
import { formatDateTime, label as toLabel } from "@/lib/format";

const statusColors: Record<string, { bg: string; color: string }> = {
  NEW: { bg: "#dbeafe", color: "#2563eb" },
  PROCESSING: { bg: "#fef9c3", color: "#ca8a04" },
  READY: { bg: "#dcfce7", color: "#16a34a" },
  DISPENSED: { bg: "#f1f5f9", color: "#64748b" },
  CANCELLED: { bg: "#fee2e2", color: "#dc2626" },
};

const TABS = ["ALL", "NEW", "PROCESSING", "READY", "DISPENSED"] as const;

export default function PrescriptionsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("ALL");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const orders = usePharmacyOrders({
    page,
    pageSize: 15,
    status: tab === "ALL" ? undefined : tab,
    search: useDebouncedValue(search) || undefined,
  });
  const processOrder = useProcessOrder();
  const markReady = useMarkOrderReady();

  const rows = orders.data?.rows ?? [];
  const counts = {
    all: orders.data?.meta.total ?? rows.length,
  };

  const stats = [
    { label: "In Queue", value: String(rows.filter((row) => row.status === "NEW").length), icon: Pill, color: "#2563eb", bg: "#dbeafe" },
    { label: "Processing", value: String(rows.filter((row) => row.status === "PROCESSING").length), icon: Clock, color: "#ca8a04", bg: "#fef9c3" },
    { label: "Ready for Pickup", value: String(rows.filter((row) => row.status === "READY").length), icon: CheckCircle, color: "#16a34a", bg: "#dcfce7" },
    { label: "Dispensed", value: String(rows.filter((row) => row.status === "DISPENSED").length), icon: Package, color: "#7c3aed", bg: "#ede9fe" },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-[26px] font-extrabold text-foreground mb-1 font-['Plus_Jakarta_Sans',sans-serif]">Prescriptions Queue</h1>
        <p className="text-muted-foreground text-[15px]">Manage incoming prescriptions and track dispensing status</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-card border border-border rounded-2xl p-6 flex gap-3.5 items-center">
              <div className="w-[46px] h-[46px] rounded-[14px] flex items-center justify-center shrink-0" style={{ backgroundColor: stat.bg }}>
                <Icon size={20} color={stat.color} />
              </div>
              <div>
                <div className="text-[26px] font-extrabold text-foreground font-['Plus_Jakarta_Sans',sans-serif] leading-none">{stat.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex justify-between items-center mb-5 flex-wrap gap-3">
          <div className="flex gap-1 bg-muted p-1 rounded-[10px]">
            {TABS.map((option) => (
              <button
                key={option}
                onClick={() => {
                  setTab(option);
                  setPage(1);
                }}
                className="py-[7px] px-4 border-none rounded-[7px] cursor-pointer text-[13px] font-semibold transition-all"
                style={{
                  background: tab === option ? "var(--card)" : "transparent",
                  color: tab === option ? "var(--foreground)" : "var(--muted-foreground)",
                  boxShadow: tab === option ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                }}
              >
                {option === "ALL" ? "All" : toLabel(option)}
                {option === "ALL" && (
                  <span className="ml-1.5 text-[11px] font-mono py-px px-1.5 rounded-full bg-blue-100 text-blue-600">{counts.all}</span>
                )}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search patient or drug..."
              className="py-2 px-3 pl-8 border border-border rounded-lg text-[13px] bg-muted text-foreground outline-none w-60"
            />
          </div>
        </div>

        {orders.isLoading && <QueryLoading text="Loading prescriptions…" />}
        {orders.isError && <QueryError error={orders.error} onRetry={() => void orders.refetch()} />}

        {!orders.isLoading && !orders.isError && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b-2 border-border">
                    {["Order", "Patient", "Drugs", "Prescriber", "Received", "Status", "Actions"].map((h) => (
                      <th key={h} className="py-2.5 px-3.5 text-left text-xs font-bold text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((order) => {
                    const colors = statusColors[order.status] ?? statusColors.NEW;
                    return (
                      <tr key={order.id} className="border-b border-border">
                        <td className="p-3.5 font-mono text-xs text-blue-600 font-bold">{order.id.slice(0, 8)}</td>
                        <td className="p-3.5">
                          <div className="font-semibold text-foreground">{order.patientName}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">{order.mrn}</div>
                        </td>
                        <td className="p-3.5">
                          <div className="font-semibold text-foreground flex items-center gap-1.5">
                            {order.drugNames.join(", ") || "—"}
                            {order.hasInteractions && (
                              <span title="Interaction warning" className="w-[18px] h-[18px] rounded-full bg-red-100 inline-flex items-center justify-center">
                                <AlertTriangle size={10} className="text-red-600" />
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {order.itemCount} item(s) · {toLabel(order.priority)}
                          </div>
                        </td>
                        <td className="p-3.5 text-muted-foreground">{order.prescriber ?? "—"}</td>
                        <td className="p-3.5 font-mono text-xs text-muted-foreground">{formatDateTime(order.receivedAt)}</td>
                        <td className="p-3.5">
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: colors.bg, color: colors.color }}>
                            {toLabel(order.status)}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <div className="flex gap-2">
                            {order.status === "NEW" && (
                              <button
                                onClick={() =>
                                  processOrder.mutate(order.id, {
                                    onSuccess: () => toast.success("Order moved to processing"),
                                    onError: (error) => toast.error(errorMessage(error, "Could not process the order.")),
                                  })
                                }
                                className="py-1.5 px-3.5 bg-blue-600 text-white border-none rounded-[7px] text-xs font-semibold cursor-pointer whitespace-nowrap"
                              >
                                Start Processing
                              </button>
                            )}
                            {order.status === "PROCESSING" && (
                              <button
                                onClick={() =>
                                  markReady.mutate(order.id, {
                                    onSuccess: () => toast.success("Order marked ready"),
                                    onError: (error) => toast.error(errorMessage(error, "Could not update the order.")),
                                  })
                                }
                                className="py-1.5 px-3.5 bg-green-600 text-white border-none rounded-[7px] text-xs font-semibold cursor-pointer whitespace-nowrap"
                              >
                                Mark Ready
                              </button>
                            )}
                            {(order.status === "READY" || order.status === "DISPENSED") && (
                              <a href="/pharmacy/dispense" className="text-xs text-blue-600 font-bold">
                                {order.status === "READY" ? "Dispense →" : "Completed"}
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {rows.length === 0 && <InlineEmpty text="No prescriptions match these filters." />}
            <ServerPager meta={orders.data?.meta} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
