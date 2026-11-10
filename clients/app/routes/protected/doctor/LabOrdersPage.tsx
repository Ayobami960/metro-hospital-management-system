import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FlaskConical, Plus, Clock, CheckCircle, AlertCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { useCreateLabOrder, useLabOrders, useLabTests } from "@/hooks/laboratory/laboratory.hooks";
import { usePatients } from "@/hooks/patients/patients.hooks";
import { QueryError, QueryLoading } from "@/components/globals/query-state";
import { ServerPager } from "@/components/globals/server-pager";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { errorMessage } from "@/services/api/api-error";
import { formatDate, label as toLabel } from "@/lib/format";

const statusClass: Record<string, string> = {
  PENDING: "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400",
  COLLECTED: "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400",
  IN_PROGRESS: "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400",
  RESULTED: "bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-400",
  RELEASED: "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400",
  CANCELLED: "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400",
};

const FILTERS = [
  { label: "All", value: "" },
  { label: "Pending", value: "PENDING" },
  { label: "In Progress", value: "IN_PROGRESS" },
  { label: "Completed", value: "RELEASED" },
];

function NewOrderModal({ onClose }: { onClose: () => void }) {
  const [patientSearch, setPatientSearch] = useState("");
  const [testSearch, setTestSearch] = useState("");
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);
  const [priority, setPriority] = useState<"ROUTINE" | "STAT">("ROUTINE");
  const [patientId, setPatientId] = useState("");
  const [notes, setNotes] = useState("");

  const patients = usePatients({ pageSize: 20, search: useDebouncedValue(patientSearch) || undefined });
  const tests = useLabTests(useDebouncedValue(testSearch));
  const createOrder = useCreateLabOrder();

  const toggleTest = (testId: string) =>
    setSelectedTestIds((prev) =>
      prev.includes(testId) ? prev.filter((id) => id !== testId) : [...prev, testId],
    );

  const submit = async () => {
    if (!patientId || selectedTestIds.length === 0) {
      toast.error("Select a patient and at least one test.");
      return;
    }
    try {
      await createOrder.mutateAsync({
        patientId,
        testIds: selectedTestIds,
        priority,
        clinicalNotes: notes || undefined,
      });
      toast.success("Lab order submitted");
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, "Could not submit the lab order."));
    }
  };

  const inputStyle =
    "w-full py-2.5 px-3 rounded-[10px] border border-border bg-background text-foreground text-sm box-border";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]">
      <div className="bg-card rounded-[20px] p-8 w-[500px] shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-extrabold text-foreground font-['Plus_Jakarta_Sans',sans-serif]">Order Lab Test</h2>
          <button onClick={onClose} className="bg-transparent border-none cursor-pointer text-muted-foreground text-[22px]">×</button>
        </div>

        <div className="mb-4">
          <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Patient</label>
          <input
            value={patientSearch}
            onChange={(e) => setPatientSearch(e.target.value)}
            placeholder="Search patient..."
            className={cn(inputStyle, "mb-2")}
          />
          <select value={patientId} onChange={(e) => setPatientId(e.target.value)} className={inputStyle}>
            <option value="">Select a patient</option>
            {(patients.data?.rows ?? []).map((patient) => (
              <option key={patient.id} value={patient.id}>{patient.name} · {patient.mrn}</option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Tests</label>
          <input
            value={testSearch}
            onChange={(e) => setTestSearch(e.target.value)}
            placeholder="Search the test catalogue..."
            className={cn(inputStyle, "mb-2")}
          />
          <div className="max-h-36 overflow-y-auto border border-border rounded-[10px] p-2 flex flex-col gap-1">
            {(tests.data ?? []).map((test) => (
              <label key={test.id} className="flex items-center gap-2 text-[13px] text-foreground px-1.5 py-1 rounded cursor-pointer hover:bg-muted">
                <input
                  type="checkbox"
                  checked={selectedTestIds.includes(test.id)}
                  onChange={() => toggleTest(test.id)}
                />
                {test.name}
              </label>
            ))}
            {tests.data && tests.data.length === 0 && (
              <div className="text-xs text-muted-foreground px-2 py-1">No tests match that search.</div>
            )}
          </div>
        </div>

        <div className="mb-4">
          <label className="text-xs font-semibold text-muted-foreground block mb-2">Priority</label>
          <div className="flex gap-2.5">
            {(["ROUTINE", "STAT"] as const).map((value) => (
              <label
                key={value}
                className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-[10px] cursor-pointer flex-1 text-sm"
              >
                <input
                  type="radio"
                  name="priority"
                  value={value}
                  checked={priority === value}
                  onChange={() => setPriority(value)}
                />
                {toLabel(value)}
                {value === "STAT" && <AlertCircle size={14} color="#dc2626" />}
              </label>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Clinical Notes</label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Clinical indication or special instructions..."
            className={cn(inputStyle, "resize-vertical")}
          />
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-[10px] border border-border bg-muted text-foreground font-semibold cursor-pointer text-sm">Cancel</button>
          <button
            onClick={() => void submit()}
            disabled={createOrder.isPending}
            className="flex-1 py-3 rounded-[10px] border-none bg-blue-600 text-white font-bold cursor-pointer text-sm disabled:opacity-60"
          >
            {createOrder.isPending ? "Submitting…" : "Submit Order"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LabOrdersPage() {
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);

  const orders = useLabOrders({ page, pageSize: 20, status: filter || undefined });
  const pending = useLabOrders({ page: 1, pageSize: 1, status: "PENDING" });
  const inProgress = useLabOrders({ page: 1, pageSize: 1, status: "IN_PROGRESS" });
  const completed = useLabOrders({ page: 1, pageSize: 1, status: "RELEASED" });

  const rows = orders.data?.rows ?? [];

  const stats = [
    { label: "Pending", value: String(pending.data?.meta.total ?? 0), color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-950", icon: Clock },
    { label: "In Progress", value: String(inProgress.data?.meta.total ?? 0), color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-950", icon: FlaskConical },
    { label: "Completed", value: String(completed.data?.meta.total ?? 0), color: "text-green-600 dark:text-green-400", bg: "bg-green-100 dark:bg-green-950", icon: CheckCircle },
  ];

  return (
    <div className="p-6">
      {showModal && <NewOrderModal onClose={() => setShowModal(false)} />}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-[26px] font-extrabold text-foreground mb-1 font-['Plus_Jakarta_Sans',sans-serif]">Lab Orders</h1>
          <p className="text-muted-foreground text-[15px]">Order and track laboratory tests</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 py-3 px-5 bg-blue-600 text-white border-none rounded-xl font-bold text-sm cursor-pointer">
          <Plus size={16} /> Order Lab Test
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-card border border-border rounded-2xl p-6 flex gap-14 items-center card-shadow">
              <div className={cn("w-[46px] h-[46px] rounded-[14px] flex items-center justify-center", s.bg)}>
                <Icon size={20} className={s.color} />
              </div>
              <div>
                <div className="text-[28px] font-extrabold text-foreground font-mono">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 mb-5 bg-muted rounded-xl p-1 w-fit">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => {
              setFilter(f.value);
              setPage(1);
            }}
            className={cn(
              "px-4 py-2 rounded-[10px] border-none cursor-pointer text-[13px]",
              filter === f.value ? "bg-card text-foreground font-bold shadow-sm" : "bg-transparent text-muted-foreground font-medium",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Orders Table */}
      <div className="bg-card border border-border rounded-2xl p-6 card-shadow">
        {orders.isLoading && <QueryLoading text="Loading lab orders…" />}
        {orders.isError && <QueryError error={orders.error} onRetry={() => void orders.refetch()} />}

        {!orders.isLoading && !orders.isError && (
          <>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {["Order ID", "Patient", "MRN", "Specimens", "Priority", "Ordered", "Status"].map((h) => (
                    <th key={h} className="text-left text-[11px] font-bold text-muted-foreground py-2 px-3 border-b border-border uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((order, i) => (
                  <tr key={order.id} className={i % 2 === 0 ? "bg-transparent" : "bg-muted"}>
                    <td className="py-3.5 px-3 text-xs font-mono font-semibold text-blue-600 dark:text-blue-400">{order.id.slice(0, 8)}</td>
                    <td className="py-3.5 px-3 text-[13px] font-semibold text-foreground">{order.patientName}</td>
                    <td className="py-3.5 px-3 text-xs font-mono text-muted-foreground">{order.mrn}</td>
                    <td className="py-3.5 px-3 text-[13px] text-foreground">
                      {order.specimens.length > 0 ? order.specimens.join(", ") : `${order.itemCount} tests`}
                    </td>
                    <td className="py-3.5 px-3">
                      <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-md", order.priority === "STAT" ? "bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400" : "bg-muted text-muted-foreground")}>
                        {toLabel(order.priority)}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-xs text-muted-foreground">{formatDate(order.orderedAt)}</td>
                    <td className="py-3.5 px-3">
                      <span className={cn("text-[11px] font-bold px-2.5 py-[3px] rounded-full inline-flex items-center gap-1", statusClass[order.status] ?? "bg-muted text-muted-foreground")}>
                        {toLabel(order.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <div className="text-center py-8 text-muted-foreground text-[13px]">No lab orders for this filter.</div>}
            <ServerPager meta={orders.data?.meta} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
