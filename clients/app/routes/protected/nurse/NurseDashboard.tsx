import { useState } from "react";
import { toast } from "sonner";
import { Activity, Heart, CheckCircle, Pill, AlertTriangle, Users } from "lucide-react";
import { cn } from "@/lib/utils";

import { useNurseDashboard } from "@/hooks/dashboards/dashboard.hooks";
import { useAdministerMedication, useRecordVitals } from "@/hooks/nursing/nursing.hooks";
import { QueryError, QueryLoading, InlineEmpty } from "@/components/globals/query-state";
import { errorMessage } from "@/services/api/api-error";
import { formatDate, formatTime, isoDate, label as toLabel } from "@/lib/format";

const medStatusClass: Record<string, string> = {
  DUE: "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400",
  OVERDUE: "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400",
  SCHEDULED: "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400",
  GIVEN: "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400",
  HELD: "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400",
};

function MedBadge({ status }: { status: string }) {
  const cls = medStatusClass[status] ?? medStatusClass.SCHEDULED;
  return <span className={cn("text-[11px] font-bold px-2.5 py-0.5 rounded-full", cls)}>{toLabel(status)}</span>;
}

const inputClass =
  "w-full px-3 py-2 border-[1.5px] border-border rounded-lg text-[13px] bg-card text-foreground outline-none focus:border-blue-600 transition-colors box-border";

