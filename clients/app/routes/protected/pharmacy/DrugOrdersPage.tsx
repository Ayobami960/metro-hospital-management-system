import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, X, ShoppingCart, Truck, CheckCircle, Clock, XCircle } from "lucide-react";

import { usePurchaseOrderActions, usePurchaseOrders } from "@/hooks/pharmacy/pharmacy.hooks";
import { useDrugs } from "@/hooks/clinical/clinical.hooks";
import { QueryError, QueryLoading, InlineEmpty } from "@/components/globals/query-state";
import { ServerPager } from "@/components/globals/server-pager";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { errorMessage } from "@/services/api/api-error";
import { formatDate, label as toLabel, money } from "@/lib/format";

const statusColors: Record<string, { bg: string; color: string }> = {
  DRAFT: { bg: "#fef9c3", color: "#ca8a04" },
  SUBMITTED: { bg: "#fef9c3", color: "#ca8a04" },
  SHIPPED: { bg: "#dbeafe", color: "#2563eb" },
  PARTIALLY_RECEIVED: { bg: "#ede9fe", color: "#7c3aed" },
  RECEIVED: { bg: "#dcfce7", color: "#16a34a" },
  CANCELLED: { bg: "#f1f5f9", color: "#64748b" },
};

const statusIcons: Record<string, React.ReactNode> = {
  DRAFT: <Clock size={14} />,
  SUBMITTED: <Clock size={14} />,
  SHIPPED: <Truck size={14} />,
  PARTIALLY_RECEIVED: <Truck size={14} />,
  RECEIVED: <CheckCircle size={14} />,
  CANCELLED: <XCircle size={14} />,
};

const inputClass =
  "w-full py-2.5 px-3 border border-border rounded-lg text-[13px] bg-muted text-foreground outline-none box-border";

type OrderAction = "submit" | "ship" | "cancel";

const nextAction = (status: string): { action: OrderAction; label: string } | null => {
  if (status === "DRAFT") return { action: "submit", label: "Submit" };
  if (status === "SUBMITTED") return { action: "ship", label: "Mark Shipped" };
  return null;
};

const canCancel = (status: string) =>
  ["DRAFT", "SUBMITTED", "SHIPPED", "PARTIALLY_RECEIVED"].includes(status);

