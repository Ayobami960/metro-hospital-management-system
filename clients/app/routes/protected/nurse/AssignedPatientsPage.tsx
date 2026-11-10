import { useState } from "react";
import { AlertTriangle, User, FileText, Activity, Bell, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

import { useAssignedPatients, usePatientVitals } from "@/hooks/nursing/nursing.hooks";
import { useClinicalSummary } from "@/hooks/clinical/clinical.hooks";
import { QueryError, QueryLoading, InlineEmpty } from "@/components/globals/query-state";
import { ServerPager } from "@/components/globals/server-pager";
import { formatDate, formatDateTime, initialsOf, isoDate, relativeTime } from "@/lib/format";
import type { AssignedPatient } from "@/services/nursing/nursing.api";

function PatientCard({ patient }: { patient: AssignedPatient }) {
  const summary = useClinicalSummary(patient.id);
  const vitals = usePatientVitals(patient.id, { pageSize: 1 });

  const allergies = summary.data?.allergies ?? [];
  const activeProblems = (summary.data?.problems ?? []).filter((problem) => problem.status !== "RESOLVED");
  const severe = allergies.filter((allergy) => allergy.severity === "SEVERE" || allergy.severity === "LIFE_THREATENING");
  const latest = vitals.data?.rows?.[0] ?? summary.data?.latestVitals ?? null;
  const statusClass = severe.length > 0
    ? "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400"
    : "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400";
  const borderClass = severe.length > 0
    ? "border-l-red-500 dark:border-l-red-400"
    : "border-l-green-500 dark:border-l-green-400";

  return (
    <div className={cn("bg-card border border-border rounded-2xl p-6 relative border-l-4", borderClass)}>
      {/* Header */}
      <div className="flex justify-between items-start mb-3.5">
        <div className="flex gap-3 items-center">
          <div className={cn("w-11 h-11 rounded-full flex items-center justify-center text-sm font-extrabold", statusClass)}>
            {initialsOf(`${patient.firstName} ${patient.lastName}`)}
          </div>
          <div>
            <div className="text-[15px] font-bold text-foreground">
              {patient.firstName} {patient.lastName}
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              {patient.mrn} · {patient.age} yrs
            </div>
          </div>
        </div>
        <span className={cn("text-[11px] font-bold px-3 py-1 rounded-full", statusClass)}>
          {severe.length > 0 ? "Allergy Alert" : "Stable"}
        </span>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-2 mb-3.5">
        {[
          ["Bed", patient.bedId ? patient.bedId.slice(0, 8) : "Unassigned"],
          ["Date of Birth", formatDate(patient.dateOfBirth)],
          ["Active Problems", activeProblems.length > 0 ? activeProblems.map((problem) => problem.diagnosis).join(", ") : "None recorded"],
          ["Last Vitals", latest ? relativeTime(latest.recordedAt) : "Not recorded"],
        ].map(([label, value]) => (
          <div key={label}>
            <div className="text-[11px] text-muted-foreground font-semibold mb-0.5">{label}</div>
            <div className="text-[13px] text-foreground font-medium">{value}</div>
          </div>
        ))}
      </div>

      {/* Allergy note */}
      <div className="py-2.5 px-3 bg-muted rounded-lg mb-3.5">
        <div className="text-[11px] font-bold text-muted-foreground mb-1 flex items-center gap-1">
          <FileText size={11} /> ALLERGIES
        </div>
        <div className="text-xs text-foreground leading-relaxed">
          {summary.isLoading
            ? "Loading…"
            : summary.data?.noKnownAllergies
              ? "No known allergies"
              : allergies.length > 0
                ? allergies.map((allergy) => `${allergy.allergen} (${allergy.severity})`).join(", ")
                : "Not recorded"}
        </div>
      </div>

      {/* Alerts */}
      {severe.length > 0 && (
        <div className="mb-3.5">
          {severe.map((allergy) => (
            <div key={allergy.id} className="flex items-center gap-1.5 py-1.5 px-2.5 bg-red-100 dark:bg-red-950 rounded-md mb-1">
              <AlertTriangle size={12} className="text-red-600 dark:text-red-400" />
              <span className="text-xs text-red-600 font-semibold">
                {allergy.allergen} — {allergy.reaction ?? "severe reaction"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex gap-2">
        {[
          { label: "View Vitals", icon: Activity, href: "/nurse/vitals", color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-100 dark:bg-cyan-950" },
          { label: "Add Note", icon: FileText, href: "/nurse/progress-notes", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-950" },
          { label: "Message", icon: Bell, href: "/nurse/messages", color: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-950" },
        ].map((action) => {
          const Icon = action.icon;
          return (
            <a
              key={action.label}
              href={action.href}
              className={cn("flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold border-[1.5px] cursor-pointer transition-all duration-150", action.bg, action.color)}
            >
              <Icon size={12} />
              {action.label}
            </a>
          );
        })}
      </div>
    </div>
  );
}

export default function AssignedPatientsPage() {
  const [page, setPage] = useState(1);
  const assigned = useAssignedPatients({ page, pageSize: 10 });
  const rows = assigned.data?.rows ?? [];

  const stats = [
    { label: "Total Assigned", value: String(assigned.data?.meta.total ?? rows.length), icon: User, color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-100 dark:bg-cyan-950" },
    { label: "Beds Assigned", value: String(rows.filter((patient) => patient.bedId).length), icon: Clock, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-950" },
    { label: "Awaiting Bed", value: String(rows.filter((patient) => !patient.bedId).length), icon: AlertTriangle, color: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-950" },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-[26px] font-extrabold text-foreground mb-1 font-['Plus_Jakarta_Sans',sans-serif]">Assigned Patients</h1>
        <p className="text-muted-foreground text-[15px]">Your shift panel · {formatDate(isoDate())}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-card border border-border rounded-2xl p-6 flex gap-3.5 items-center card-shadow">
              <div className={cn("w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0", s.bg)}>
                <Icon size={22} className={s.color} />
              </div>
              <div>
                <div className="text-[28px] font-extrabold text-foreground font-mono">{s.value}</div>
                <div className="text-[13px] text-muted-foreground">{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {assigned.isLoading && <QueryLoading text="Loading your patients…" />}
      {assigned.isError && <QueryError error={assigned.error} onRetry={() => void assigned.refetch()} />}

      {!assigned.isLoading && !assigned.isError && (
        <>
          {rows.length === 0 ? (
            <InlineEmpty text="No patients are assigned to you for this shift." />
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))" }}>
              {rows.map((patient) => (
                <PatientCard key={patient.id} patient={patient} />
              ))}
            </div>
          )}
          <ServerPager meta={assigned.data?.meta} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
