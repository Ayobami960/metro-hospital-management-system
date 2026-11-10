import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Pill, Plus, RefreshCw, Search, Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  useCreatePrescription,
  useDecideRefill,
  useDrugs,
  usePrescriptions,
  useRefillRequests,
} from "@/hooks/clinical/clinical.hooks";
import { usePatients } from "@/hooks/patients/patients.hooks";
import { prescriptionSchema, type PrescriptionFormValues } from "@/schemas/clinical.schema";
import { QueryError, QueryLoading } from "@/components/globals/query-state";
import { ServerPager } from "@/components/globals/server-pager";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { errorMessage } from "@/services/api/api-error";
import { formatDate, label as toLabel, relativeTime } from "@/lib/format";

const statusClass: Record<string, string> = {
  SIGNED: "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400",
  SENT: "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400",
  DISPENSED: "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400",
  DRAFT: "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400",
  PARTIALLY_DISPENSED: "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400",
  CANCELLED: "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400",
  EXPIRED: "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400",
};

function NewRxModal({ onClose }: { onClose: () => void }) {
  const [patientSearch, setPatientSearch] = useState("");
  const [drugSearch, setDrugSearch] = useState("");
  const patients = usePatients({ pageSize: 20, search: useDebouncedValue(patientSearch) || undefined });
  const drugs = useDrugs(useDebouncedValue(drugSearch));
  const createPrescription = useCreatePrescription();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PrescriptionFormValues>({
    resolver: zodResolver(prescriptionSchema),
    defaultValues: {
      patientId: "",
      drugId: "",
      dose: "",
      frequency: "",
      route: "PO",
      quantity: "30",
      durationDays: "30",
      refillsAuthorized: "0",
      instructions: "",
      notes: "",
      priority: "ROUTINE",
    },
  });

  const onSubmit = async (values: PrescriptionFormValues) => {
    try {
      await createPrescription.mutateAsync({
        patientId: values.patientId,
        notes: values.notes || undefined,
        priority: values.priority,
        items: [
          {
            drugId: values.drugId,
            dose: values.dose,
            frequency: values.frequency,
            route: values.route,
            quantity: Number(values.quantity),
            durationDays: values.durationDays ? Number(values.durationDays) : undefined,
            refillsAuthorized: values.refillsAuthorized ? Number(values.refillsAuthorized) : 0,
            instructions: values.instructions || undefined,
          },
        ],
      });
      toast.success("Prescription signed and sent");
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, "Could not create the prescription."));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-card rounded-[20px] p-8 w-[520px] shadow-[0_20px_60px_rgba(0,0,0,0.2)] max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-extrabold text-foreground font-['Plus_Jakarta_Sans',sans-serif]">Write New Prescription</h2>
          <button type="button" onClick={onClose} className="bg-transparent border-none cursor-pointer text-muted-foreground text-[22px]">×</button>
        </div>

        <div className="mb-3.5">
          <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Patient</label>
          <input
            value={patientSearch}
            onChange={(e) => setPatientSearch(e.target.value)}
            placeholder="Search patient..."
            className="w-full py-2 px-3 mb-2 rounded-[10px] border border-border bg-background text-foreground text-sm box-border"
          />
          <select {...register("patientId")} className="w-full py-2.5 px-3 rounded-[10px] border border-border bg-background text-foreground text-sm">
            <option value="">Select a patient</option>
            {(patients.data?.rows ?? []).map((patient) => (
              <option key={patient.id} value={patient.id}>{patient.name} · {patient.mrn}</option>
            ))}
          </select>
          {errors.patientId && <p className="text-[11px] text-red-600 mt-1">{errors.patientId.message}</p>}
        </div>

        <div className="mb-3.5">
          <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Drug Name</label>
          <input
            value={drugSearch}
            onChange={(e) => setDrugSearch(e.target.value)}
            placeholder="e.g. Amlodipine"
            className="w-full py-2 px-3 mb-2 rounded-[10px] border border-border bg-background text-foreground text-sm box-border"
          />
          <select {...register("drugId")} className="w-full py-2.5 px-3 rounded-[10px] border border-border bg-background text-foreground text-sm">
            <option value="">Select a drug</option>
            {(drugs.data ?? []).map((drug) => (
              <option key={drug.id} value={drug.id}>
                {drug.name}{drug.strength ? ` ${drug.strength}` : ""}
              </option>
            ))}
          </select>
          {errors.drugId && <p className="text-[11px] text-red-600 mt-1">{errors.drugId.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Dose", name: "dose" as const, placeholder: "e.g. 5mg" },
            { label: "Frequency", name: "frequency" as const, placeholder: "e.g. Once daily" },
            { label: "Quantity", name: "quantity" as const, placeholder: "e.g. 30" },
            { label: "Duration (days)", name: "durationDays" as const, placeholder: "e.g. 30" },
            { label: "Refills", name: "refillsAuthorized" as const, placeholder: "e.g. 0" },
          ].map((field) => (
            <div key={field.name} className="mb-3.5">
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">{field.label}</label>
              <input
                {...register(field.name)}
                placeholder={field.placeholder}
                className="w-full py-2.5 px-3 rounded-[10px] border border-border bg-background text-foreground text-sm box-border"
              />
              {errors[field.name] && <p className="text-[11px] text-red-600 mt-1">{errors[field.name]?.message}</p>}
            </div>
          ))}
          <div className="mb-3.5">
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Route</label>
            <select {...register("route")} className="w-full py-2.5 px-3 rounded-[10px] border border-border bg-background text-foreground text-sm">
              {["PO", "IV", "SQ", "IM", "TOPICAL", "INHALED", "RECTAL", "OPHTHALMIC"].map((route) => (
                <option key={route} value={route}>{route}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-3.5">
          <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Notes</label>
          <textarea rows={3} {...register("notes")} placeholder="Additional instructions..." className="w-full py-2.5 px-3 rounded-[10px] border border-border bg-background text-foreground text-sm box-border resize-vertical" />
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 py-3 rounded-[10px] border border-border bg-muted text-foreground font-semibold cursor-pointer text-sm">Cancel</button>
          <button type="submit" disabled={createPrescription.isPending} className="flex-1 py-3 rounded-[10px] border-none bg-violet-600 text-white font-bold cursor-pointer text-sm disabled:opacity-60">
            {createPrescription.isPending ? "Signing…" : "Sign & Send"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function PrescriptionsPage() {
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const prescriptions = usePrescriptions({
    page,
    pageSize: 20,
    search: useDebouncedValue(search) || undefined,
  });
  const refills = useRefillRequests("REQUESTED");
  const decideRefill = useDecideRefill();

  const rows = prescriptions.data?.rows ?? [];
  const refillRows = refills.data ?? [];

  return (
    <div className="p-6">
      {showModal && <NewRxModal onClose={() => setShowModal(false)} />}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-[26px] font-extrabold text-foreground mb-1 font-['Plus_Jakarta_Sans',sans-serif]">Prescriptions</h1>
          <p className="text-muted-foreground text-[15px]">Manage prescriptions and refill requests</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 py-3 px-5 bg-violet-600 text-white border-none rounded-xl font-bold text-sm cursor-pointer">
          <Plus size={16} /> Write New Rx
        </button>
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 320px" }}>
        {/* Main Table */}
        <div className="bg-card border border-border rounded-2xl p-6 card-shadow">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-bold text-foreground font-['Plus_Jakarta_Sans',sans-serif]">Recent Prescriptions</h2>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search..."
                className="py-2 px-2.5 pl-[30px] rounded-lg border border-border bg-background text-foreground text-[13px]"
              />
            </div>
          </div>

          {prescriptions.isLoading && <QueryLoading text="Loading prescriptions…" />}
          {prescriptions.isError && <QueryError error={prescriptions.error} onRetry={() => void prescriptions.refetch()} />}

          {!prescriptions.isLoading && !prescriptions.isError && (
            <>
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {["Rx ID", "Patient", "Drugs", "Items", "Issued", "Status", "Action"].map((h) => (
                      <th key={h} className="text-left text-[11px] font-bold text-muted-foreground py-2 px-2.5 border-b border-border uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((rx, i) => (
                    <tr key={rx.id} className={i % 2 !== 0 ? "bg-muted" : ""}>
                      <td className="py-3 px-2.5 text-xs font-semibold text-violet-600 font-mono">{rx.id.slice(0, 8)}</td>
                      <td className="py-3 px-2.5 text-[13px] font-semibold text-foreground">{rx.patientName}</td>
                      <td className="py-3 px-2.5 text-[13px] text-foreground">{rx.drugNames.join(", ") || "—"}</td>
                      <td className="py-3 px-2.5 text-[13px] text-foreground font-mono">{rx.itemCount}</td>
                      <td className="py-3 px-2.5 text-xs text-muted-foreground">{formatDate(rx.createdAt)}</td>
                      <td className="py-3 px-2.5">
                        <span className={cn("text-[11px] font-bold px-2.5 py-[3px] rounded-full", statusClass[rx.status] ?? "bg-muted text-muted-foreground")}>
                          {toLabel(rx.status)}
                        </span>
                      </td>
                      <td className="py-3 px-2.5">
                        <a href={`/doctor/emr?patientId=${rx.patientId}`} className="text-[11px] py-[5px] px-2.5 bg-muted border-none rounded-md cursor-pointer text-foreground font-semibold">
                          Open
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length === 0 && <div className="text-center py-8 text-muted-foreground text-[13px]">No prescriptions yet.</div>}
              <ServerPager meta={prescriptions.data?.meta} onPageChange={setPage} />
            </>
          )}
        </div>

        {/* Refill Requests */}
        <div className="bg-card border border-border rounded-2xl p-6 card-shadow">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-[10px] bg-yellow-100 dark:bg-yellow-950 flex items-center justify-center">
              <RefreshCw size={15} className="text-yellow-600 dark:text-yellow-400" />
            </div>
            <h2 className="text-[15px] font-bold text-foreground font-['Plus_Jakarta_Sans',sans-serif]">Refill Requests</h2>
            <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-950 text-yellow-600 dark:text-yellow-400">{refillRows.length}</span>
          </div>
          <div className="flex flex-col gap-3">
            {refills.isLoading && <div className="text-xs text-muted-foreground text-center py-4">Loading…</div>}
            {refills.isError && <div className="text-xs text-red-600 text-center py-4">{errorMessage(refills.error)}</div>}
            {!refills.isLoading && refillRows.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-4">No open refill requests.</div>
            )}
            {refillRows.map((r) => (
              <div key={r.id} className="bg-muted rounded-xl p-3.5 px-4">
                <div className="flex gap-2.5 mb-2.5">
                  <div className="w-9 h-9 rounded-full bg-violet-100 dark:bg-violet-950 flex items-center justify-center text-xs font-bold text-violet-600 dark:text-violet-400 shrink-0">
                    {r.patientName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <div className="text-[13px] font-bold text-foreground">{r.patientName}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Pill size={11} /> {r.drug} {r.dose}
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock size={11} /> {relativeTime(r.createdAt)}
                  </div>
                </div>
                <div className="flex gap-2">
                  {(["APPROVED", "DENIED"] as const).map((decision) => (
                    <button
                      key={decision}
                      onClick={() =>
                        decideRefill.mutate(
                          { refillId: r.id, input: { decision } },
                          {
                            onSuccess: () => toast.success(`Refill ${decision.toLowerCase()}`),
                            onError: (error) => toast.error(errorMessage(error, "Could not record the decision.")),
                          },
                        )
                      }
                      disabled={decideRefill.isPending}
                      className={cn(
                        "flex-1 py-[7px] border-none rounded-lg text-xs font-bold cursor-pointer disabled:opacity-60",
                        decision === "APPROVED"
                          ? "bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400"
                          : "bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400",
                      )}
                    >
                      {decision === "APPROVED" ? "Approve" : "Deny"}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
