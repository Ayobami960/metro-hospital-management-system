import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Pill, RefreshCw, AlertTriangle, CheckCircle, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

import {
  useDrugInteractionCheck,
  usePrescription,
  usePrescriptions,
  useRefillRequests,
  useRequestRefill,
} from "@/hooks/clinical/clinical.hooks";
import { QueryError, QueryLoading, InlineEmpty } from "@/components/globals/query-state";
import { ServerPager } from "@/components/globals/server-pager";
import { errorMessage } from "@/services/api/api-error";
import { formatDate, label as toLabel } from "@/lib/format";

const statusClass: Record<string, string> = {
  SIGNED: "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400",
  SENT: "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400",
  DISPENSED: "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400",
  PARTIALLY_DISPENSED: "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400",
  DRAFT: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
  EXPIRED: "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400",
  CANCELLED: "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400",
};

const severityStyle: Record<string, string> = {
  MAJOR: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-400",
  MODERATE: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-400",
  MINOR: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-400",
};

export default function PrescriptionsPage() {
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"current" | "interactions">("current");

  const prescriptions = usePrescriptions({ page, pageSize: 10 });
  const rows = prescriptions.data?.rows ?? [];
  const selected = rows.find((row) => row.id === selectedId) ?? rows[0] ?? null;
  const detail = usePrescription(selected?.id);
  const refills = useRefillRequests("REQUESTED");
  const requestRefill = useRequestRefill();
  const interactionCheck = useDrugInteractionCheck();

  const items = detail.data?.items ?? [];
  const drugIds = useMemo(() => Array.from(new Set(items.map((item) => item.drugId))), [items]);

  useEffect(() => {
    if (drugIds.length > 0) interactionCheck.mutate(drugIds);
    // Re-run only when the medication set changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drugIds.join(",")]);

  const interactions = interactionCheck.data ?? [];
  const openRefills = refills.data ?? [];

  return (
    <div className="p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-[26px] font-extrabold text-foreground mb-1 font-['Plus_Jakarta_Sans',sans-serif]">Prescriptions</h1>
          <p className="text-muted-foreground text-[15px]">
            {rows.filter((row) => row.status !== "CANCELLED" && row.status !== "EXPIRED").length} on this page ·{" "}
            {openRefills.length} refill request{openRefills.length === 1 ? "" : "s"} pending
          </p>
        </div>
        <div className="flex gap-2.5">
          <a href="/patient/messages" className="flex items-center gap-1.5 py-[9px] px-4 bg-blue-600 text-white border-none rounded-[10px] text-[13px] font-semibold cursor-pointer">
            <Plus size={14} /> Request Renewal
          </a>
        </div>
      </div>

      {openRefills.length > 0 && (
        <div className="flex items-start gap-3 bg-yellow-50 border-[1.5px] border-yellow-300 rounded-xl py-3.5 px-[18px] mb-5">
          <AlertTriangle size={20} color="#d97706" className="shrink-0" />
          <div>
            <div className="text-sm font-bold text-yellow-800 mb-0.5">Refill Request Pending</div>
            <div className="text-[13px] text-yellow-800">
              {openRefills.map((refill) => `${refill.drug} ${refill.dose}`).join(", ")} — awaiting your doctor's decision.
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-5">
        {[
          ["current", "Medications"],
          ["interactions", "Drug Interactions"],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id as typeof tab)}
            className={cn(
              "py-2 px-[18px] rounded-[10px] text-[13px] font-semibold cursor-pointer",
              tab === id ? "bg-blue-600 text-white border-2 border-blue-600" : "bg-card text-muted-foreground border border-border",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {prescriptions.isLoading && <QueryLoading text="Loading your prescriptions…" />}
      {prescriptions.isError && <QueryError error={prescriptions.error} onRetry={() => void prescriptions.refetch()} />}

      {!prescriptions.isLoading && !prescriptions.isError && tab === "current" && (
        <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 1.4fr" }}>
          <div className="flex flex-col gap-3">
            {rows.map((prescription) => {
              const active = selected?.id === prescription.id;
              return (
                <button
                  key={prescription.id}
                  onClick={() => setSelectedId(prescription.id)}
                  className="p-[18px] rounded-xl text-left transition-all duration-150 bg-card"
                  style={{ border: `2px solid ${active ? "#2563eb" : "var(--border)"}` }}
                >
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center bg-blue-100 dark:bg-blue-950">
                        <Pill size={18} className="text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-foreground">{prescription.drugNames.join(", ") || "Prescription"}</div>
                        <div className="text-xs text-muted-foreground">
                          {prescription.itemCount} item{prescription.itemCount === 1 ? "" : "s"} · {prescription.doctorName}
                        </div>
                      </div>
                    </div>
                    <span className={cn("text-[11px] font-bold px-2.5 py-[3px] rounded-full", statusClass[prescription.status] ?? "bg-muted text-muted-foreground")}>
                      {toLabel(prescription.status)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Issued {formatDate(prescription.createdAt)}</span>
                    <span>{prescription.expiresAt ? `Expires ${formatDate(prescription.expiresAt)}` : "No expiry set"}</span>
                  </div>
                </button>
              );
            })}
            {rows.length === 0 && <InlineEmpty text="No prescriptions on file." />}
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 card-shadow">
            {!selected && <InlineEmpty text="Select a prescription to see its details." />}
            {selected && (
              <>
                <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-blue-100 dark:bg-blue-950">
                    <Pill size={24} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-foreground font-['Plus_Jakarta_Sans',sans-serif]">
                      {selected.drugNames.join(", ") || "Prescription"}
                    </h2>
                    <div className="text-sm text-muted-foreground">{selected.doctorName}</div>
                  </div>
                  <span className={cn("ml-auto text-xs font-bold px-3 py-1 rounded-full", statusClass[selected.status] ?? "bg-muted text-muted-foreground")}>
                    {toLabel(selected.status)}
                  </span>
                </div>

                {detail.isLoading && <div className="text-xs text-muted-foreground py-2">Loading items…</div>}
                {detail.isError && <QueryError error={detail.error} onRetry={() => void detail.refetch()} />}

                <div className="flex flex-col gap-2.5 mb-5">
                  {items.map((item) => (
                    <div key={item.id} className="py-3 px-3.5 bg-muted rounded-[10px]">
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <div className="text-[13px] font-bold text-foreground">
                          {item.drugName} <span className="font-mono text-blue-600 dark:text-blue-400">{item.dose}</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {item.refillsAuthorized - item.refillsUsed} of {item.refillsAuthorized} refills left
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {item.frequency} · {item.route} · Qty {item.quantity} {item.unit}
                        {item.durationDays ? ` · ${item.durationDays} days` : ""}
                      </div>
                      {item.instructions && <div className="text-[11px] text-muted-foreground mt-1">{item.instructions}</div>}
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-[11px] text-muted-foreground">
                          {item.startDate ? `Started ${formatDate(item.startDate)}` : "Start date not set"}
                          {item.endDate ? ` · Ends ${formatDate(item.endDate)}` : ""}
                        </span>
                        <button
                          onClick={() =>
                            requestRefill.mutate(
                              { prescriptionItemId: item.id },
                              {
                                onSuccess: () => toast.success("Refill requested"),
                                onError: (error) => toast.error(errorMessage(error, "Could not request the refill.")),
                              },
                            )
                          }
                          disabled={requestRefill.isPending || item.refillsUsed >= item.refillsAuthorized}
                          className="flex items-center gap-1 py-1 px-2.5 bg-blue-600 text-white border-none rounded-lg text-[11px] font-semibold cursor-pointer disabled:opacity-40"
                        >
                          <RefreshCw size={11} /> Request Refill
                        </button>
                      </div>
                    </div>
                  ))}
                  {!detail.isLoading && items.length === 0 && <InlineEmpty text="No medication items on this prescription." />}
                </div>

                {selected.notes && (
                  <div className="mb-4">
                    <div className="text-[13px] font-bold text-foreground mb-2.5">Prescriber Notes</div>
                    <div className="py-2.5 px-3.5 bg-muted rounded-lg text-[13px] text-foreground">{selected.notes}</div>
                  </div>
                )}

                <a
                  href="/patient/messages"
                  className="w-full py-3 bg-blue-600 text-white border-none rounded-xl text-sm font-bold cursor-pointer flex items-center justify-center gap-2"
                >
                  <RefreshCw size={16} /> Message Prescriber
                </a>
              </>
            )}
            <ServerPager meta={prescriptions.data?.meta} onPageChange={setPage} />
          </div>
        </div>
      )}

      {!prescriptions.isLoading && !prescriptions.isError && tab === "interactions" && (
        <div className="bg-card border border-border rounded-2xl p-6 card-shadow">
          <h3 className="text-base font-bold text-foreground mb-4 font-['Plus_Jakarta_Sans',sans-serif]">Drug Interaction Analysis</h3>
          {interactionCheck.isPending && <QueryLoading text="Checking interactions…" />}
          {interactionCheck.isError && (
            <QueryError error={interactionCheck.error} onRetry={() => drugIds.length > 0 && interactionCheck.mutate(drugIds)} />
          )}
          <div className="flex flex-col gap-3.5">
            {interactions.map((interaction) => {
              const style = severityStyle[interaction.severity] ?? severityStyle.MINOR;
              return (
                <div key={`${interaction.drugA}-${interaction.drugB}`} className={cn("p-[18px] rounded-xl border", style)}>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={16} />
                    <span className="text-[13px] font-bold">{toLabel(interaction.severity)} Interaction</span>
                    <span className="ml-auto text-xs">
                      {interaction.drugA} + {interaction.drugB}
                    </span>
                  </div>
                  <p className="text-[13px] leading-relaxed">{interaction.management ?? interaction.mechanism ?? "No further detail recorded."}</p>
                </div>
              );
            })}
            {!interactionCheck.isPending && interactions.length === 0 && (
              <div className="p-4 rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 flex items-center gap-2.5">
                <CheckCircle size={18} className="text-green-600 dark:text-green-400" />
                <span className="text-[13px] text-green-700 font-semibold">
                  No interactions were found among the medications on the selected prescription.
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
