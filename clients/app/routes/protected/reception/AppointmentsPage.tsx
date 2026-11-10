import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus, X, Check, XCircle, Calendar } from "lucide-react";

import {
  useAppointments,
  useApproveAppointment,
  useCancelAppointment,
  useCreateAppointment,
} from "@/hooks/appointments/appointments.hooks";
import { usePatients } from "@/hooks/patients/patients.hooks";
import { useDoctors } from "@/hooks/administration/administration.hooks";
import { QueryError, QueryLoading, InlineEmpty } from "@/components/globals/query-state";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { errorMessage } from "@/services/api/api-error";
import { formatTime, isoDate, label as toLabel } from "@/lib/format";

const statusColors: Record<string, { bg: string; color: string }> = {
  CONFIRMED: { bg: "#dbeafe", color: "#2563eb" },
  SCHEDULED: { bg: "#dbeafe", color: "#2563eb" },
  REQUESTED: { bg: "#fef9c3", color: "#ca8a04" },
  CHECKED_IN: { bg: "#dcfce7", color: "#16a34a" },
  COMPLETED: { bg: "#f1f5f9", color: "#64748b" },
  CANCELLED: { bg: "#fee2e2", color: "#dc2626" },
  NO_SHOW: { bg: "#fee2e2", color: "#dc2626" },
  IN_PROGRESS: { bg: "#dcfce7", color: "#16a34a" },
};

function Badge({ status }: { status: string }) {
  const style = statusColors[status] ?? statusColors.REQUESTED;
  return (
    <span
      className="text-[11px] font-bold py-[3px] px-2.5 rounded-full whitespace-nowrap"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {toLabel(status)}
    </span>
  );
}

const inputClass =
  "w-full py-2.5 px-3 border-[1.5px] border-border rounded-lg text-[13px] bg-card text-foreground outline-none box-border focus:border-blue-600";

