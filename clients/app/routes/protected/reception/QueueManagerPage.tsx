import { useState } from "react";
import { toast } from "sonner";
import { Users, Clock, CheckCircle, Plus, ChevronRight, X, AlertCircle } from "lucide-react";

import {
  useAddToQueue,
  useCallNextPatient,
  useCompleteQueueEntry,
  useQueue,
  useRemoveQueueEntry,
  useStartQueueEntry,
} from "@/hooks/reception/reception.hooks";
import { usePatients } from "@/hooks/patients/patients.hooks";
import { QueryError, QueryLoading, InlineEmpty } from "@/components/globals/query-state";
import { ServerPager } from "@/components/globals/server-pager";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { errorMessage } from "@/services/api/api-error";
import { formatTime, label as toLabel, relativeTime } from "@/lib/format";

const statusStyle: Record<string, { bg: string; color: string; border: string }> = {
  WAITING: { bg: "#fef9c3", color: "#ca8a04", border: "#fde68a" },
  CALLED: { bg: "#dbeafe", color: "#2563eb", border: "#bfdbfe" },
  IN_PROGRESS: { bg: "#dcfce7", color: "#16a34a", border: "#86efac" },
  COMPLETED: { bg: "#f1f5f9", color: "#64748b", border: "#e2e8f0" },
  REMOVED: { bg: "#fee2e2", color: "#dc2626", border: "#fecaca" },
};

function StatusBadge({ status }: { status: string }) {
  const style = statusStyle[status] ?? statusStyle.WAITING;
  return (
    <span
      style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}
      className="text-[11px] font-bold py-[3px] px-2.5 rounded-full whitespace-nowrap"
    >
      {toLabel(status)}
    </span>
  );
}

const inputClass =
  "w-full py-2.5 px-3 border-[1.5px] border-border rounded-lg text-[13px] bg-card text-foreground outline-none box-border focus:border-blue-600";

