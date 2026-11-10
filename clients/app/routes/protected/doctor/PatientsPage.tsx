import { useState } from "react";
import { Search, FileText, MessageSquare, Calendar, AlertCircle, Activity, Users } from "lucide-react";
import { cn } from "@/lib/utils";

import { usePatients } from "@/hooks/patients/patients.hooks";
import { useClinicalSummary } from "@/hooks/clinical/clinical.hooks";
import { QueryError, QueryLoading } from "@/components/globals/query-state";
import { ServerPager } from "@/components/globals/server-pager";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { errorMessage } from "@/services/api/api-error";
import { formatDate, label as toLabel } from "@/lib/format";

const statusStyles: Record<string, { bg: string; text: string }> = {
  ACTIVE: { bg: "#dcfce7", text: "#16a34a" },
  INACTIVE: { bg: "#fee2e2", text: "#dc2626" },
};

/** Clinical facts are read from the summary endpoint for the cards on screen. */
function PatientCard({ patient }: { patient: { id: string; name: string; mrn: string; dateOfBirth: string; age: number; status: string } }) {
  const summary = useClinicalSummary(patient.id);
  const activeProblems = (summary.data?.problems ?? []).filter((problem) => problem.status !== "RESOLVED");
  const severeAllergies = (summary.data?.allergies ?? []).filter((allergy) => allergy.active);
  const style = statusStyles[patient.status] ?? statusStyles.INACTIVE;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 card-shadow">
      <div className="flex gap-3.5 mb-4">
        <div className="w-[52px] h-[52px] rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-sm font-bold text-blue-600 dark:text-blue-400 shrink-0">
          {patient.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
        </div>
        <div className="flex-1">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-[15px] font-bold text-foreground font-['Plus_Jakarta_Sans',sans-serif]">{patient.name}</div>
              <div className="text-xs text-muted-foreground font-mono">
                {patient.mrn} · DOB: {formatDate(patient.dateOfBirth)} · {patient.age} yrs
              </div>
            </div>
            <div className="flex gap-1.5">
              {severeAllergies.length > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400">
                  {severeAllergies.length} allergies
                </span>
              )}
              <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full")} style={{ backgroundColor: style.bg, color: style.text }}>
                {toLabel(patient.status)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-muted rounded-[10px] px-3.5 py-2.5 mb-3.5">
        <div className="text-[11px] text-muted-foreground mb-0.5">Active Problems</div>
        <div className="text-[13px] font-semibold text-foreground">
          {summary.isLoading
            ? "Loading…"
            : summary.isError
              ? errorMessage(summary.error)
              : activeProblems.length > 0
                ? activeProblems.map((problem) => problem.diagnosis).join(", ")
                : "None recorded"}
        </div>
      </div>

      <div className="flex gap-4 mb-3.5 text-xs">
        <div>
          <div className="text-muted-foreground mb-0.5">Active Medications</div>
          <div className="text-foreground font-semibold">{summary.data?.counts.activeMedications ?? "—"}</div>
        </div>
        <div>
          <div className="text-muted-foreground mb-0.5">Last Vitals</div>
          <div className="text-blue-600 dark:text-blue-400 font-semibold">
            {summary.data?.latestVitals ? formatDate(summary.data.latestVitals.recordedAt) : "—"}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <a href={`/doctor/emr?patientId=${patient.id}`} className="flex-1 py-2 bg-blue-600 text-white border-none rounded-lg text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5">
          <FileText size={13} /> View EMR
        </a>
        <a href="/doctor/messages" className="flex-1 py-2 bg-muted text-foreground border-none rounded-lg text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5">
          <MessageSquare size={13} /> Message
        </a>
        <a href="/doctor/appointments" className="flex-1 py-2 bg-muted text-foreground border-none rounded-lg text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5">
          <Calendar size={13} /> Schedule
        </a>
      </div>
    </div>
  );
}

export default function PatientsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const patients = usePatients({ page, pageSize: 10, search: useDebouncedValue(search) || undefined });
  const rows = patients.data?.rows ?? [];

  const stats = [
    { label: "Total Panel", value: String(patients.data?.meta.total ?? rows.length), icon: Users, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-950" },
    { label: "Active", value: String(rows.filter((p) => p.status === "ACTIVE").length), icon: Activity, color: "text-green-600 dark:text-green-400", bg: "bg-green-100 dark:bg-green-950" },
    { label: "Inactive", value: String(rows.filter((p) => p.status === "INACTIVE").length), icon: AlertCircle, color: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-950" },
  ];

  const visible = status ? rows.filter((p) => p.status === status) : rows;

  return (
    <div className="p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-[26px] font-extrabold text-foreground mb-1 font-['Plus_Jakarta_Sans',sans-serif]">My Patients</h1>
          <p className="text-muted-foreground text-[15px]">Manage and track your patient panel</p>
        </div>
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

      {/* Search + Filter */}
      <div className="flex gap-3 mb-5">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name or MRN..."
            className="w-full py-2.5 px-3 pl-10 rounded-[10px] border border-border bg-card text-foreground text-sm box-border"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="py-2.5 px-3 rounded-[10px] border border-border bg-card text-foreground text-sm"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      {patients.isLoading && <QueryLoading text="Loading your panel…" />}
      {patients.isError && <QueryError error={patients.error} onRetry={() => void patients.refetch()} />}

      {!patients.isLoading && !patients.isError && (
        <>
          <div className="grid grid-cols-2 gap-4">
            {visible.map((patient) => (
              <PatientCard key={patient.id} patient={patient} />
            ))}
          </div>
          {visible.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">No patients in your panel match this search.</div>
          )}
          <ServerPager meta={patients.data?.meta} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
