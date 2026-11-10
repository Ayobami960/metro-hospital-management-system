import { useState } from "react";
import { toast } from "sonner";
import { CheckSquare, Square, Pill, ClipboardList, AlertTriangle } from "lucide-react";

import {
  useDispenseLog,
  useDispenseOrder,
  useDispenseVerification,
  usePharmacyOrders,
} from "@/hooks/pharmacy/pharmacy.hooks";
import { QueryError, QueryLoading, InlineEmpty } from "@/components/globals/query-state";
import { ServerPager } from "@/components/globals/server-pager";
import { errorMessage } from "@/services/api/api-error";
import { formatDateTime, label as toLabel } from "@/lib/format";

const CHECKLIST_KEYS = [
  { key: "patientIdVerified", label: "Patient identity verified (name + MRN)" },
  { key: "drugMatches", label: "Drug matches the prescription" },
  { key: "doseCorrect", label: "Dose and quantity are correct" },
  { key: "counselingGiven", label: "Counseling given to the patient" },
] as const;

type ChecklistKey = (typeof CHECKLIST_KEYS)[number]["key"];

export default function DispensePage() {
  const [selectedId, setSelectedId] = useState("");
  const [checklist, setChecklist] = useState<Record<ChecklistKey, boolean>>({
    patientIdVerified: false,
    drugMatches: false,
    doseCorrect: false,
    counselingGiven: false,
  });
  const [note, setNote] = useState("");
  const [logPage, setLogPage] = useState(1);

  const ready = usePharmacyOrders({ pageSize: 50, status: "READY" });
  const verification = useDispenseVerification(selectedId || null);
  const dispense = useDispenseOrder();
  const log = useDispenseLog({ page: logPage, pageSize: 10 });

  const rows = ready.data?.rows ?? [];
  const order = rows.find((row) => row.id === selectedId) ?? null;
  const allChecked = CHECKLIST_KEYS.every((item) => checklist[item.key]);
  const blocked = (verification.data?.allergyConflicts.length ?? 0) > 0;

  const toggle = (key: ChecklistKey) => setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));

  const submit = async () => {
    if (!selectedId || !allChecked) return;
    try {
      await dispense.mutateAsync({ orderId: selectedId, input: { checklist, note: note || undefined } });
      toast.success("Order dispensed");
      setSelectedId("");
      setChecklist({ patientIdVerified: false, drugMatches: false, doseCorrect: false, counselingGiven: false });
      setNote("");
    } catch (error) {
      toast.error(errorMessage(error, "Could not dispense the order."));
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-[26px] font-extrabold text-foreground mb-1 font-['Plus_Jakarta_Sans',sans-serif]">Dispense Medication</h1>
        <p className="text-muted-foreground text-[15px]">Verify and dispense ready pharmacy orders</p>
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 1.2fr" }}>
        {/* Ready orders */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="text-base font-bold text-foreground mb-4 font-['Plus_Jakarta_Sans',sans-serif]">Ready for Pickup</div>
          {ready.isLoading && <QueryLoading text="Loading ready orders…" />}
          {ready.isError && <QueryError error={ready.error} onRetry={() => void ready.refetch()} />}
          <div className="flex flex-col gap-2.5">
            {rows.map((entry) => (
              <button
                key={entry.id}
                onClick={() => {
                  setSelectedId(entry.id);
                  setChecklist({ patientIdVerified: false, drugMatches: false, doseCorrect: false, counselingGiven: false });
                }}
                className="p-3.5 rounded-xl text-left transition-all bg-muted"
                style={{ border: `1.5px solid ${selectedId === entry.id ? "#2563eb" : "transparent"}` }}
              >
                <div className="flex justify-between items-start gap-2 mb-1">
                  <div>
                    <div className="text-[13px] font-bold text-foreground">{entry.patientName}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">{entry.mrn}</div>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                    {toLabel(entry.status)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {entry.drugNames.join(", ") || "—"} · {entry.itemCount} item(s)
                </div>
              </button>
            ))}
            {!ready.isLoading && rows.length === 0 && <InlineEmpty text="No orders are ready to dispense." />}
          </div>
        </div>

        {/* Verification */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="text-base font-bold text-foreground mb-4 font-['Plus_Jakarta_Sans',sans-serif]">Dispensing Checklist</div>
          {!order && <InlineEmpty text="Select a ready order to verify." />}

          {order && verification.isLoading && <QueryLoading text="Verifying order…" />}
          {order && verification.isError && <QueryError error={verification.error} onRetry={() => void verification.refetch()} />}

          {order && verification.data && (
            <>
              <div className="flex items-center gap-3 p-3.5 bg-blue-50 rounded-xl mb-4">
                <Pill size={18} className="text-blue-600" />
                <div>
                  <div className="text-[13px] font-bold text-foreground">{order.patientName}</div>
                  <div className="text-xs text-muted-foreground">
                    {verification.data.items.map((item) => item.drugName).join(", ") || "—"}
                  </div>
                </div>
              </div>

              {blocked && (
                <div className="flex items-start gap-2.5 bg-red-100 border border-red-200 rounded-xl py-3 px-4 mb-4">
                  <AlertTriangle size={18} color="#dc2626" className="shrink-0" />
                  <div>
                    <div className="text-sm font-bold text-red-900 mb-1">Allergy conflict</div>
                    <div className="text-[13px] text-red-800">
                      {verification.data.allergyConflicts.map((conflict) => conflict.allergen).join(", ")}
                    </div>
                  </div>
                </div>
              )}

              {verification.data.interactions.length > 0 && (
                <div className="flex items-start gap-2.5 bg-yellow-50 border border-yellow-200 rounded-xl py-3 px-4 mb-4">
                  <AlertTriangle size={18} color="#ca8a04" className="shrink-0" />
                  <div>
                    <div className="text-sm font-bold text-yellow-800 mb-1">Interaction warnings</div>
                    <div className="text-[13px] text-yellow-800">
                      {verification.data.interactions
                        .map((interaction) => `${interaction.drugA} + ${interaction.drugB} (${toLabel(interaction.severity)})`)
                        .join(" · ")}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between py-2 px-3.5 bg-muted rounded-lg mb-4">
                <span className="text-[13px] text-foreground">Stock available</span>
                <span className="text-[13px] font-bold" style={{ color: verification.data.stockAvailable ? "#16a34a" : "#dc2626" }}>
                  {verification.data.stockAvailable ? "Yes" : "No"}
                </span>
              </div>

              <div className="flex flex-col gap-2 mb-4">
                {CHECKLIST_KEYS.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => toggle(item.key)}
                    className="flex items-center gap-2.5 text-left py-2.5 px-3 bg-muted rounded-lg cursor-pointer"
                  >
                    {checklist[item.key] ? (
                      <CheckSquare size={16} className="text-green-600 shrink-0" />
                    ) : (
                      <Square size={16} className="text-muted-foreground shrink-0" />
                    )}
                    <span className="text-[13px] text-foreground">{item.label}</span>
                  </button>
                ))}
              </div>

              <div className="mb-4">
                <label className="block text-xs font-semibold text-foreground mb-1.5">Dispensing note</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full py-2.5 px-3 border-[1.5px] border-border rounded-lg text-[13px] bg-muted text-foreground outline-none box-border min-h-[64px] resize-y"
                  placeholder="Optional note for the record"
                />
              </div>

              <button
                onClick={() => void submit()}
                disabled={!allChecked || dispense.isPending || !verification.data.stockAvailable}
                className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 text-white border-none rounded-[10px] text-sm font-bold cursor-pointer disabled:opacity-50"
              >
                <ClipboardList size={16} /> {dispense.isPending ? "Dispensing…" : "Confirm Dispense"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Dispense log */}
      <div className="bg-card border border-border rounded-2xl p-6 mt-5">
        <div className="text-base font-bold text-foreground mb-4 font-['Plus_Jakarta_Sans',sans-serif]">Recent Dispense Log</div>
        {log.isLoading && <QueryLoading text="Loading log…" />}
        {log.isError && <QueryError error={log.error} onRetry={() => void log.refetch()} />}
        {!log.isLoading && !log.isError && (
          <>
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b-2 border-border">
                  {["Patient", "Drugs", "Quantity", "Pharmacist", "Dispensed"].map((h) => (
                    <th key={h} className="py-2.5 px-3.5 text-left text-xs font-bold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(log.data?.rows ?? []).map((entry) => (
                  <tr key={entry.id} className="border-b border-border">
                    <td className="p-3.5">
                      <div className="font-semibold text-foreground">{entry.patientName}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">{entry.mrn}</div>
                    </td>
                    <td className="p-3.5 text-foreground">{entry.drugNames.join(", ") || "—"}</td>
                    <td className="p-3.5 font-mono text-foreground">{entry.quantity}</td>
                    <td className="p-3.5 text-muted-foreground">{entry.pharmacist ?? "—"}</td>
                    <td className="p-3.5 text-xs text-muted-foreground">{formatDateTime(entry.dispensedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(log.data?.rows.length ?? 0) === 0 && <InlineEmpty text="No dispensing recorded yet." />}
            <ServerPager meta={log.data?.meta} onPageChange={setLogPage} />
          </>
        )}
      </div>
    </div>
  );
}
