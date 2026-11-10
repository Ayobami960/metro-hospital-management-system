import { useState } from "react";
import { toast } from "sonner";
import { FileText, Download, Eye, AlertTriangle, ChevronDown, ChevronRight, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

import { useMyClinicalSummary } from "@/hooks/clinical/clinical.hooks";
import { useSession } from "@/hooks/auth/use-session";
import { useMyDocuments, useUploadFile } from "@/hooks/files/files.hooks";
import { QueryError, QueryLoading, InlineEmpty } from "@/components/globals/query-state";
import { ServerPager } from "@/components/globals/server-pager";
import { errorMessage } from "@/services/api/api-error";
import { formatDate, formatDateTime, label as toLabel } from "@/lib/format";
import { filesApi } from "@/services/files/files.api";

const SECTIONS = [
  { id: "timeline", label: "📋 Timeline" },
  { id: "conditions", label: "🏥 Conditions" },
  { id: "allergies", label: "⚠️ Allergies" },
  { id: "medications", label: "💊 Medications" },
  { id: "documents", label: "📁 Documents" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

const severityBadge: Record<string, string> = {
  SEVERE: "bg-red-600 dark:bg-red-500",
  LIFE_THREATENING: "bg-red-700 dark:bg-red-600",
  MODERATE: "bg-amber-600 dark:bg-amber-500",
  MILD: "bg-slate-500 dark:bg-slate-400",
};

export default function MedicalRecordsPage() {
  const [activeSection, setActiveSection] = useState<SectionId>("timeline");
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [docPage, setDocPage] = useState(1);

  const { data: session } = useSession();
  const summary = useMyClinicalSummary();
  const documents = useMyDocuments({ page: docPage, pageSize: 10 });
  const upload = useUploadFile();

  const encounters = summary.data?.recentEncounters ?? [];
  const problems = summary.data?.problems ?? [];
  const allergies = summary.data?.allergies ?? [];
  const medications = summary.data?.activeMedications ?? [];
  const files = documents.data?.rows ?? [];

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    upload.mutate(
      { file, input: { ownerType: "PATIENT", patientId: session?.patientId ?? undefined } },
      {
        onSuccess: () => toast.success("Document uploaded"),
        onError: (error) => toast.error(errorMessage(error, "Could not upload the document.")),
      },
    );
    event.target.value = "";
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-[26px] font-extrabold text-foreground mb-1 font-['Plus_Jakarta_Sans',sans-serif]">Medical Records</h1>
          <p className="text-muted-foreground text-[15px]">
            Patient: {session?.name ?? "—"} · MRN: {summary.data?.patientId?.slice(0, 8) ?? "—"}
          </p>
        </div>
        <div className="flex gap-2.5">
          <label className="flex items-center gap-1.5 py-[9px] px-4 bg-muted text-foreground border border-border rounded-[10px] text-[13px] font-semibold cursor-pointer">
            <Upload size={14} /> {upload.isPending ? "Uploading…" : "Upload Document"}
            <input type="file" className="hidden" onChange={handleUpload} disabled={upload.isPending} />
          </label>
          <a
            href="/api/v1/exports/patients?format=xlsx"
            className="flex items-center gap-1.5 py-[9px] px-4 bg-blue-600 text-white border-none rounded-[10px] text-[13px] font-semibold cursor-pointer"
          >
            <Download size={14} /> Export All
          </a>
        </div>
      </div>

      {summary.isLoading && <QueryLoading text="Loading your record…" />}
      {summary.isError && <QueryError error={summary.error} onRetry={() => void summary.refetch()} />}

      {/* Patient Summary */}
      {summary.data && (
        <div className="bg-card border border-border rounded-2xl p-6 mb-5 grid grid-cols-5 gap-4">
          {[
            { label: "Active Problems", value: String(summary.data.counts.activeProblems), icon: "❤️" },
            { label: "Allergies", value: String(summary.data.counts.activeAllergies), icon: "⚠️" },
            { label: "Severe Allergies", value: String(summary.data.counts.severeAllergies), icon: "🚨" },
            { label: "Active Medications", value: String(summary.data.counts.activeMedications), icon: "💊" },
            {
              label: "Last Vitals",
              value: summary.data.latestVitals ? formatDate(summary.data.latestVitals.recordedAt) : "—",
              icon: "📊",
            },
          ].map((item) => (
            <div key={item.label} className="text-center py-3 bg-muted rounded-xl">
              <div className="text-2xl mb-1.5">{item.icon}</div>
              <div className="text-xl font-extrabold text-foreground font-['Plus_Jakarta_Sans',sans-serif]">{item.value}</div>
              <div className="text-xs text-muted-foreground">{item.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Section Nav */}
      <div className="flex gap-1.5 mb-5 flex-wrap">
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={cn(
              "py-[9px] px-[18px] rounded-[10px] text-[13px] font-semibold cursor-pointer transition-all duration-150",
              activeSection === section.id
                ? "border-2 border-blue-600 dark:border-blue-400 bg-accent text-blue-600 dark:text-blue-400"
                : "border border-border bg-card text-foreground",
            )}
          >
            {section.label}
          </button>
        ))}
      </div>

      {activeSection === "timeline" && (
        <div className="flex flex-col">
          {encounters.map((encounter, index) => (
            <div key={encounter.id} className="flex gap-4 relative">
              <div className="flex flex-col items-center">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0 z-10 border-2 border-blue-600 dark:border-blue-400 bg-transparent">
                  🏥
                </div>
                {index < encounters.length - 1 && <div className="w-0.5 flex-1 bg-border min-h-5" />}
              </div>
              <div className="flex-1 pb-5">
                <div
                  className="bg-card rounded-xl p-4 px-5 cursor-pointer border border-border"
                  onClick={() => setExpandedItem(expandedItem === encounter.id ? null : encounter.id)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-[13px] text-muted-foreground mb-1">
                        {formatDate(encounter.startedAt)} · {toLabel(encounter.type)}
                      </div>
                      <div className="text-[15px] font-bold text-foreground mb-1">
                        {encounter.chiefComplaint ?? "Encounter"}
                      </div>
                      <div className="text-xs text-muted-foreground">Status {toLabel(encounter.status)}</div>
                    </div>
                    <div className="flex gap-2 items-center">
                      {expandedItem === encounter.id ? (
                        <ChevronDown size={18} color="var(--muted-foreground)" />
                      ) : (
                        <ChevronRight size={18} color="var(--muted-foreground)" />
                      )}
                    </div>
                  </div>
                  {expandedItem === encounter.id && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <div className="text-sm text-foreground mb-3">
                        Started {formatDateTime(encounter.startedAt)}
                        {encounter.endedAt ? ` · Ended ${formatDateTime(encounter.endedAt)}` : " · Still open"}
                      </div>
                      <div className="flex gap-2">
                        <a href="/patient/messages" className="flex items-center gap-1.5 py-[7px] px-3.5 bg-muted text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-semibold cursor-pointer">
                          <Eye size={13} /> Ask About This Visit
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {!summary.isLoading && encounters.length === 0 && <InlineEmpty text="No encounters recorded yet." />}
        </div>
      )}

      {activeSection === "conditions" && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="text-base font-bold text-foreground mb-4 font-['Plus_Jakarta_Sans',sans-serif]">Active &amp; Past Conditions</h3>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b-2 border-border">
                {["Condition", "ICD-10", "Onset", "Status", "Managed By"].map((h) => (
                  <th key={h} className="py-2.5 px-3.5 text-left text-xs font-bold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {problems.map((problem) => (
                <tr key={problem.id} className="border-b border-border">
                  <td className="p-3.5 font-bold text-foreground">{problem.diagnosis}</td>
                  <td className="p-3.5 font-mono text-xs text-muted-foreground">{problem.icd10Code ?? "—"}</td>
                  <td className="p-3.5 text-muted-foreground">{problem.onsetDate ? formatDate(problem.onsetDate) : "—"}</td>
                  <td className="p-3.5">
                    <span
                      className={cn(
                        "text-[11px] font-bold px-2.5 py-[3px] rounded-full",
                        problem.status === "ACTIVE"
                          ? "bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400"
                          : problem.status === "MONITORING"
                            ? "bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400"
                            : "bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400",
                      )}
                    >
                      {toLabel(problem.status)}
                    </span>
                  </td>
                  <td className="p-3.5 text-foreground">{problem.managedByName ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {problems.length === 0 && <InlineEmpty text="No conditions on file." />}
        </div>
      )}

      {activeSection === "allergies" && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="text-base font-bold text-foreground mb-4 font-['Plus_Jakarta_Sans',sans-serif]">Known Allergies</h3>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 w-full">
            {allergies.map((allergy) => (
              <div
                key={allergy.id}
                className={cn(
                  "p-4 rounded-xl border",
                  allergy.severity === "SEVERE" || allergy.severity === "LIFE_THREATENING"
                    ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
                    : "bg-muted border-border",
                )}
              >
                <div className="flex justify-between mb-2 gap-2">
                  <div className="text-[15px] font-bold text-foreground">{allergy.allergen}</div>
                  <span className={cn("text-[11px] font-bold px-2.5 py-[3px] rounded-full text-white", severityBadge[allergy.severity] ?? "bg-slate-500")}>
                    {toLabel(allergy.severity)}
                  </span>
                </div>
                <div className="text-[13px] text-muted-foreground">Reaction: {allergy.reaction ?? "Not recorded"}</div>
                <div className="text-xs text-muted-foreground mt-1">Recorded: {formatDate(allergy.recordedAt)}</div>
              </div>
            ))}
          </div>
          {allergies.length === 0 && (
            <InlineEmpty text={summary.data?.noKnownAllergies ? "No known allergies." : "No allergies on file."} />
          )}
        </div>
      )}

      {activeSection === "medications" && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="text-base font-bold text-foreground mb-4 font-['Plus_Jakarta_Sans',sans-serif]">Current Medications</h3>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b-2 border-border">
                {["Medication", "Dose", "Frequency", "Route", "Since", "Status"].map((h) => (
                  <th key={h} className="py-2.5 px-3.5 text-left text-xs font-bold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {medications.map((medication) => (
                <tr key={medication.id} className="border-b border-border">
                  <td className="p-3.5 font-semibold text-foreground">{medication.drugName}</td>
                  <td className="p-3.5 font-mono text-foreground">{medication.dose}</td>
                  <td className="p-3.5 text-muted-foreground">{medication.frequency}</td>
                  <td className="p-3.5 text-muted-foreground">{medication.route}</td>
                  <td className="p-3.5 text-muted-foreground">{medication.startDate ? formatDate(medication.startDate) : "—"}</td>
                  <td className="p-3.5">
                    <span className="text-[11px] font-bold px-2.5 py-[3px] rounded-full bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400">
                      {toLabel(medication.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {medications.length === 0 && <InlineEmpty text="No active medications." />}
        </div>
      )}

      {activeSection === "documents" && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-bold text-foreground font-['Plus_Jakarta_Sans',sans-serif]">Medical Documents</h3>
            <label className="flex items-center gap-1.5 py-2 px-3.5 bg-blue-600 text-white border-none rounded-lg text-[13px] font-semibold cursor-pointer">
              <Upload size={13} /> Upload
              <input type="file" className="hidden" onChange={handleUpload} disabled={upload.isPending} />
            </label>
          </div>
          {documents.isLoading && <QueryLoading text="Loading documents…" />}
          {documents.isError && <QueryError error={documents.error} onRetry={() => void documents.refetch()} />}
          <div className="flex flex-col gap-2.5">
            {files.map((file) => (
              <div key={file.id} className="flex items-center gap-3.5 py-3.5 px-4 bg-muted rounded-xl">
                <div className="w-10 h-10 rounded-[10px] bg-red-100 dark:bg-red-950 flex items-center justify-center shrink-0">
                  <FileText size={18} className="text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-foreground">{file.fileName}</div>
                  <div className="text-xs text-muted-foreground">
                    {file.contentType} · {(file.sizeBytes / 1024).toFixed(0)} KB · {formatDate(file.createdAt)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      filesApi
                        .download(file.id, file.fileName)
                        .catch((error) => toast.error(errorMessage(error, "Could not open the document.")))
                    }
                    className="flex items-center gap-1 py-[7px] px-3 bg-card text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-[7px] text-xs font-semibold cursor-pointer"
                  >
                    <Eye size={13} /> View
                  </button>
                  <button
                    onClick={() =>
                      filesApi
                        .download(file.id, file.fileName)
                        .catch((error) => toast.error(errorMessage(error, "Could not download the document.")))
                    }
                    className="flex items-center gap-1 py-[7px] px-3 bg-card text-foreground border border-border rounded-[7px] text-xs font-semibold cursor-pointer"
                  >
                    <Download size={13} /> Download
                  </button>
                </div>
              </div>
            ))}
          </div>
          {!documents.isLoading && files.length === 0 && <InlineEmpty text="No documents uploaded yet." />}
          <ServerPager meta={documents.data?.meta} onPageChange={setDocPage} />
        </div>
      )}

      {summary.data?.counts.severeAllergies ? (
        <div className="mt-4 flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
          <AlertTriangle size={14} />
          Severe allergies on file — always inform your care team before starting a new medication.
        </div>
      ) : null}
    </div>
  );
}
