import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Search, User, Calendar, Clock, Shield, DollarSign, CheckCircle, Plus } from "lucide-react";

import { useAddToQueue } from "@/hooks/reception/reception.hooks";
import { usePatients, usePatientEligibility } from "@/hooks/patients/patients.hooks";
import { useRecordPayment } from "@/hooks/billing/billing.hooks";
import { useAppointments } from "@/hooks/appointments/appointments.hooks";
import { QueryError } from "@/components/globals/query-state";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { errorMessage } from "@/services/api/api-error";
import { formatDate, formatTime, isoDate, money } from "@/lib/format";
import type { PatientListRow } from "@/services/patients/patient.api";

const AVATAR_COLORS = ["#2563eb", "#7c3aed", "#16a34a", "#d97706", "#dc2626"];

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").map((part) => part[0]).join("").slice(0, 2);
  const color = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
  return (
    <div className="w-16 h-16 rounded-full flex items-center justify-center text-[22px] font-extrabold text-white shrink-0 font-['Plus_Jakarta_Sans',sans-serif]" style={{ backgroundColor: color }}>
      {initials}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 py-2 border-b border-border">
      <Icon size={14} color="var(--muted-foreground)" />
      <span className="text-xs text-muted-foreground w-20 shrink-0">{label}</span>
      <span className="text-[13px] font-semibold text-foreground">{value}</span>
    </div>
  );
}

