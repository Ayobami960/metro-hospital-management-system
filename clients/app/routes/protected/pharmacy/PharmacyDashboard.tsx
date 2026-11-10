import { useState } from "react";
import { toast } from "sonner";
import { Pill, AlertTriangle, CheckCircle, Users, Search } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

import {
  useMarkOrderReady,
  usePharmacyDashboard,
  useProcessOrder,
} from "@/hooks/pharmacy/pharmacy.hooks";
import { QueryError, QueryLoading, InlineEmpty } from "@/components/globals/query-state";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { errorMessage } from "@/services/api/api-error";
import { formatDate, formatTime, isoDate, label as toLabel, relativeTime } from "@/lib/format";

const statusStyle: Record<string, { bg: string; color: string }> = {
  NEW: { bg: "#dbeafe", color: "#2563eb" },
  PROCESSING: { bg: "#fef9c3", color: "#ca8a04" },
  READY: { bg: "#dcfce7", color: "#16a34a" },
  DISPENSED: { bg: "#f1f5f9", color: "#64748b" },
  CANCELLED: { bg: "#fee2e2", color: "#dc2626" },
  OK: { bg: "#dcfce7", color: "#16a34a" },
  LOW: { bg: "#fef9c3", color: "#ca8a04" },
  CRITICAL: { bg: "#fee2e2", color: "#dc2626" },
  OUT_OF_STOCK: { bg: "#fee2e2", color: "#dc2626" },
};

function Badge({ status }: { status: string }) {
  const style = statusStyle[status] ?? statusStyle.OK;
  return (
    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full" style={{ backgroundColor: style.bg, color: style.color }}>
      {toLabel(status)}
    </span>
  );
}

