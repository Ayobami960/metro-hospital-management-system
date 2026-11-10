import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, AlertTriangle, Plus, X, Package } from "lucide-react";

import { useInventory, useInventoryAlerts, useReceiveStock } from "@/hooks/pharmacy/pharmacy.hooks";
import { useDrugs } from "@/hooks/clinical/clinical.hooks";
import { QueryError, QueryLoading, InlineEmpty } from "@/components/globals/query-state";
import { ServerPager } from "@/components/globals/server-pager";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { errorMessage } from "@/services/api/api-error";
import { formatDate, label as toLabel } from "@/lib/format";

const statusColors: Record<string, { bg: string; color: string }> = {
  OK: { bg: "#dcfce7", color: "#16a34a" },
  LOW: { bg: "#fef9c3", color: "#ca8a04" },
  CRITICAL: { bg: "#fee2e2", color: "#dc2626" },
  OUT_OF_STOCK: { bg: "#fee2e2", color: "#dc2626" },
  NEAR_EXPIRY: { bg: "#ffedd5", color: "#ea580c" },
};

const inputClass =
  "w-full py-2.5 px-3 border border-border rounded-lg text-[13px] bg-muted text-foreground outline-none box-border";

export default function InventoryPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [drugSearch, setDrugSearch] = useState("");
  const [form, setForm] = useState({ drugId: "", quantity: "", batchNumber: "", expiryDate: "" });

  const inventory = useInventory({
    page,
    pageSize: 20,
    search: useDebouncedValue(search) || undefined,
    derivedStatus: status || undefined,
  });
  const alerts = useInventoryAlerts();
  const drugs = useDrugs(useDebouncedValue(drugSearch) || undefined);
  const receiveStock = useReceiveStock();

  const rows = inventory.data?.rows ?? [];

  const grouped = useMemo(
    () => ({
      outOfStock: [...(alerts.data?.outOfStock ?? []), ...(alerts.data?.expired ?? [])],
      nearExpiry: alerts.data?.nearExpiry ?? [],
      low: alerts.data?.lowStock ?? [],
    }),
    [alerts.data],
  );
  const alertCount = grouped.outOfStock.length + grouped.nearExpiry.length + grouped.low.length;

  const submit = async () => {
    if (!form.drugId || !form.quantity || !form.batchNumber || !form.expiryDate) {
      toast.error("Drug, quantity, batch and expiry are required.");
      return;
    }
    try {
      await receiveStock.mutateAsync({
        drugId: form.drugId,
        quantity: Number(form.quantity),
        batchNumber: form.batchNumber,
        expiryDate: form.expiryDate,
      });
      toast.success("Stock received");
      setShowModal(false);
      setForm({ drugId: "", quantity: "", batchNumber: "", expiryDate: "" });
    } catch (error) {
      toast.error(errorMessage(error, "Could not record the stock receipt."));
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-[26px] font-extrabold text-foreground mb-1 font-['Plus_Jakarta_Sans',sans-serif]">Drug Inventory</h1>
          <p className="text-muted-foreground text-[15px]">Monitor stock levels, expiry dates, and reorder points</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 py-2.5 px-5 bg-blue-600 text-white border-none rounded-[10px] text-sm font-semibold cursor-pointer">
          <Plus size={16} /> Add Stock
        </button>
      </div>

      {alertCount > 0 && (
        <div className="mb-5 flex flex-col gap-2.5">
          {grouped.outOfStock.length > 0 && (
            <div className="bg-red-100 border border-red-200 rounded-xl py-3.5 px-[18px] flex gap-2.5 items-start">
              <AlertTriangle size={18} color="#dc2626" className="shrink-0 mt-px" />
              <div>
                <div className="text-sm font-bold text-red-900 mb-1">Critical Stock Alert</div>
                <div className="text-[13px] text-red-800">
                  {grouped.outOfStock.map((item) => `${item.name} (${item.onHand} ${item.unit ?? ""})`).join(", ")} — immediate reorder required
                </div>
              </div>
            </div>
          )}
          {grouped.nearExpiry.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl py-3.5 px-[18px] flex gap-2.5 items-start">
              <AlertTriangle size={18} color="#ea580c" className="shrink-0 mt-px" />
              <div>
                <div className="text-sm font-bold text-orange-900 mb-1">Near Expiry Alert</div>
                <div className="text-[13px] text-orange-800">
                  {grouped.nearExpiry
                    .map((item) => `${item.name} (exp. ${item.nearestExpiry ? formatDate(item.nearestExpiry) : "—"})`)
                    .join(", ")}
                </div>
              </div>
            </div>
          )}
          {grouped.low.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl py-3.5 px-[18px] flex gap-2.5 items-start">
              <Package size={18} color="#ca8a04" className="shrink-0 mt-px" />
              <div>
                <div className="text-sm font-bold text-yellow-800 mb-1">Low Stock Warning</div>
                <div className="text-[13px] text-yellow-800">
                  {grouped.low.map((item) => `${item.name} (${item.onHand} ${item.unit ?? ""})`).join(", ")}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex gap-3 mb-5 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by drug name or NDC code..."
              className="w-full py-[9px] px-3 pl-8 border border-border rounded-lg text-[13px] bg-muted text-foreground outline-none box-border"
            />
          </div>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="py-[9px] px-3.5 border border-border rounded-lg text-[13px] bg-muted text-foreground cursor-pointer outline-none"
          >
            <option value="">All statuses</option>
            {["OK", "LOW", "CRITICAL", "OUT_OF_STOCK", "NEAR_EXPIRY"].map((option) => (
              <option key={option} value={option}>{toLabel(option)}</option>
            ))}
          </select>
        </div>

        {inventory.isLoading && <QueryLoading text="Loading inventory…" />}
        {inventory.isError && <QueryError error={inventory.error} onRetry={() => void inventory.refetch()} />}

        {!inventory.isLoading && !inventory.isError && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b-2 border-border">
                    {["Drug Name", "NDC Code", "Category", "Stock Qty", "Unit", "Reorder Level", "Nearest Expiry", "Status"].map((h) => (
                      <th key={h} className="py-2.5 px-3.5 text-left text-xs font-bold text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item) => {
                    const colors = statusColors[item.derivedStatus] ?? statusColors.OK;
                    const stockColor = item.onHand === 0 ? "#dc2626" : item.onHand < item.reorderLevel ? "#ca8a04" : "var(--foreground)";
                    return (
                      <tr key={item.id} className="border-b border-border">
                        <td className="py-3.5 px-3.5 font-semibold text-foreground">
                          {item.name}
                          {item.genericName && <div className="text-[11px] text-muted-foreground font-normal">{item.genericName}</div>}
                        </td>
                        <td className="py-3.5 px-3.5 font-mono text-xs text-muted-foreground">{item.ndc ?? "—"}</td>
                        <td className="py-3.5 px-3.5 text-muted-foreground">{item.category ?? "—"}</td>
                        <td className="py-3.5 px-3.5 font-mono font-bold" style={{ color: stockColor }}>{item.onHand}</td>
                        <td className="py-3.5 px-3.5 text-muted-foreground">{item.unit ?? "—"}</td>
                        <td className="py-3.5 px-3.5 font-mono text-muted-foreground">{item.reorderLevel}</td>
                        <td className="py-3.5 px-3.5 font-mono text-xs text-muted-foreground">
                          {item.nearestExpiry ? formatDate(item.nearestExpiry) : "—"}
                        </td>
                        <td className="py-3.5 px-3.5">
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ backgroundColor: colors.bg, color: colors.color }}>
                            {toLabel(item.derivedStatus)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {rows.length === 0 && <InlineEmpty text="No inventory items match your search." />}
            <ServerPager meta={inventory.data?.meta} onPageChange={setPage} />
          </>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]">
          <div className="bg-card rounded-[20px] p-8 w-[480px] max-w-[90vw] shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-extrabold text-foreground font-['Plus_Jakarta_Sans',sans-serif]">Receive Stock</h2>
              <button onClick={() => setShowModal(false)} className="bg-transparent border-none cursor-pointer text-muted-foreground">
                <X size={20} />
              </button>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-[13px] font-semibold text-foreground block mb-1.5">Search drug</label>
                <input
                  value={drugSearch}
                  onChange={(e) => setDrugSearch(e.target.value)}
                  placeholder="Search the drug catalogue..."
                  className={`${inputClass} mb-2`}
                />
                <select value={form.drugId} onChange={(e) => setForm((prev) => ({ ...prev, drugId: e.target.value }))} className={inputClass}>
                  <option value="">Select drug...</option>
                  {(drugs.data ?? []).map((drug) => (
                    <option key={drug.id} value={drug.id}>{drug.name}</option>
                  ))}
                </select>
              </div>
              {[
                { label: "Quantity", key: "quantity" as const, placeholder: "e.g. 500", type: "number" },
                { label: "Batch Number", key: "batchNumber" as const, placeholder: "e.g. BTH-20260801", type: "text" },
                { label: "Expiry Date", key: "expiryDate" as const, placeholder: "", type: "date" },
              ].map((field) => (
                <div key={field.key}>
                  <label className="text-[13px] font-semibold text-foreground block mb-1.5">{field.label}</label>
                  <input
                    type={field.type}
                    value={form[field.key]}
                    onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className={inputClass}
                  />
                </div>
              ))}
              <div className="flex gap-3 mt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-[11px] border border-border rounded-[10px] bg-transparent text-foreground text-sm font-semibold cursor-pointer">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={receiveStock.isPending}
                  className="flex-1 py-[11px] border-none rounded-[10px] bg-blue-600 text-white text-sm font-semibold cursor-pointer disabled:opacity-60"
                >
                  {receiveStock.isPending ? "Saving…" : "Add Stock"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
