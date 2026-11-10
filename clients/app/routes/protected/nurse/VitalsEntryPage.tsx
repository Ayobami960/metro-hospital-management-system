import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle, TrendingUp, TrendingDown, Minus, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

import { useAssignedPatients, usePatientVitals, useRecordVitals } from "@/hooks/nursing/nursing.hooks";
import { QueryError, QueryLoading, InlineEmpty } from "@/components/globals/query-state";
import { ServerPager } from "@/components/globals/server-pager";
import { errorMessage } from "@/services/api/api-error";
import { formatDateTime } from "@/lib/format";

const numberInput =
  "w-full py-[9px] px-3 border-[1.5px] border-border rounded-lg text-[13px] bg-card text-foreground outline-none box-border font-mono";

function TrendIcon({ current, previous }: { current: number; previous: number }) {
  if (current > previous) return <TrendingUp size={14} className="text-red-600 dark:text-red-400" />;
  if (current < previous) return <TrendingDown size={14} className="text-green-600 dark:text-green-400" />;
  return <Minus size={14} className="text-slate-500 dark:text-slate-400" />;
}

export default function VitalsEntryPage() {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [form, setForm] = useState({
    systolic: "",
    diastolic: "",
    hr: "",
    temp: "",
    spo2: "",
    rr: "",
    weight: "",
    pain: 0,
  });

  const patients = useAssignedPatients({ pageSize: 50 });
  const list = patients.data?.rows ?? [];
  const patient = list.find((entry) => entry.id === selectedId) ?? list[0] ?? null;
  const history = usePatientVitals(patient?.id, { page, pageSize: 10 });
  const recordVitals = useRecordVitals();

  const rows = history.data?.rows ?? [];

  const save = async () => {
    if (!patient) return;
    if (!form.systolic && !form.diastolic && !form.hr && !form.spo2 && !form.rr) {
      toast.error("Enter at least one vital sign before saving.");
      return;
    }
    const weightLbs = Number(form.weight);
    try {
      await recordVitals.mutateAsync({
        patientId: patient.id,
        systolic: form.systolic ? Number(form.systolic) : undefined,
        diastolic: form.diastolic ? Number(form.diastolic) : undefined,
        heartRate: form.hr ? Number(form.hr) : undefined,
        temperatureC: form.temp ? Math.round(((Number(form.temp) - 32) * 5) / 9 * 10) / 10 : undefined,
        spo2: form.spo2 ? Number(form.spo2) : undefined,
        respiratoryRate: form.rr ? Number(form.rr) : undefined,
        weightKg: weightLbs ? Math.round(weightLbs * 0.4536 * 10) / 10 : undefined,
        painScore: form.pain,
        notes: undefined,
      });
      toast.success("Vitals recorded");
      setSubmitted(patient.id);
      setForm({ systolic: "", diastolic: "", hr: "", temp: "", spo2: "", rr: "", weight: "", pain: 0 });
      setTimeout(() => setSubmitted(null), 2500);
    } catch (error) {
      toast.error(errorMessage(error, "Could not save the vitals."));
    }
  };

  if (patients.isLoading) {
    return (
      <div className="p-6">
        <QueryLoading text="Loading your patients…" />
      </div>
    );
  }

  if (patients.isError) {
    return (
      <div className="p-6">
        <QueryError error={patients.error} onRetry={() => void patients.refetch()} />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-[26px] font-extrabold text-foreground mb-1 font-['Plus_Jakarta_Sans',sans-serif]">Vitals Entry</h1>
        <p className="text-muted-foreground text-[15px]">Record and track patient vital signs</p>
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 1.5fr" }}>
        {/* Vitals Form */}
        <div className="flex flex-col gap-4">
          {/* Patient Selector */}
          <div className="bg-card border border-border rounded-2xl p-6 card-shadow">
            <div className="text-base font-bold text-foreground mb-4 font-['Plus_Jakarta_Sans',sans-serif]">Select Patient</div>
            {!patient && <InlineEmpty text="No patients assigned to you right now." />}
            {patient && (
              <div className="relative">
                <div onClick={() => setOpen(!open)} className="flex items-center justify-between py-2.5 px-3.5 border-[1.5px] border-border rounded-[10px] cursor-pointer bg-card">
                  <div>
                    <div className="text-sm font-bold text-foreground">
                      {patient.firstName} {patient.lastName}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {patient.mrn} · {patient.bedId ? "Bed assigned" : "No bed"}
                    </div>
                  </div>
                  <ChevronDown size={16} color="var(--muted-foreground)" className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
                </div>
                {open && (
                  <div className="absolute top-full left-0 right-0 bg-card border-[1.5px] border-border rounded-[10px] z-10 mt-1 shadow-lg max-h-64 overflow-y-auto">
                    {list.map((entry) => (
                      <div
                        key={entry.id}
                        onClick={() => {
                          setSelectedId(entry.id);
                          setPage(1);
                          setOpen(false);
                        }}
                        className="py-2.5 px-3.5 cursor-pointer border-b border-border"
                        style={{ background: patient.id === entry.id ? "var(--accent)" : "transparent" }}
                      >
                        <div className="text-[13px] font-semibold text-foreground">
                          {entry.firstName} {entry.lastName}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono">{entry.mrn}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Vitals Form */}
          <div className="bg-card border border-border rounded-2xl p-6 card-shadow">
            <div className="text-base font-bold text-foreground mb-4 font-['Plus_Jakarta_Sans',sans-serif]">Record Vitals</div>
            {submitted ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <CheckCircle size={48} className="text-green-600 dark:text-green-400" />
                <div className="text-base font-bold text-green-600">Vitals Saved Successfully</div>
                <div className="text-[13px] text-muted-foreground">
                  Recorded for {patient?.firstName} {patient?.lastName}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {/* Blood Pressure */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Blood Pressure (mmHg)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input className={numberInput} type="number" placeholder="Systolic" value={form.systolic} onChange={(e) => setForm((f) => ({ ...f, systolic: e.target.value }))} />
                    <input className={numberInput} type="number" placeholder="Diastolic" value={form.diastolic} onChange={(e) => setForm((f) => ({ ...f, diastolic: e.target.value }))} />
                  </div>
                </div>
                {(
                  [
                    { key: "hr", label: "Heart Rate", placeholder: "bpm", unit: "bpm" },
                    { key: "temp", label: "Temperature", placeholder: "98.6", unit: "°F" },
                    { key: "spo2", label: "SpO2", placeholder: "98", unit: "%" },
                    { key: "rr", label: "Respiratory Rate", placeholder: "16", unit: "breaths/min" },
                    { key: "weight", label: "Weight", placeholder: "160", unit: "lbs" },
                  ] as const
                ).map((field) => (
                  <div key={field.key}>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      {field.label} <span className="text-muted-foreground font-normal">({field.unit})</span>
                    </label>
                    <input
                      className={numberInput}
                      type="number"
                      placeholder={field.placeholder}
                      value={form[field.key]}
                      onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                    />
                  </div>
                ))}

                {/* Pain Scale */}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Pain Scale: <span className="text-cyan-600 font-mono font-extrabold">{form.pain}/10</span>
                  </label>
                  <div className="flex flex-col gap-1">
                    <input
                      type="range"
                      min={0}
                      max={10}
                      value={form.pain}
                      onChange={(e) => setForm((f) => ({ ...f, pain: parseInt(e.target.value) }))}
                      className="w-full cursor-pointer"
                      style={{ accentColor: form.pain >= 7 ? "#dc2626" : form.pain >= 4 ? "#d97706" : "#16a34a" }}
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>0 No Pain</span>
                      <span>5 Moderate</span>
                      <span>10 Worst</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => void save()}
                  disabled={!patient || recordVitals.isPending}
                  className="w-full py-3 bg-cyan-600 text-white border-none rounded-[10px] text-sm font-bold cursor-pointer mt-1 disabled:opacity-60"
                >
                  {recordVitals.isPending ? "Saving…" : "Save Vitals"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Vitals History */}
        <div className="bg-card border border-border rounded-2xl p-6 card-shadow">
          <div className="text-base font-bold text-foreground mb-4 font-['Plus_Jakarta_Sans',sans-serif]">
            Recent Vitals History{patient ? ` — ${patient.firstName} ${patient.lastName}` : ""}
          </div>
          {history.isLoading && <QueryLoading text="Loading vitals…" />}
          {history.isError && <QueryError error={history.error} onRetry={() => void history.refetch()} />}
          {!history.isLoading && !history.isError && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b-2 border-border">
                      {["Date/Time", "BP", "HR", "Temp", "SpO2", "RR", "Pain"].map((h) => (
                        <th key={h} className="py-2 px-3 text-left text-[11px] font-bold text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((vital, i) => {
                      const previous = rows[i + 1];
                      return (
                        <tr key={vital.id} className={cn("border-b border-border", i === 0 && "bg-accent")}>
                          <td className="py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(vital.recordedAt)}</td>
                          <td className="py-3 font-mono font-bold text-foreground">
                            {vital.systolic ?? "—"}/{vital.diastolic ?? "—"}
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-1 font-mono font-bold text-foreground">
                              {vital.heartRate ?? "—"}
                              {previous?.heartRate != null && vital.heartRate != null && (
                                <TrendIcon current={vital.heartRate} previous={previous.heartRate} />
                              )}
                            </div>
                          </td>
                          <td className="py-3">
                            <div className={cn("flex items-center gap-1 font-mono", (vital.temperatureC ?? 0) > 37.5 ? "text-red-600 dark:text-red-400 font-bold" : "text-foreground")}>
                              {vital.temperatureC ?? "—"}
                              {previous?.temperatureC != null && vital.temperatureC != null && (
                                <TrendIcon current={vital.temperatureC} previous={previous.temperatureC} />
                              )}
                            </div>
                          </td>
                          <td className="py-3">
                            <div className={cn("flex items-center gap-1 font-mono", (vital.spo2 ?? 100) < 95 ? "text-red-600 dark:text-red-400 font-bold" : "text-foreground")}>
                              {vital.spo2 ?? "—"}%
                              {previous?.spo2 != null && vital.spo2 != null && (
                                <TrendIcon current={vital.spo2} previous={previous.spo2} />
                              )}
                            </div>
                          </td>
                          <td className="py-3 font-mono text-foreground">{vital.respiratoryRate ?? "—"}</td>
                          <td className="py-3">
                            <div className="flex items-center gap-1.5">
                              <div className="w-[60px] h-1.5 rounded-[3px] bg-border">
                                <div
                                  className={cn("h-full rounded-[3px]", (vital.painScore ?? 0) >= 7 ? "bg-red-500" : (vital.painScore ?? 0) >= 4 ? "bg-amber-500" : "bg-green-500")}
                                  style={{ width: `${(vital.painScore ?? 0) * 10}%` }}
                                />
                              </div>
                              <span className="font-mono text-xs text-foreground">{vital.painScore ?? "—"}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {rows.length === 0 && <InlineEmpty text="No vitals recorded for this patient yet." />}
              <ServerPager meta={history.data?.meta} onPageChange={setPage} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