function weekDates(base: Date) {
  const start = new Date(base);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export default function AppointmentsPage() {
  const [baseDate, setBaseDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [showModal, setShowModal] = useState(false);

  const [patientSearch, setPatientSearch] = useState("");
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [time, setTime] = useState("09:00");
  const [type, setType] = useState("Consultation");
  const [reason, setReason] = useState("");
  const [requestApproval, setRequestApproval] = useState(false);

  const appointments = useAppointments({ date: isoDate(selectedDate), pageSize: 100, sort: "startsAt", order: "asc" });
  const patients = usePatients({ pageSize: 10, search: useDebouncedValue(patientSearch) || undefined });
  const doctors = useDoctors({ pageSize: 50, status: "ACTIVE" });
  const createAppointment = useCreateAppointment();
  const approveAppointment = useApproveAppointment();
  const cancelAppointment = useCancelAppointment();

  const rows = appointments.data?.rows ?? [];
  const week = useMemo(() => weekDates(baseDate), [baseDate]);

  const book = async () => {
    if (!patientId || !doctorId || !time) {
      toast.error("Patient, doctor and time are required.");
      return;
    }
    try {
      await createAppointment.mutateAsync({
        patientId,
        doctorId,
        startsAt: new Date(`${isoDate(selectedDate)}T${time}:00`).toISOString(),
        type: type || undefined,
        reason: reason || undefined,
        requestApproval,
      });
      toast.success(requestApproval ? "Appointment requested" : "Appointment booked");
      setShowModal(false);
      setPatientId("");
      setPatientSearch("");
      setReason("");
    } catch (error) {
      toast.error(errorMessage(error, "Could not book the appointment."));
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground mb-1 font-['Plus_Jakarta_Sans',sans-serif]">Appointments</h1>
          <p className="text-muted-foreground text-sm">{rows.length} appointments on {isoDate(selectedDate)}</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 py-2.5 px-[18px] bg-blue-600 text-white border-none rounded-[10px] text-sm font-semibold cursor-pointer"
        >
          <Plus size={16} /> Book Appointment
        </button>
      </div>

      {/* Week Calendar */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-5">
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={() => setBaseDate((date) => new Date(date.getFullYear(), date.getMonth(), date.getDate() - 7))}
            className="w-8 h-8 rounded-lg border border-border bg-card cursor-pointer flex items-center justify-center"
          >
            <ChevronLeft size={16} color="var(--foreground)" />
          </button>
          <div className="text-[15px] font-bold text-foreground font-['Plus_Jakarta_Sans',sans-serif]">
            {week[0].toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </div>
          <button
            onClick={() => setBaseDate((date) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7))}
            className="w-8 h-8 rounded-lg border border-border bg-card cursor-pointer flex items-center justify-center"
          >
            <ChevronRight size={16} color="var(--foreground)" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {week.map((date) => {
            const isSelected = sameDay(date, selectedDate);
            const isToday = sameDay(date, new Date());
            return (
              <button
                key={date.toISOString()}
                onClick={() => setSelectedDate(date)}
                className="flex flex-col items-center py-2.5 px-1 rounded-xl gap-1 transition-all"
                style={{
                  border: isSelected ? "2px solid #2563eb" : "2px solid transparent",
                  background: isSelected ? "#eff6ff" : isToday ? "var(--muted)" : "transparent",
                }}
              >
                <span className="text-[11px] font-semibold" style={{ color: isSelected ? "#2563eb" : "var(--muted-foreground)" }}>
                  {date.toLocaleDateString(undefined, { weekday: "short" })}
                </span>
                <span className="text-lg font-extrabold font-mono" style={{ color: isSelected ? "#2563eb" : "var(--foreground)" }}>
                  {date.getDate()}
                </span>
                {isToday && <div className="w-[5px] h-[5px] rounded-full" style={{ background: isSelected ? "#2563eb" : "#16a34a" }} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Appointment List */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="text-[15px] font-bold text-foreground mb-4 font-['Plus_Jakarta_Sans',sans-serif]">
          {selectedDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </div>

        {appointments.isLoading && <QueryLoading text="Loading appointments…" />}
        {appointments.isError && <QueryError error={appointments.error} onRetry={() => void appointments.refetch()} />}

        {!appointments.isLoading && !appointments.isError && (
          <div className="flex flex-col gap-2.5">
            {rows.map((appointment) => (
              <div
                key={appointment.id}
                className="flex items-center gap-3.5 p-3.5 bg-muted rounded-xl"
                style={{ border: appointment.status === "CANCELLED" ? "1px solid #fecaca" : "1px solid transparent" }}
              >
                <div className="text-center min-w-[60px]">
                  <div className="text-[13px] font-extrabold text-blue-600 font-mono">{formatTime(appointment.at)}</div>
                </div>
                <div className="w-px h-10 bg-border" />
                <div className="flex-1">
                  <div className="text-sm font-bold text-foreground mb-0.5">{appointment.patientName}</div>
                  <div className="text-xs text-muted-foreground">
                    {appointment.mrn} · {appointment.type} · {toLabel(appointment.mode)}
                    {appointment.reason ? ` · ${appointment.reason}` : ""}
                  </div>
                </div>
                <Badge status={appointment.status} />
                <div className="flex gap-1.5">
                  {appointment.status === "REQUESTED" && (
                    <button
                      onClick={() =>
                        approveAppointment.mutate(appointment.id, {
                          onSuccess: () => toast.success("Appointment approved"),
                          onError: (error) => toast.error(errorMessage(error, "Could not approve the appointment.")),
                        })
                      }
                      title="Confirm"
                      className="w-[30px] h-[30px] rounded-[7px] border border-green-200 bg-green-100 cursor-pointer flex items-center justify-center"
                    >
                      <Check size={13} color="#16a34a" />
                    </button>
                  )}
                  {appointment.status !== "CANCELLED" && appointment.status !== "COMPLETED" && (
                    <button
                      onClick={() =>
                        cancelAppointment.mutate(
                          { appointmentId: appointment.id, reason: "Cancelled at reception" },
                          {
                            onSuccess: () => toast.success("Appointment cancelled"),
                            onError: (error) => toast.error(errorMessage(error, "Could not cancel the appointment.")),
                          },
                        )
                      }
                      title="Cancel"
                      className="w-[30px] h-[30px] rounded-[7px] border border-red-200 bg-red-100 cursor-pointer flex items-center justify-center"
                    >
                      <XCircle size={13} color="#dc2626" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {rows.length === 0 && <InlineEmpty text="No appointments booked for this day." />}
          </div>
        )}
      </div>

      {/* Book Appointment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000]">
          <div className="bg-card rounded-[20px] p-7 w-[520px] max-h-[90vh] overflow-y-auto border border-border">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-extrabold text-foreground font-['Plus_Jakarta_Sans',sans-serif]">Book Appointment</h2>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-lg border border-border bg-card cursor-pointer flex items-center justify-center">
                <X size={16} color="var(--foreground)" />
              </button>
            </div>
            <div className="flex flex-col gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-[5px]">Patient</label>
                <input
                  className={`${inputClass} mb-2`}
                  placeholder="Search patient name..."
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
              <div>
                <label className="block text-xs font-semibold text-foreground mb-[5px]">Doctor</label>
                <select className={inputClass} value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
                  <option value="">Select doctor...</option>
                  {(doctors.data?.rows ?? []).map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.name}{doctor.specialty ? ` · ${doctor.specialty}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-[5px]">
                    <Calendar size={12} className="inline mr-1" />Date
                  </label>
                  <input
                    className={inputClass}
                    type="date"
                    value={isoDate(selectedDate)}
                    onChange={(e) => setSelectedDate(new Date(`${e.target.value}T12:00:00`))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-[5px]">Time</label>
                  <input className={inputClass} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-[5px]">Appointment Type</label>
                <select className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
                  {["Consultation", "Follow-up", "Procedure", "Lab Review", "Vaccination"].map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-[5px]">Reason</label>
                <textarea className={`${inputClass} min-h-[72px] resize-vertical`} placeholder="Reason for visit..." value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-xs text-foreground">
                <input type="checkbox" checked={requestApproval} onChange={(e) => setRequestApproval(e.target.checked)} />
                Hold as a request for doctor approval
              </label>
              <div className="flex gap-2.5 mt-1">
                <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 bg-muted text-foreground border border-border rounded-[10px] text-sm font-semibold cursor-pointer">
                  Cancel
                </button>
                <button
                  onClick={() => void book()}
                  disabled={createAppointment.isPending}
                  className="flex-[2] py-2.5 bg-blue-600 text-white border-none rounded-[10px] text-sm font-semibold cursor-pointer disabled:opacity-60"
                >
                  {createAppointment.isPending ? "Booking…" : "Confirm Booking"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