export default function NurseDashboard() {
  const dashboard = useNurseDashboard();
  const recordVitals = useRecordVitals();
  const administer = useAdministerMedication();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [vitalsForm, setVitalsForm] = useState({
    bp: "",
    pulse: "",
    temp: "",
    weight: "",
    o2: "",
    notes: "",
  });

  if (dashboard.isLoading) {
    return (
      <div className="p-6">
        <QueryLoading text="Loading your station…" />
      </div>
    );
  }

  if (dashboard.isError || !dashboard.data) {
    return (
      <div className="p-6">
        <QueryError error={dashboard.error} onRetry={() => void dashboard.refetch()} />
      </div>
    );
  }

  const { stats, patients, medicationSchedule } = dashboard.data;
  const selectedPatient = patients.find((patient) => patient.id === selectedId) ?? patients[0] ?? null;

  const cards = [
    { label: "Assigned Patients", value: String(stats.assignedPatients), icon: Users, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-950" },
    { label: "Meds Due Today", value: String(stats.medicationsDueToday), icon: Pill, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-950" },
    { label: "Meds Given", value: String(stats.medicationsGivenToday), icon: CheckCircle, color: "text-green-600 dark:text-green-400", bg: "bg-green-100 dark:bg-green-950" },
    { label: "Vitals Recorded", value: String(stats.vitalsRecordedToday), icon: Activity, color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-100 dark:bg-cyan-950" },
  ];

  const saveVitals = async () => {
    if (!selectedPatient) return;
    const [systolicValue, diastolicValue] = vitalsForm.bp.split("/").map((part) => Number(part.trim()));
    const weightLbs = Number(vitalsForm.weight);
    if (!vitalsForm.bp && !vitalsForm.pulse && !vitalsForm.o2) {
      toast.error("Enter at least a blood pressure, pulse or O₂ reading.");
      return;
    }
    try {
      await recordVitals.mutateAsync({
        patientId: selectedPatient.id,
        systolic: Number.isFinite(systolicValue) && systolicValue > 0 ? systolicValue : undefined,
        diastolic: Number.isFinite(diastolicValue) && diastolicValue > 0 ? diastolicValue : undefined,
        heartRate: vitalsForm.pulse ? Number(vitalsForm.pulse) || undefined : undefined,
        spo2: vitalsForm.o2 ? Number(vitalsForm.o2) || undefined : undefined,
        // The form captures pounds; the API stores kilograms.
        weightKg: weightLbs ? Math.round(weightLbs * 0.4536 * 10) / 10 : undefined,
        notes: vitalsForm.notes || undefined,
      });
      toast.success("Vitals recorded");
      setVitalsForm({ bp: "", pulse: "", temp: "", weight: "", o2: "", notes: "" });
    } catch (error) {
      toast.error(errorMessage(error, "Could not record the vitals."));
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-foreground mb-1">Nurse Station 🏥</h1>
        <p className="text-sm text-muted-foreground">
          {formatDate(isoDate())} · {stats.criticalPatients} critical · {stats.medicationsOverdue} overdue medication
          {stats.medicationsOverdue === 1 ? "" : "s"}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-card border border-border rounded-2xl p-5 flex gap-3.5 items-center card-shadow">
              <div className={cn("w-[46px] h-[46px] rounded-[14px] flex items-center justify-center", card.bg)}>
                <Icon size={20} className={card.color} />
              </div>
              <div>
                <div className="text-[22px] font-extrabold text-foreground">{card.value}</div>
                <div className="text-xs text-muted-foreground">{card.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {/* Patient List */}
        <div className="bg-card border border-border rounded-2xl p-5 lg:col-span-2 card-shadow">
          <h3 className="text-base font-bold text-foreground mb-4">Assigned Patients</h3>
          <div className="flex flex-col gap-2.5">
            {patients.map((patient) => {
              const isCritical = patient.acuity === "CRITICAL" || patient.acuity === "HIGH";
              return (
                <div
                  key={patient.id}
                  onClick={() => setSelectedId(patient.id)}
                  className={`flex items-center gap-3.5 p-3.5 rounded-xl cursor-pointer transition-all ${
                    selectedPatient?.id === patient.id
                      ? "bg-blue-50 border-2 border-blue-600"
                      : "bg-muted border-2 border-transparent hover:bg-blue-50/50"
                  }`}
                >
                  <div
                    className={cn(
                      "relative w-[42px] h-[42px] rounded-full flex items-center justify-center text-[13px] font-bold shrink-0",
                      isCritical
                        ? "bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400"
                        : "bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400",
                    )}
                  >
                    {patient.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
                    {isCritical && <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-600 border-2 border-white" />}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-foreground">
                      {patient.name}{" "}
                      <span className="text-muted-foreground font-normal">
                        · {patient.age} yrs · {patient.bed ? `Bed ${patient.bed}` : "Unassigned bed"}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {patient.mrn} · Acuity {toLabel(patient.acuity)}
                      {patient.allergies.length > 0 ? ` · Allergies: ${patient.allergies.join(", ")}` : ""}
                    </div>
                  </div>
                  {isCritical && <AlertTriangle size={16} className="text-red-600" />}
                </div>
              );
            })}
            {patients.length === 0 && <InlineEmpty text="No patients assigned to you right now." />}
          </div>
        </div>

        {/* Record Vitals */}
        <div className="bg-card border border-border rounded-2xl p-5 card-shadow">
          <h3 className="text-base font-bold text-foreground mb-4">Record Vitals</h3>
          {selectedPatient ? (
            <>
              <div className="p-3.5 bg-blue-100 dark:bg-blue-950 rounded-xl mb-4">
                <div className="text-[13px] font-bold text-blue-800 dark:text-blue-300">{selectedPatient.name}</div>
                <div className="text-xs text-blue-600 dark:text-blue-400">
                  {selectedPatient.bed ? `Bed ${selectedPatient.bed}` : "No bed"} · {selectedPatient.mrn}
                </div>
              </div>
              <div className="flex flex-col gap-2.5">
                {(
                  [
                    ["bp", "Blood Pressure", "120/80 mmHg"],
                    ["pulse", "Pulse Rate", "bpm"],
                    ["temp", "Temperature", "°C"],
                    ["weight", "Weight", "lbs"],
                    ["o2", "O2 Saturation", "%"],
                  ] as const
                ).map(([key, label, placeholder]) => (
                  <div key={key}>
                    <label className="block text-xs font-semibold text-foreground mb-1">{label}</label>
                    <input
                      className={inputClass}
                      type="text"
                      placeholder={placeholder}
                      value={vitalsForm[key]}
                      onChange={(e) => setVitalsForm((prev) => ({ ...prev, [key]: e.target.value }))}
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Progress Note</label>
                  <textarea
                    className={`${inputClass} min-h-[70px] resize-y`}
                    placeholder="Clinical observations..."
                    value={vitalsForm.notes}
                    onChange={(e) => setVitalsForm((prev) => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
                <button
                  onClick={() => void saveVitals()}
                  disabled={recordVitals.isPending}
                  className="w-full py-2.5 bg-cyan-600 text-white border-none rounded-[10px] text-sm font-bold cursor-pointer hover:bg-cyan-700 transition-colors disabled:opacity-60"
                >
                  {recordVitals.isPending ? "Saving…" : "✓ Save Vitals"}
                </button>
              </div>
            </>
          ) : (
            <InlineEmpty text="Select a patient to record vitals." />
          )}
        </div>
      </div>

      {/* Medication Schedule */}
      <div className="bg-card border border-border rounded-2xl p-5 card-shadow">
        <h3 className="text-base font-bold text-foreground mb-4">Medication Administration Schedule</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b-2 border-border">
                {["Time", "Patient", "Medication", "Status", "Action"].map((h) => (
                  <th key={h} className="text-left py-2 px-3 text-xs font-bold text-muted-foreground whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {medicationSchedule.map((medication) => {
                const given = medication.status === "GIVEN";
                return (
                  <tr key={medication.id} className={cn("border-b border-border", given && "bg-green-50 dark:bg-green-950/20")}>
                    <td
                      className={cn(
                        "py-3 px-3 font-mono font-bold",
                        medication.status === "DUE" || medication.status === "OVERDUE" ? "text-red-600 dark:text-red-400" : "text-foreground",
                      )}
                    >
                      {medication.time || formatTime(medication.scheduledFor)}
                    </td>
                    <td className="py-3 px-3 font-semibold text-foreground">
                      {medication.patientName}
                      <span className="block text-[11px] text-muted-foreground font-normal">{medication.drug} {medication.dose}</span>
                    </td>
                    <td className="py-3 px-3 text-foreground">
                      {medication.drug} · {medication.dose}
                      <span className="block text-[11px] text-muted-foreground">{medication.route}</span>
                    </td>
                    <td className="py-3 px-3">
                      <MedBadge status={medication.status} />
                      {medication.holdReason && (
                        <span className="block text-[11px] text-muted-foreground mt-1">{medication.holdReason}</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {!given ? (
                        <button
                          onClick={() =>
                            administer.mutate(
                              { medicationId: medication.id, input: { status: "GIVEN" } },
                              {
                                onSuccess: () => toast.success("Marked as given"),
                                onError: (error) => toast.error(errorMessage(error, "Could not record the administration.")),
                              },
                            )
                          }
                          disabled={administer.isPending}
                          className="px-3 py-1.5 bg-blue-600 text-white border-none rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-60"
                        >
                          Mark Given
                        </button>
                      ) : (
                        <span className="text-xs text-green-600 font-bold">✓ Done</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {medicationSchedule.length === 0 && <InlineEmpty text="No medications scheduled for today." />}
        </div>
      </div>
    </div>
  );
}