export default function DrugOrdersPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [drugSearch, setDrugSearch] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [expectedDeliveryAt, setExpectedDeliveryAt] = useState("");
  const [items, setItems] = useState([{ drugId: "", quantity: "", unitCost: "" }]);

  const orders = usePurchaseOrders({ page, pageSize: 10, status: status || undefined });
  // Status counters and the supplier picker both need the full order book,
  // not just the current page.
  const allOrders = usePurchaseOrders({ pageSize: 200 });
  const drugs = useDrugs(useDebouncedValue(drugSearch) || undefined);
  const actions = usePurchaseOrderActions();

  const rows = orders.data?.rows ?? [];

  /** No supplier directory endpoint exists; derive the known suppliers from purchase orders. */
  const suppliers = useMemo(() => {
    const map = new Map<string, string>();
    for (const order of allOrders.data?.rows ?? []) map.set(order.supplierId, order.supplier);
    return [...map].map(([id, name]) => ({ id, name }));
  }, [allOrders.data]);

  const counts = useMemo(() => {
    const all = allOrders.data?.rows ?? [];
    return {
      total: allOrders.data?.meta?.total ?? all.length,
      pending: all.filter((order) => order.status === "DRAFT" || order.status === "SUBMITTED").length,
      transit: all.filter((order) => order.status === "SHIPPED" || order.status === "PARTIALLY_RECEIVED").length,
      received: all.filter((order) => order.status === "RECEIVED").length,
    };
  }, [allOrders.data]);

  const stats = [
    { label: "Total Orders", value: counts.total, icon: ShoppingCart, color: "#2563eb", bg: "#dbeafe" },
    { label: "Pending", value: counts.pending, icon: Clock, color: "#ca8a04", bg: "#fef9c3" },
    { label: "In Transit", value: counts.transit, icon: Truck, color: "#7c3aed", bg: "#ede9fe" },
    { label: "Delivered", value: counts.received, icon: CheckCircle, color: "#16a34a", bg: "#dcfce7" },
  ];

  const runAction = async (orderId: string, action: OrderAction) => {
    try {
      await actions[action].mutateAsync(orderId);
      toast.success(
        action === "submit" ? "Purchase order submitted" : action === "ship" ? "Purchase order shipped" : "Purchase order cancelled",
      );
    } catch (error) {
      toast.error(errorMessage(error, "Could not update the purchase order."));
    }
  };

  const resetForm = () => {
    setSupplierId("");
    setExpectedDeliveryAt("");
    setItems([{ drugId: "", quantity: "", unitCost: "" }]);
    setDrugSearch("");
  };

  const submit = async () => {
    if (!supplierId) {
      toast.error("Select a supplier.");
      return;
    }
    const parsed = items
      .filter((item) => item.drugId && item.quantity && item.unitCost)
      .map((item) => ({
        drugId: item.drugId,
        quantity: Number(item.quantity),
        unitCostMinor: Math.round(Number(item.unitCost) * 100),
      }));
    if (parsed.length === 0) {
      toast.error("Add at least one drug line with quantity and unit cost.");
      return;
    }
    try {
      await actions.create.mutateAsync({
        supplierId,
        expectedDeliveryAt: expectedDeliveryAt ? new Date(expectedDeliveryAt).toISOString() : undefined,
        items: parsed,
      });
      toast.success("Purchase order created as a draft");
      setShowModal(false);
      resetForm();
    } catch (error) {
      toast.error(errorMessage(error, "Could not create the purchase order."));
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-[26px] font-extrabold text-foreground mb-1 font-['Plus_Jakarta_Sans',sans-serif]">Drug Orders</h1>
          <p className="text-muted-foreground text-[15px]">Manage procurement orders and supplier deliveries</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 py-2.5 px-5 bg-blue-600 text-white border-none rounded-[10px] text-sm font-semibold cursor-pointer">
          <Plus size={16} /> New Order
        </button>
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
        <div className="flex gap-3 mb-5 flex-wrap">
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="py-[9px] px-3.5 border border-border rounded-lg text-[13px] bg-muted text-foreground cursor-pointer outline-none"
          >
            <option value="">All statuses</option>
            {["DRAFT", "SUBMITTED", "SHIPPED", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"].map((option) => (
              <option key={option} value={option}>{toLabel(option)}</option>
            ))}
          </select>
        </div>

        {orders.isLoading && <QueryLoading text="Loading purchase orders…" />}
        {orders.isError && <QueryError error={orders.error} onRetry={() => void orders.refetch()} />}

        {!orders.isLoading && !orders.isError && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b-2 border-border">
                    {["Order ID", "Supplier", "Items", "Order Date", "Expected Delivery", "Total", "Status", "Actions"].map((heading) => (
                      <th key={heading} className="py-2.5 px-3.5 text-left text-xs font-bold text-muted-foreground whitespace-nowrap">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((order) => {
                    const colors = statusColors[order.status] ?? statusColors.CANCELLED;
                    const next = nextAction(order.status);
                    return (
                      <tr key={order.id} className="border-b border-border">
                        <td className="p-3.5 font-mono text-xs text-blue-600 font-bold">{order.poNumber}</td>
                        <td className="p-3.5 font-semibold text-foreground">{order.supplier}</td>
                        <td className="p-3.5 text-muted-foreground max-w-[200px]">
                          <div className="text-xs">{order.itemCount} line{order.itemCount === 1 ? "" : "s"}</div>
                        </td>
                        <td className="p-3.5 font-mono text-xs text-muted-foreground">{formatDate(order.orderedAt)}</td>
                        <td className="p-3.5 font-mono text-xs text-muted-foreground">
                          {order.expectedDeliveryAt ? formatDate(order.expectedDeliveryAt) : "—"}
                        </td>
                        <td className="p-3.5 font-mono font-bold text-foreground">{money(order.totalMinor)}</td>
                        <td className="p-3.5">
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1 whitespace-nowrap" style={{ backgroundColor: colors.bg, color: colors.color }}>
                            {statusIcons[order.status]} {toLabel(order.status)}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <div className="flex gap-1.5">
                            {next && (
                              <button
                                onClick={() => void runAction(order.id, next.action)}
                                disabled={actions[next.action].isPending}
                                className="py-1.5 px-3 bg-blue-600 text-white border-none rounded-[7px] text-xs font-semibold cursor-pointer whitespace-nowrap disabled:opacity-60"
                              >
                                {next.label}
                              </button>
                            )}
                            {canCancel(order.status) && (
                              <button
                                onClick={() => void runAction(order.id, "cancel")}
                                disabled={actions.cancel.isPending}
                                className="py-1.5 px-3 bg-transparent text-red-600 border border-red-200 rounded-[7px] text-xs font-semibold cursor-pointer disabled:opacity-60"
                              >
                                Cancel
                              </button>
                            )}
                            {!next && !canCancel(order.status) && (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {rows.length === 0 && <InlineEmpty text="No purchase orders match this filter." />}
            <ServerPager meta={orders.data?.meta} onPageChange={setPage} />
          </>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]">
          <div className="bg-card rounded-[20px] p-8 w-[480px] max-w-[90vw] shadow-[0_20px_60px_rgba(0,0,0,0.2)] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-extrabold text-foreground font-['Plus_Jakarta_Sans',sans-serif]">New Drug Order</h2>
              <button onClick={() => setShowModal(false)} className="bg-transparent border-none cursor-pointer text-muted-foreground"><X size={20} /></button>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-[13px] font-semibold text-foreground block mb-1.5">Supplier</label>
                <select value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className={inputClass}>
                  <option value="">Select supplier...</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                  ))}
                </select>
                {suppliers.length === 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1.5 mb-0">
                    No suppliers are on record yet. A supplier directory endpoint is not available in the API, so suppliers are taken from existing purchase orders.
                  </p>
                )}
              </div>

              <div>
                <label className="text-[13px] font-semibold text-foreground block mb-1.5">Search drug</label>
                <input
                  value={drugSearch}
                  onChange={(event) => setDrugSearch(event.target.value)}
                  placeholder="Search the drug catalogue..."
                  className={inputClass}
                />
              </div>

              {items.map((item, index) => (
                <div key={index} className="border border-border rounded-xl p-3 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Line {index + 1}</span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                        className="bg-transparent border-none cursor-pointer text-red-600 p-0 flex"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <select
                    value={item.drugId}
                    onChange={(event) => setItems((prev) => prev.map((row, i) => (i === index ? { ...row, drugId: event.target.value } : row)))}
                    className={inputClass}
                  >
                    <option value="">Select drug...</option>
                    {(drugs.data ?? []).map((drug) => (
                      <option key={drug.id} value={drug.id}>{drug.name}</option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2.5">
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(event) => setItems((prev) => prev.map((row, i) => (i === index ? { ...row, quantity: event.target.value } : row)))}
                      placeholder="Quantity"
                      className={inputClass}
                    />
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.unitCost}
                      onChange={(event) => setItems((prev) => prev.map((row, i) => (i === index ? { ...row, unitCost: event.target.value } : row)))}
                      placeholder="Unit cost"
                      className={inputClass}
                    />
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => setItems((prev) => [...prev, { drugId: "", quantity: "", unitCost: "" }])}
                className="self-start bg-transparent border-none text-blue-600 text-[13px] font-semibold cursor-pointer p-0"
              >
                + Add another drug
              </button>

              <div>
                <label className="text-[13px] font-semibold text-foreground block mb-1.5">Expected Delivery Date</label>
                <input
                  type="date"
                  value={expectedDeliveryAt}
                  onChange={(event) => setExpectedDeliveryAt(event.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="flex gap-3 mt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-[11px] border border-border rounded-[10px] bg-transparent text-foreground text-sm font-semibold cursor-pointer">
                  Cancel
                </button>
                <button type="button" onClick={() => void submit()} disabled={actions.create.isPending}
                  className="flex-1 py-[11px] border-none rounded-[10px] bg-blue-600 text-white text-sm font-semibold cursor-pointer disabled:opacity-60">
                  {actions.create.isPending ? "Saving…" : "Place Order"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
