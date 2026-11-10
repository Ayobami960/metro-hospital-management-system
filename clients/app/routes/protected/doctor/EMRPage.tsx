import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { Search, FileText, Pill, AlertCircle, Save, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

import { usePatients, usePatient } from "@/hooks/patients/patients.hooks";
import { useClinicalSummary } from "@/hooks/clinical/clinical.hooks";
import { useCreateNote, usePatientVitals } from "@/hooks/nursing/nursing.hooks";
import { QueryError, QueryLoading, InlineEmpty } from "@/components/globals/query-state";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { errorMessage } from "@/services/api/api-error";
import { formatDate, formatDateTime, isoDate, label as toLabel } from "@/lib/format";

type EMRTab = "Summary" | "SOAP Notes" | "Vitals History" | "Problem List" | "Medications";
const TABS: EMRTab[] = ["Summary", "SOAP Notes", "Vitals History", "Problem List", "Medications"];

export default function EMRPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<EMRTab>("Summary");
  const [soap, setSoap] = useState({ s: "", o: "", a: "", p: "" });
  const [saved, setSaved] = useState(false);

  const patientId = searchParams.get("patientId");
  const patients = usePatients({ pageSize: 20, search: useDebouncedValue(search) || undefined });
  const patient = usePatient(patientId);
  const summary = useClinicalSummary(patientId);
  const vitals = usePatientVitals(patientId, { pageSize: 20 });
  const createNote = useCreateNote();

  const initials = useMemo(() => {
    const name = patient.data?.name ?? "";
    return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  }, [patient.data?.name]);

  const handleSave = async () => {
    if (!patientId) return;
    const content = [
      `S: ${soap.s}`.trim(),
      `O: ${soap.o}`.trim(),
      `A: ${soap.a}`.trim(),
      `P: ${soap.p}`.trim(),
    ].join("\n\n");
    if (content.replace(/[SOPA]:/g, "").trim().length === 0) {
      toast.error("Write at least one section before signing the note.");
      return;
    }
    try {
      await createNote.mutateAsync({
        patientId,
        title: `SOAP Note — ${formatDate(isoDate())}`,
        content,
        type: "SOAP",
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      toast.success("Note signed and saved");
    } catch (error) {
      toast.error(errorMessage(error, "Could not save the note."));
    }
  };

  const problems = summary.data?.problems ?? [];
  const medications = summary.data?.activeMedications ?? [];
  const allergies = summary.data?.allergies ?? [];
  const vitalsRows = vitals.data?.rows ?? [];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-[26px] font-extrabold text-foreground mb-1 font-['Plus_Jakarta_Sans',sans-serif]">Electronic Medical Records</h1>
        <p className="text-muted-foreground text-[15px]">View and document patient records</p>
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: "280px 1fr" }}>
        {/* Left Sidebar */}
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patients..."
              className="w-full py-2.5 px-2.5 pl-8 rounded-[10px] border border-border bg-card text-foreground text-[13px] box-border"
            />
          </div>
          {patients.isLoading && <div className="text-xs text-muted-foreground text-center py-3">Loading…</div>}
          {patients.isError && <QueryError error={patients.error} onRetry={() => void patients.refetch()} className="py-3" />}
          {(patients.data?.rows ?? []).map((row) => (
            <button
              key={row.id}
              onClick={() => {
                setSearchParams({ patientId: row.id });
                setActiveTab("Summary");
                setSaved(false);
              }}
              className={cn(
                "flex gap-3 items-center py-3 px-3.5 rounded-xl cursor-pointer text-left transition-colors",
                patientId === row.id ? "border-2 border-blue-600 bg-blue-100 dark:bg-blue-950" : "border border-border bg-card hover:bg-muted",
              )}
            >
              <div className="w-[38px] h-[38px] rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-400 shrink-0">
                {row.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
              </div>
              <div>
                <div className="text-[13px] font-bold text-foreground">{row.name}</div>
                <div className="text-[11px] text-muted-foreground font-mono">{row.mrn} · {row.age} yrs</div>
              </div>
            </button>
          ))}
          {patients.data && patients.data.rows.length === 0 && (
            <div className="text-xs text-muted-foreground text-center py-3">No patients match that search.</div>
          )}
        </div>

        {/* Main Content */}
        {!patientId && (
          <div className="bg-card border border-border rounded-2xl p-6 flex flex-col items-center justify-center min-h-[400px] text-muted-foreground">
            <FileText size={48} className="mb-4 opacity-30" />
            <p className="text-base font-semibold">Select a patient to view their EMR</p>
          </div>
        )}

        {patientId && patient.isLoading && <QueryLoading text="Loading the record…" />}
        {patientId && patient.isError && <QueryError error={patient.error} onRetry={() => void patient.refetch()} />}

        {patientId && patient.data && (
          <div className="flex flex-col gap-4">
            {/* Patient Header */}
            <div className="bg-card border border-border rounded-2xl p-6 flex gap-4 items-center">
              <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-lg font-bold text-blue-600 dark:text-blue-400">
                {initials}
              </div>
              <div className="flex-1">
                <div className="text-xl font-extrabold text-foreground font-['Plus_Jakarta_Sans',sans-serif]">{patient.data.name}</div>
                <div className="text-[13px] text-muted-foreground font-mono">
                  {patient.data.mrn} · DOB: {formatDate(patient.data.dateOfBirth)} · Age: {patient.data.age}
                </div>
                <div className="flex gap-3 mt-1.5 text-xs">
                  <span className="text-muted-foreground">
                    Blood Type: <strong className="text-foreground">{patient.data.bloodType ?? "—"}</strong>
                  </span>
                  <span className="text-muted-foreground">
                    Sex: <strong className="text-foreground">{toLabel(patient.data.sexAtBirth)}</strong>
                  </span>
                  <span className="text-red-600 dark:text-red-400">
                    Allergies:{" "}
                    <strong>
                      {summary.data?.noKnownAllergies
                        ? "None known"
                        : allergies.length > 0
                          ? allergies.map((allergy) => allergy.allergen).join(", ")
                          : "—"}
                    </strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-0.5 bg-muted rounded-xl p-1 w-fit">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3.5 py-2 rounded-[10px] border-none cursor-pointer text-xs ${activeTab === tab ? "bg-card text-foreground font-bold shadow-sm" : "bg-transparent text-muted-foreground font-medium"}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {summary.isError && <QueryError error={summary.error} onRetry={() => void summary.refetch()} />}

            {activeTab === "Summary" && (
              <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="text-[15px] font-bold text-foreground mb-3 font-['Plus_Jakarta_Sans',sans-serif]">Active Problems</h3>
                {summary.isLoading && <div className="text-xs text-muted-foreground py-2">Loading…</div>}
                <div className="flex flex-col gap-2">
                  {problems.filter((problem) => problem.status !== "RESOLVED").map((problem) => (
                    <div key={problem.id} className="flex items-center gap-3 py-2.5 px-3.5 bg-muted rounded-[10px] hover:bg-muted/80 transition-colors">
                      <AlertCircle size={16} className="text-amber-600 dark:text-amber-400" />
                      <span className="flex-1 text-sm font-semibold text-foreground">{problem.diagnosis}</span>
                      <span className="text-xs font-mono text-muted-foreground">{problem.icd10Code ?? "—"}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400 font-bold">
                        {toLabel(problem.status)}
                      </span>
                    </div>
                  ))}
                  {!summary.isLoading && problems.filter((problem) => problem.status !== "RESOLVED").length === 0 && (
                    <InlineEmpty text="No active problems recorded." />
                  )}
                </div>
                {summary.data?.latestVitals && (
                  <div className="mt-5 grid grid-cols-4 gap-3">
                    {[
                      { label: "Blood Pressure", value: `${summary.data.latestVitals.systolic ?? "—"}/${summary.data.latestVitals.diastolic ?? "—"}` },
                      { label: "Heart Rate", value: `${summary.data.latestVitals.heartRate ?? "—"} bpm` },
                      { label: "Temp", value: `${summary.data.latestVitals.temperatureC ?? "—"} °C` },
                      { label: "SpO₂", value: `${summary.data.latestVitals.spo2 ?? "—"} %` },
                    ].map((item) => (
                      <div key={item.label} className="bg-muted rounded-[10px] px-3.5 py-2.5">
                        <div className="text-[11px] text-muted-foreground">{item.label}</div>
                        <div className="text-sm font-bold text-foreground font-mono">{item.value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "SOAP Notes" && (
              <div className="bg-card border border-border rounded-2xl p-6">
                <div className="flex justify-between items-center mb-5">
                  <h3 className="text-[15px] font-bold text-foreground font-['Plus_Jakarta_Sans',sans-serif]">
                    SOAP Note — {formatDate(isoDate())}
                  </h3>
                  {saved ? (
                    <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400 text-[13px] font-semibold">
                      <CheckCircle size={15} /> Saved
                    </span>
                  ) : (
                    <button
                      onClick={() => void handleSave()}
                      disabled={createNote.isPending}
                      className="flex items-center gap-1.5 py-[9px] px-4 bg-blue-600 text-white border-none rounded-[10px] font-bold text-[13px] cursor-pointer disabled:opacity-60"
                    >
                      <Save size={14} /> {createNote.isPending ? "Saving…" : "Sign & Save Note"}
                    </button>
                  )}
                </div>
                {(["s", "o", "a", "p"] as const).map((key) => {
                  const labels = { s: "Subjective", o: "Objective", a: "Assessment", p: "Plan" };
                  const colors = {
                    s: "text-blue-600 dark:text-blue-400",
                    o: "text-violet-600 dark:text-violet-400",
                    a: "text-amber-600 dark:text-amber-400",
                    p: "text-green-600 dark:text-green-400",
                  };
                  return (
                    <div key={key} className="mb-4">
                      <label className={`text-[13px] font-bold block mb-1.5 ${colors[key]}`}>{labels[key]}</label>
                      <textarea
                        rows={4}
                        value={soap[key]}
                        onChange={(e) => setSoap((prev) => ({ ...prev, [key]: e.target.value }))}
                        className="w-full p-3 rounded-[10px] border border-border bg-background text-foreground text-sm box-border resize-y font-['Inter',sans-serif]"
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === "Vitals History" && (
              <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="text-[15px] font-bold text-foreground mb-4 font-['Plus_Jakarta_Sans',sans-serif]">Vitals History</h3>
                {vitals.isLoading && <QueryLoading text="Loading vitals…" />}
                {vitals.isError && <QueryError error={vitals.error} onRetry={() => void vitals.refetch()} />}
                {!vitals.isLoading && !vitals.isError && (
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        {["Date", "Blood Pressure", "Heart Rate", "Temp", "Weight", "O2 Sat"].map((h) => (
                          <th key={h} className="text-left text-[11px] font-bold text-muted-foreground py-2 px-3 border-b border-border uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {vitalsRows.map((row, i) => (
                        <tr key={row.id} className={i % 2 !== 0 ? "bg-muted hover:bg-muted/80" : "hover:bg-muted/50"}>
                          {[
                            formatDateTime(row.recordedAt),
                            `${row.systolic ?? "—"}/${row.diastolic ?? "—"}`,
                            `${row.heartRate ?? "—"} bpm`,
                            row.temperatureC != null ? `${row.temperatureC} °C` : "—",
                            row.weightKg != null ? `${row.weightKg} kg` : "—",
                            row.spo2 != null ? `${row.spo2} %` : "—",
                          ].map((value, j) => (
                            <td key={j} className={`py-3 px-3 text-[13px] text-foreground ${j > 0 ? "font-mono" : ""}`}>{value}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {!vitals.isLoading && !vitals.isError && vitalsRows.length === 0 && (
                  <InlineEmpty text="No vitals recorded for this patient." />
                )}
              </div>
            )}

            {activeTab === "Problem List" && (
              <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="text-[15px] font-bold text-foreground mb-4 font-['Plus_Jakarta_Sans',sans-serif]">Problem List</h3>
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      {["Diagnosis", "ICD-10", "Onset", "Status"].map((h) => (
                        <th key={h} className="text-left text-[11px] font-bold text-muted-foreground py-2 px-3 border-b border-border uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {problems.map((problem, i) => (
                      <tr key={problem.id} className={i % 2 !== 0 ? "bg-muted hover:bg-muted/80" : "hover:bg-muted/50"}>
                        <td className="py-3 px-3 text-sm font-semibold text-foreground">{problem.diagnosis}</td>
                        <td className="py-3 px-3 text-[13px] font-mono text-violet-600 dark:text-violet-400">{problem.icd10Code ?? "—"}</td>
                        <td className="py-3 px-3 text-[13px] text-muted-foreground">{problem.onsetDate ? formatDate(problem.onsetDate) : "—"}</td>
                        <td className="py-3 px-3">
                          <span className="text-[11px] font-bold px-2.5 py-[3px] rounded-full bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400">
                            {toLabel(problem.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {problems.length === 0 && <InlineEmpty text="No problems recorded for this patient." />}
              </div>
            )}

            {activeTab === "Medications" && (
              <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="text-[15px] font-bold text-foreground mb-4 font-['Plus_Jakarta_Sans',sans-serif]">Current Medications</h3>
                <div className="flex flex-col gap-2.5">
                  {medications.map((medication) => (
                    <div key={medication.id} className="flex gap-3.5 items-center py-3.5 px-4 bg-muted rounded-xl hover:bg-muted/80 transition-colors">
                      <div className="w-[38px] h-[38px] rounded-[10px] bg-violet-100 dark:bg-violet-950 flex items-center justify-center">
                        <Pill size={16} className="text-violet-600 dark:text-violet-400" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-bold text-foreground">
                          {medication.drugName} <span className="font-mono text-[13px] text-violet-600 dark:text-violet-400">{medication.dose}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {medication.frequency} · {medication.route}
                          {medication.startDate ? ` · Since ${formatDate(medication.startDate)}` : ""}
                        </div>
                      </div>
                      <span className="text-[11px] font-bold px-2.5 py-[3px] rounded-full bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400">
                        {toLabel(medication.status)}
                      </span>
                    </div>
                  ))}
                </div>
                {medications.length === 0 && <InlineEmpty text="No active medications." />}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