export default function CheckInPage() {
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState("");
  const [selected, setSelected] = useState<PatientListRow | null>(null);
  const [copay, setCopay] = useState("");
  const [notes, setNotes] = useState("");
  const [checkedIn, setCheckedIn] = useState<{ mrn: string; ticket: string } | null>(null);

  const patients = usePatients({ pageSize: 8, search: useDebouncedValue(searchValue) || undefined });
  const eligibility = usePatientEligibility(selected?.id ?? null);
  const appointments = useAppointments({ pageSize: 5, patientId: selected?.id ?? undefined, sort: "startsAt", order: "asc" });
  const addToQueue = useAddToQueue();
  const recordPayment = useRecordPayment();

  const upcoming = (appointments.data?.rows ?? []).find(
    (appointment) => new Date(appointment.at).getTime() >= Date.now() - 3_600_000,
  );

  const reset = () => {
    setCheckedIn(null);
    setSelected(null);
    setSearchValue("");
    setCopay("");
    setNotes("");
  };

  const completeCheckIn = async () => {
    if (!selected) return;
    try {
      const entry = await addToQueue.mutateAsync({
        patientId: selected.id,
        type: upcoming ? "APPOINTMENT" : "WALK_IN",
        appointmentId: upcoming?.id,
        notes: notes || undefined,
      });

      const copayValue = Number(copay);
      if (copayValue > 0) {
        await recordPayment.mutateAsync({
          patientId: selected.id,
          amountMinor: Math.round(copayValue * 100),
          method: "CASH",
          notes: `Copay collected at check-in (${isoDate()})`,
        });
      }

      setCheckedIn({ mrn: selected.mrn, ticket: entry.ticketNumber });
      toast.success(`Checked in · ticket ${entry.ticketNumber}`);
    } catch (error) {
      toast.error(errorMessage(error, "Could not complete the check-in."));
    }
  };

  if (checkedIn) {
    return (
      <div className="p-6 max-w-[560px] mx-auto">
        <div className="bg-card border border-border rounded-2xl p-6 text-center py-12">
          <div className="w-[72px] h-[72px] rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
            <CheckCircle size={36} color="#16a34a" />
          </div>
          <h2 className="text-2xl font-extrabold text-foreground mb-2 font-['Plus_Jakarta_Sans',sans-serif]">Check-In Complete</h2>
          <p className="text-muted-foreground text-sm mb-5">Patient has been added to the queue.</p>
          <div className="bg-muted rounded-xl py-4 px-6 mb-7 inline-block">
            <div className="text-xs text-muted-foreground mb-1">MRN</div>
            <div className="text-[22px] font-extrabold text-blue-600 font-mono">{checkedIn.mrn}</div>
            <div className="text-xs text-muted-foreground mt-2">Queue ticket</div>
            <div className="text-[18px] font-extrabold text-foreground font-mono">{checkedIn.ticket}</div>
          </div>
          <div className="flex gap-2.5 justify-center">
            <button onClick={reset} className="py-2.5 px-[22px] bg-blue-600 text-white border-none rounded-[10px] text-sm font-semibold cursor-pointer">
              Check In Another Patient
            </button>
            <a href="/reception/queue" className="py-2.5 px-[22px] bg-muted text-foreground border border-border rounded-[10px] text-sm font-semibold cursor-pointer">
              Open Queue
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[900px] mx-auto">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground mb-1 font-['Plus_Jakarta_Sans',sans-serif]">Patient Check-In</h1>
          <p className="text-muted-foreground text-sm">Search by name or MRN to check in a patient</p>
        </div>
        <button onClick={() => navigate("/reception/register")} className="flex items-center gap-2 py-2.5 px-[18px] bg-card text-foreground border border-border rounded-[10px] text-sm font-semibold cursor-pointer">
          <Plus size={16} /> Walk-In Registration
        </button>
      </div>

      <div className="relative mb-5">
        <Search size={18} color="var(--muted-foreground)" className="absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          className="w-full py-2.5 pl-[42px] pr-3 border-[1.5px] border-border rounded-xl text-[15px] bg-card text-foreground outline-none box-border focus:border-blue-600"
          placeholder="Search patient by name or MRN..."
          value={searchValue}
          onChange={(e) => {
            setSearchValue(e.target.value);
            setSelected(null);
          }}
        />
        {patients.isError && <QueryError error={patients.error} onRetry={() => void patients.refetch()} className="mt-2" />}
        {!selected && searchValue.length > 1 && (patients.data?.rows.length ?? 0) > 0 && (
          <div className="absolute top-full left-0 right-0 bg-card border border-border rounded-xl mt-1 z-50 overflow-hidden shadow-lg">
            {(patients.data?.rows ?? []).map((patient) => (
              <button
                key={patient.id}
                onClick={() => {
                  setSelected(patient);
                  setSearchValue(patient.name);
                }}
                className="flex items-center gap-3 w-full py-3 px-4 bg-transparent border-none border-b border-border cursor-pointer text-left"
              >
                <Avatar name={patient.name} />
                <div>
                  <div className="text-sm font-bold text-foreground">{patient.name}</div>
                  <div className="text-xs text-muted-foreground">{patient.mrn} · DOB: {formatDate(patient.dateOfBirth)}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="grid grid-cols-2 gap-5">
          {/* Patient Card */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex gap-4 items-center mb-5">
              <Avatar name={selected.name} />
              <div>
                <div className="text-lg font-extrabold text-foreground font-['Plus_Jakarta_Sans',sans-serif]">{selected.name}</div>
                <div className="text-[13px] text-muted-foreground font-mono">{selected.mrn}</div>
              </div>
            </div>
            <InfoRow icon={Calendar} label="Date of Birth" value={formatDate(selected.dateOfBirth)} />
            <InfoRow icon={User} label="Sex" value={selected.sexAtBirth.replace("_", " ")} />
            <InfoRow icon={User} label="Phone" value={selected.phone ?? "Not on file"} />
            <InfoRow
              icon={Shield}
              label="Insurance"
              value={
                eligibility.isLoading
                  ? "Checking…"
                  : eligibility.data
                    ? `${eligibility.data.eligible ? "Active" : "Inactive"} · ${eligibility.data.insurer ?? "—"}`
                    : "Not verified"
              }
            />

            {upcoming && (
              <div className="mt-4 bg-blue-50 rounded-xl p-3.5 px-4 border-[1.5px] border-blue-200">
                <div className="text-xs font-bold text-blue-800 mb-2.5">Upcoming Appointment</div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex gap-2 items-center">
                    <Clock size={13} color="#3b82f6" />
                    <span className="text-[13px] font-bold text-blue-800 font-mono">
                      {formatDate(upcoming.at)} · {formatTime(upcoming.at)}
                    </span>
                  </div>
                  <div className="text-[13px] text-blue-600 font-semibold">{upcoming.type}</div>
                  <div className="text-xs text-blue-500">{upcoming.reason ?? "No reason recorded"}</div>
                </div>
              </div>
            )}
          </div>

          {/* Check-In Form */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="text-base font-bold text-foreground mb-5 font-['Plus_Jakarta_Sans',sans-serif]">Complete Check-In</div>

            <div className="mb-4 py-3.5 px-4 rounded-xl bg-muted border-[1.5px] border-border">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-[13px] font-bold text-foreground mb-0.5">
                    <Shield size={13} className="inline mr-1.5" />
                    Coverage status
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {eligibility.data
                      ? `${eligibility.data.eligible ? "Eligible" : "Not eligible"} · ${eligibility.data.plan ?? "no plan"}`
                      : eligibility.isLoading
                        ? "Checking eligibility…"
                        : "Not verified"}
                  </div>
                </div>
                {eligibility.data && (
                  <span
                    className="py-1.5 px-3.5 rounded-lg text-xs font-semibold"
                    style={{
                      background: eligibility.data.eligible ? "#16a34a" : "#fee2e2",
                      color: eligibility.data.eligible ? "white" : "#dc2626",
                    }}
                  >
                    {eligibility.data.eligible ? "Confirmed" : "Inactive"}
                  </span>
                )}
              </div>
              {eligibility.data?.copayMinor != null && (
                <div className="text-xs text-muted-foreground mt-2">Plan copay {money(eligibility.data.copayMinor)}</div>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-foreground mb-[5px]">
                <DollarSign size={12} className="inline mr-1" />Copay Amount Collected
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <input
                  className="w-full py-2.5 pl-7 pr-3 border-[1.5px] border-border rounded-lg text-[13px] bg-card text-foreground outline-none box-border"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="25.00"
                  value={copay}
                  onChange={(e) => setCopay(e.target.value)}
                />
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-xs font-semibold text-foreground mb-[5px]">Notes for Today</label>
              <textarea
                className="w-full py-2.5 px-3 border-[1.5px] border-border rounded-lg text-[13px] bg-card text-foreground outline-none box-border min-h-[72px] resize-vertical"
                placeholder="Any updates or notes for this visit..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="flex gap-2.5">
              <button onClick={reset} className="py-3 px-5 bg-muted text-foreground border border-border rounded-[10px] text-sm font-semibold cursor-pointer">
                Cancel
              </button>
              <button
                onClick={() => void completeCheckIn()}
                disabled={addToQueue.isPending || recordPayment.isPending}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 text-white border-none rounded-[10px] text-[15px] font-bold cursor-pointer disabled:opacity-60"
              >
                <CheckCircle size={18} />
                {addToQueue.isPending ? "Checking in…" : "Complete Check-In & Add to Queue"}
              </button>
            </div>
          </div>
        </div>
      )}

      {!selected && searchValue.length <= 1 && (
        <div className="bg-card border border-border rounded-2xl p-14 text-center text-muted-foreground">
          <Search size={40} className="mb-4 opacity-30" />
          <div className="text-[15px] font-semibold mb-1.5">Search for a patient</div>
          <div className="text-[13px]">Enter a name or MRN to find and check in a patient</div>
        </div>
      )}

      {!selected && searchValue.length > 1 && patients.data?.rows.length === 0 && (
        <div className="bg-card border border-border rounded-2xl p-14 text-center text-muted-foreground">
          <div className="text-[15px] font-semibold mb-1.5">No patient matches “{searchValue}”</div>
          <div className="text-[13px]">Register them as a walk-in first, then check them in.</div>
        </div>
      )}
    </div>
  );
}