export default function PharmacyDashboard() {
  const [activeTab, setActiveTab] = useState<"prescriptions" | "inventory">("prescriptions");
  const [searchValue, setSearchValue] = useState("");

  const dashboard = usePharmacyDashboard();
  const processOrder = useProcessOrder();
  const markReady = useMarkOrderReady();
  const search = useDebouncedValue(searchValue).toLowerCase();

  if (dashboard.isLoading) {
    return (
      <div className="p-6">
        <QueryLoading text="Loading the pharmacy queue…" />
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

  const { stats, queue, lowStock, weeklyDispensed } = dashboard.data;

  const filteredQueue = queue.filter(
    (order) => !search || order.patientName.toLowerCase().includes(search) || order.id.toLowerCase().includes(search),
  );
  const filteredStock = lowStock.filter(
    (item) => !search || item.name.toLowerCase().includes(search) || (item.genericName ?? "").toLowerCase().includes(search),
  );

  const cards = [
    { label: "Pending Orders", value: String(stats.pendingOrders), sub: `${stats.dispensedToday} dispensed today`, icon: Pill, bg: "#dbeafe", color: "#2563eb" },
    { label: "Low Stock", value: String(stats.lowStockCount), sub: `${stats.criticalStockCount} critical`, icon: AlertTriangle, bg: "#fef9c3", color: "#ca8a04" },
    { label: "Expiring Soon", value: String(stats.expiringSoon), sub: "within near-expiry window", icon: AlertTriangle, bg: "#fee2e2", color: "#dc2626" },
    { label: "Dispensed Today", value: String(stats.dispensedToday), sub: "completed orders", icon: CheckCircle, bg: "#dcfce7", color: "#16a34a" },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-foreground mb-1">Central Pharmacy 💊</h1>
        <p className="text-sm text-muted-foreground">
          {formatDate(isoDate())} · {stats.pendingOrders} orders pending
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-card border border-border rounded-2xl p-5 flex gap-3.5 items-center">
              <div className="w-[46px] h-[46px] rounded-[14px] flex items-center justify-center" style={{ backgroundColor: card.bg }}>
                <Icon size={20} style={{ color: card.color }} />
              </div>
              <div>
                <div className="text-[22px] font-extrabold text-foreground">{card.value}</div>
                <div className="text-xs text-muted-foreground">{card.label}</div>
                <div className="text-[11px] font-semibold" style={{ color: card.color }}>{card.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {/* Main Table */}
        <div className="bg-card border border-border rounded-2xl p-5 lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-0">
              {(["prescriptions", "inventory"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer border-none transition-colors ${
                    activeTab === tab ? "bg-blue-600 text-white" : "text-muted-foreground bg-transparent"
                  }`}
                >
                  {tab === "prescriptions" ? "💊 Prescriptions" : "📦 Inventory"}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Search..."
                className="pl-8 pr-2.5 py-2 border border-border rounded-lg text-[13px] bg-muted text-foreground outline-none w-44"
              />
            </div>
          </div>

          {activeTab === "prescriptions" ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b-2 border-border">
                    {["Order", "Patient", "Priority", "Status", "Received", "Action"].map((h) => (
                      <th key={h} className="text-left py-2 px-3 text-xs font-bold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredQueue.map((order) => (
                    <tr key={order.id} className="border-b border-border">
                      <td className="py-3 px-3 font-mono text-xs text-blue-600 font-bold">{order.id.slice(0, 8)}</td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-foreground">{order.patientName}</div>
                        <div className="text-[11px] text-muted-foreground">{toLabel(order.priority)} priority</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-[11px] font-bold" style={{ color: order.priority === "STAT" ? "#dc2626" : order.priority === "URGENT" ? "#d97706" : "var(--muted-foreground)" }}>
                          {toLabel(order.priority)}
                        </span>
                      </td>
                      <td className="py-3 px-3"><Badge status={order.status} /></td>
                      <td className="py-3 px-3 text-xs text-muted-foreground">{formatTime(order.receivedAt)}</td>
                      <td className="py-3 px-3">
                        {order.status === "NEW" && (
                          <button
                            onClick={() =>
                              processOrder.mutate(order.id, {
                                onSuccess: () => toast.success("Order moved to processing"),
                                onError: (error) => toast.error(errorMessage(error, "Could not process the order.")),
                              })
                            }
                            className="px-3 py-1.5 bg-blue-600 text-white border-none rounded-lg text-xs font-semibold cursor-pointer"
                          >
                            Process
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
                            className="px-3 py-1.5 bg-green-600 text-white border-none rounded-lg text-xs font-semibold cursor-pointer"
                          >
                            Mark Ready
                          </button>
                        )}
                        {(order.status === "READY" || order.status === "DISPENSED" || order.status === "CANCELLED") && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredQueue.length === 0 && <InlineEmpty text="No orders in the queue." />}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b-2 border-border">
                    {["Drug", "On Hand", "Reorder Level", "Status", "Nearest Expiry"].map((h) => (
                      <th key={h} className="text-left py-2 px-3 text-xs font-bold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredStock.map((item) => (
                    <tr key={item.id} className="border-b border-border">
                      <td className="py-3 px-3">
                        <div className="font-semibold text-foreground">{item.name}</div>
                        <div className="text-[11px] text-muted-foreground">{item.genericName ?? item.form ?? "—"}</div>
                      </td>
                      <td className="py-3 px-3 font-mono text-foreground">{item.onHand} {item.unit ?? ""}</td>
                      <td className="py-3 px-3 font-mono text-muted-foreground">{item.reorderLevel}</td>
                      <td className="py-3 px-3"><Badge status={item.derivedStatus} /></td>
                      <td className="py-3 px-3 text-xs text-muted-foreground">
                        {item.nearestExpiry ? formatDate(item.nearestExpiry) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredStock.length === 0 && <InlineEmpty text="No stock alerts right now." />}
            </div>
          )}
        </div>

        {/* Weekly dispensed */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-base font-bold text-foreground mb-4">Dispensed This Week</h3>
          {weeklyDispensed.length === 0 ? (
            <InlineEmpty text="No dispensing recorded this week." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weeklyDispensed} barSize={22}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]} name="Dispensed" />
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="mt-3 text-[11px] text-muted-foreground flex items-center gap-1.5">
            <Users size={11} />
            {queue[0] ? `Oldest queued order received ${relativeTime(queue[0].receivedAt)}` : "Queue empty"}
          </div>
        </div>
      </div>
    </div>
  );
}