export default function QueueManagerPage() {
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [patientId, setPatientId] = useState("");
  const [priority, setPriority] = useState<"ROUTINE" | "URGENT" | "STAT">("ROUTINE");
  const [type, setType] = useState<"WALK_IN" | "APPOINTMENT">("WALK_IN");
  const [notes, setNotes] = useState("");

  const queue = useQueue({ page, pageSize: 20 });
  const patients = usePatients({ pageSize: 10, search: useDebouncedValue(patientSearch) || undefined });
  const addToQueue = useAddToQueue();
  const callNext = useCallNextPatient();
  const startEntry = useStartQueueEntry();
  const completeEntry = useCompleteQueueEntry();
  const removeEntry = useRemoveQueueEntry();

  const rows = queue.data?.rows ?? [];
  const active = rows.filter((entry) => entry.status !== "COMPLETED" && entry.status !== "REMOVED");
  const avgWait = active.length
    ? Math.round(active.reduce((sum, entry) => sum + entry.waitMinutes, 0) / active.length)
    : 0;

  const stats = [
    { label: "In Queue", value: String(active.length), icon: Users, color: "#2563eb", bg: "#dbeafe" },
    { label: "Avg Wait", value: `${avgWait}m`, icon: Clock, color: "#d97706", bg: "#fef9c3" },
    { label: "Completed", value: String(rows.filter((entry) => entry.status === "COMPLETED").length), icon: CheckCircle, color: "#16a34a", bg: "#dcfce7" },
    { label: "Urgent", value: String(active.filter((entry) => entry.priority !== "ROUTINE").length), icon: AlertCircle, color: "#dc2626", bg: "#fee2e2" },
  ];

  const submit = async () => {
    if (!patientId) {
      toast.error("Select a patient to add to the queue.");
      return;
    }
    try {
      await addToQueue.mutateAsync({ patientId, priority, type, notes: notes || undefined });
      toast.success("Added to queue");
      setShowAddModal(false);
      setPatientId("");
      setPatientSearch("");
      setNotes("");
    } catch (error) {
      toast.error(errorMessage(error, "Could not add the patient to the queue."));
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground mb-1 font-['Plus_Jakarta_Sans',sans-serif]">Queue Manager</h1>
          <p className="text-muted-foreground text-sm">Real-time patient flow management</p>
        </div>
        <div className="flex gap-2.5">
          <button
            onClick={() =>
              callNext.mutate(undefined, {
                onSuccess: (entry) => toast.success(`Called ${entry.ticketNumber}`),
                onError: (error) => toast.error(errorMessage(error, "Nobody is waiting to be called.")),
              })
            }
            disabled={callNext.isPending || active.length === 0}
            className="flex items-center gap-2 py-2.5 px-[18px] bg-green-600 text-white border-none rounded-[10px] text-sm font-semibold cursor-pointer disabled:opacity-50"
          >
            <ChevronRight size={16} /> Call Next
          </button>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 py-2.5 px-[18px] bg-blue-600 text-white border-none rounded-[10px] text-sm font-semibold cursor-pointer">
            <Plus size={16} /> Add to Queue
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-card border border-border rounded-2xl p-5 flex gap-3.5 items-center">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: stat.bg }}>
                <Icon size={20} color={stat.color} />
              </div>
              <div>
                <div className="text-2xl font-extrabold text-foreground font-mono">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Average wait indicator */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-5 flex items-center gap-5">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full" style={{ background: avgWait > 20 ? "#dc2626" : avgWait > 10 ? "#d97706" : "#16a34a" }} />
          <span className="text-[13px] font-semibold text-foreground">Average Wait Time: </span>
          <span className="text-lg font-extrabold font-mono" style={{ color: avgWait > 20 ? "#dc2626" : avgWait > 10 ? "#d97706" : "#16a34a" }}>
            {avgWait} min
          </span>
        </div>
        <div className="flex-1 h-2 bg-border rounded overflow-hidden">
          <div
            className="h-full rounded transition-all duration-300"
            style={{ width: `${Math.min(100, (avgWait / 40) * 100)}%`, background: avgWait > 20 ? "#dc2626" : avgWait > 10 ? "#d97706" : "#16a34a" }}
          />
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">Target: &lt; 20 min</span>
      </div>

      {/* Queue */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="text-[15px] font-bold text-foreground mb-4 font-['Plus_Jakarta_Sans',sans-serif] flex items-center gap-2">
          Live Queue
          <div className="w-2 h-2 rounded-full bg-green-600" />
        </div>

        {queue.isLoading && <QueryLoading text="Loading the queue…" />}
        {queue.isError && <QueryError error={queue.error} onRetry={() => void queue.refetch()} />}

        {!queue.isLoading && !queue.isError && (
          <>
            <div className="flex flex-col gap-2.5">
              {rows.map((entry) => {
                const urgent = entry.priority !== "ROUTINE";
                const done = entry.status === "COMPLETED";
                return (
                  <div
                    key={entry.id}
                    className={`flex items-center gap-3.5 p-3.5 rounded-xl transition-opacity duration-200 ${urgent ? "bg-red-50" : "bg-muted"} ${done ? "opacity-55" : ""}`}
                    style={{ border: urgent ? "1.5px solid #fecaca" : "1px solid transparent" }}
                  >
                    <div
                      className="w-9 h-9 rounded-full text-white flex items-center justify-center text-sm font-extrabold shrink-0 font-mono"
                      style={{ background: entry.priority === "STAT" ? "#dc2626" : entry.status === "IN_PROGRESS" ? "#16a34a" : entry.status === "COMPLETED" ? "#64748b" : "#2563eb" }}
                    >
                      {entry.position}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-foreground mb-0.5">
                        {entry.patientName}
                        <span className="text-xs text-muted-foreground font-normal font-mono ml-2">{entry.mrn}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Checked in {formatTime(entry.checkInAt)} · {entry.ticketNumber} · {toLabel(entry.type)}
                        {entry.doctorId ? ` · doctor ${entry.doctorId.slice(0, 6)}` : ""}
                      </div>
                    </div>
                    <div className="text-center min-w-[56px]">
                      <div className="text-[11px] text-muted-foreground">Wait</div>
                      <div
                        className="text-sm font-bold font-mono"
                        style={{ color: urgent ? "#dc2626" : entry.status === "IN_PROGRESS" ? "#16a34a" : "var(--foreground)" }}
                      >
                        {entry.status === "IN_PROGRESS" ? "--" : done ? "Done" : `${entry.waitMinutes}m`}
                      </div>
                    </div>
                    <StatusBadge status={entry.status} />
                    {!done && entry.status !== "REMOVED" && (
                      <div className="flex gap-1.5">
                        {entry.status === "WAITING" && (
                          <button
                            onClick={() =>
                              startEntry.mutate(entry.id, {
                                onSuccess: () => toast.success("Visit started"),
                                onError: (error) => toast.error(errorMessage(error, "Could not start the visit.")),
                              })
                            }
                            className="px-2.5 py-1.5 bg-blue-100 text-blue-700 border border-blue-200 rounded-[7px] text-xs font-semibold cursor-pointer whitespace-nowrap"
                          >
                            Start
                          </button>
                        )}
                        <button
                          onClick={() =>
                            completeEntry.mutate(entry.id, {
                              onSuccess: () => toast.success("Queue entry completed"),
                              onError: (error) => toast.error(errorMessage(error, "Could not complete the entry.")),
                            })
                          }
                          className="px-3 py-1.5 bg-green-100 text-green-700 border border-green-200 rounded-[7px] text-xs font-semibold cursor-pointer whitespace-nowrap"
                        >
                          Complete
                        </button>
                        <button
                          onClick={() =>
                            removeEntry.mutate(entry.id, {
                              onSuccess: () => toast.success("Removed from queue"),
                              onError: (error) => toast.error(errorMessage(error, "Could not remove the entry.")),
                            })
                          }
                          className="w-[30px] h-[30px] rounded-[7px] border border-border bg-card cursor-pointer flex items-center justify-center"
                        >
                          <X size={13} color="var(--muted-foreground)" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {rows.length === 0 && <InlineEmpty text="Queue is empty." />}
            <ServerPager meta={queue.data?.meta} onPageChange={setPage} />
          </>
        )}
      </div>

      {/* Add to Queue Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000]">
          <div className="bg-card rounded-[20px] p-7 w-[460px] border border-border">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-extrabold text-foreground font-['Plus_Jakarta_Sans',sans-serif]">Add to Queue</h2>
              <button onClick={() => setShowAddModal(false)} className="w-8 h-8 rounded-lg border border-border bg-card cursor-pointer flex items-center justify-center">
                <X size={16} color="var(--foreground)" />
              </button>
            </div>
            <div className="flex flex-col gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-[5px]">Search patient</label>
                <input
                  className={`${inputClass} mb-2`}
                  placeholder="Name or MRN..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                />
                <select className={inputClass} value={patientId} onChange={(e) => setPatientId(e.target.value)}>
                  <option value="">Select patient...</option>
                  {(patients.data?.rows ?? []).map((patient) => (
                    <option key={patient.id} value={patient.id}>{patient.name} · {patient.mrn}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-[5px]">Type</label>
                  <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
                    <option value="WALK_IN">Walk-in</option>
                    <option value="APPOINTMENT">Appointment</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-[5px]">Priority</label>
                  <select className={inputClass} value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
                    <option value="ROUTINE">Routine</option>
                    <option value="URGENT">Urgent</option>
                    <option value="STAT">STAT</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-[5px]">Notes</label>
                <textarea className={`${inputClass} min-h-[72px] resize-vertical`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Chief complaint or notes..." />
              </div>
              <div className="flex gap-2.5 mt-1">
                <button onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 bg-muted text-foreground border border-border rounded-[10px] text-sm font-semibold cursor-pointer">
                  Cancel
                </button>
                <button
                  onClick={() => void submit()}
                  disabled={addToQueue.isPending}
                  className="flex-[2] py-2.5 bg-blue-600 text-white border-none rounded-[10px] text-sm font-semibold cursor-pointer disabled:opacity-60"
                >
                  {addToQueue.isPending ? "Adding…" : "Add to Queue"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {rows[0] ? <div className="mt-3 text-[11px] text-muted-foreground">Last check-in {relativeTime(rows[0].checkInAt)}</div> : null}
    </div>
  );
}
