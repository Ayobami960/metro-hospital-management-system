import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Calendar, Clock, Video, MapPin, Plus, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

import {
  useAppointmentAvailability,
  useAppointments,
  useCancelAppointment,
  useCreateAppointment,
} from "@/hooks/appointments/appointments.hooks";
import { QueryError, QueryLoading, InlineEmpty } from "@/components/globals/query-state";
import { useSession } from "@/hooks/auth/use-session";
import { usePrescriptions } from "@/hooks/clinical/clinical.hooks";
import { ServerPager } from "@/components/globals/server-pager";
import { errorMessage } from "@/services/api/api-error";
import { formatDate, formatTime, isoDate, label as toLabel } from "@/lib/format";

const statusClass: Record<string, string> = {
  CONFIRMED: "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400",
  SCHEDULED: "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400",
  REQUESTED: "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400",
  COMPLETED: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
  CANCELLED: "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400",
  NO_SHOW: "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400",
};

const inputClass =
  "w-full py-2.5 px-3.5 border-[1.5px] border-border rounded-[10px] text-sm bg-card text-foreground outline-none box-border";

type BookingForm = {
  doctorId: string;
  date: string;
  slot: string;
  mode: "IN_PERSON" | "VIRTUAL";
  reason: string;
  symptoms: string;
};

function BookModal({
  doctors,
  onClose,
}: {
  doctors: Array<{ id: string; name: string }>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<BookingForm>({
    doctorId: doctors[0]?.id ?? "",
    date: isoDate(),
    slot: "",
    mode: "IN_PERSON",
    reason: "",
    symptoms: "",
  });
  const availability = useAppointmentAvailability(form.doctorId || null, form.date);
  const createAppointment = useCreateAppointment();
  const { data: session } = useSession();

  const submit = async () => {
    if (!form.doctorId || !form.slot) {
      toast.error("Pick a doctor and an available time slot.");
      return;
    }
    if (!session?.patientId) {
      toast.error("Your patient record is not linked to this account yet.");
      return;
    }
    try {
      await createAppointment.mutateAsync({
        patientId: session.patientId,
        doctorId: form.doctorId,
        startsAt: form.slot,
        mode: form.mode,
        reason: form.reason || undefined,
        symptoms: form.symptoms || undefined,
        requestApproval: true,
      });
      toast.success("Appointment requested — your doctor will confirm shortly.");
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, "Could not request the appointment."));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-6">
      <div className="bg-card rounded-[20px] p-8 w-full max-w-[540px] max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-extrabold text-foreground font-['Plus_Jakarta_Sans',sans-serif]">Book New Appointment</h2>
          <button onClick={onClose} className="bg-transparent border-none cursor-pointer text-muted-foreground">
            <X size={22} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-[13px] font-semibold text-foreground mb-1.5">Select Doctor</label>
            <select
              className={inputClass}
              value={form.doctorId}
              onChange={(e) => setForm((prev) => ({ ...prev, doctorId: e.target.value, slot: "" }))}
            >
              <option value="">Choose a doctor...</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>{doctor.name}</option>
              ))}
            </select>
            {doctors.length === 0 && (
              <p className="text-[11px] text-muted-foreground mt-1">
                You have no previous appointments, so there is no care-team doctor to request yet.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-semibold text-foreground mb-1.5">Preferred Date</label>
              <input
                className={inputClass}
                type="date"
                value={form.date}
                onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value, slot: "" }))}
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-foreground mb-1.5">Time Slot</label>
              <select
                className={inputClass}
                value={form.slot}
                onChange={(e) => setForm((prev) => ({ ...prev, slot: e.target.value }))}
              >
                <option value="">
                  {availability.isLoading ? "Loading slots…" : "Select time..."}
                </option>
                {(availability.data ?? [])
                  .filter((slot) => slot.available)
                  .map((slot) => (
                    <option key={slot.startsAt} value={slot.startsAt}>
                      {formatTime(slot.startsAt)}
                    </option>
                  ))}
              </select>
              {availability.data && availability.data.filter((slot) => slot.available).length === 0 && (
                <p className="text-[11px] text-muted-foreground mt-1">No free slots on this date.</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-foreground mb-2">Consultation Type</label>
            <div className="flex gap-2.5">
              {(
                [
                  { value: "IN_PERSON", label: "🏥 In-Person" },
                  { value: "VIRTUAL", label: "🎥 Virtual" },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  onClick={() => setForm((prev) => ({ ...prev, mode: option.value }))}
                  className="flex-1 py-2.5 rounded-[10px] font-semibold text-[13px] cursor-pointer"
                  style={{
                    border: `1.5px solid ${form.mode === option.value ? "#2563eb" : "var(--border)"}`,
                    background: form.mode === option.value ? "var(--accent)" : "var(--card)",
                    color: form.mode === option.value ? "#2563eb" : "var(--foreground)",
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-foreground mb-1.5">Reason for Visit</label>
            <input
              className={inputClass}
              type="text"
              placeholder="Brief description"
              value={form.reason}
              onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-foreground mb-1.5">Symptoms (optional)</label>
            <textarea
              className={`${inputClass} min-h-[70px] resize-vertical`}
              placeholder="Describe symptoms..."
              value={form.symptoms}
              onChange={(e) => setForm((prev) => ({ ...prev, symptoms: e.target.value }))}
            />
          </div>

          <button
            onClick={() => void submit()}
            disabled={createAppointment.isPending}
            className="w-full py-3 bg-blue-600 text-white border-none rounded-[10px] text-[15px] font-bold cursor-pointer disabled:opacity-60"
          >
            {createAppointment.isPending ? "Submitting…" : "Submit Appointment Request"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MonthCalendar({ appointments }: { appointments: Array<{ id: string; at: string; label: string }> }) {
  const [cursor, setCursor] = useState(() => new Date());
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const byDay = useMemo(() => {
    const map = new Map<number, typeof appointments>();
    appointments.forEach((appointment) => {
      const date = new Date(appointment.at);
      if (date.getFullYear() === year && date.getMonth() === month) {
        const list = map.get(date.getDate()) ?? [];
        list.push(appointment);
        map.set(date.getDate(), list);
      }
    });
    return map;
  }, [appointments, year, month]);

  const cells: Array<number | null> = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const today = new Date();

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex justify-between items-center mb-5">
        <h3 className="text-base font-bold text-foreground font-['Plus_Jakarta_Sans',sans-serif]">
          {cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </h3>
        <div className="flex gap-2">
          <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="p-2 border border-border rounded-lg bg-transparent cursor-pointer text-foreground flex">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setCursor(new Date())} className="py-2 px-3.5 border border-border rounded-lg bg-transparent cursor-pointer text-foreground text-[13px] font-semibold">
            Today
          </button>
          <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="p-2 border border-border rounded-lg bg-transparent cursor-pointer text-foreground flex">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-0">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="py-2.5 text-center text-xs font-bold text-muted-foreground border-b-2 border-border">{day}</div>
        ))}
        {cells.map((date, index) => {
          const isToday =
            date === today.getDate() && month === today.getMonth() && year === today.getFullYear();
          return (
            <div key={index} className={cn("py-2 px-1 min-h-[70px] border border-border relative", isToday && "bg-blue-50 dark:bg-blue-950/30")}>
              {date && (
                <>
                  <div className={cn("text-[13px] text-right pr-1.5 mb-1", isToday ? "font-extrabold text-blue-600 dark:text-blue-400" : "text-foreground")}>{date}</div>
                  {(byDay.get(date) ?? []).slice(0, 2).map((appointment) => (
                    <div key={appointment.id} className="text-[10px] font-bold bg-blue-600 text-white rounded px-[5px] py-0.5 mx-0.5 mb-0.5 overflow-hidden text-ellipsis whitespace-nowrap">
                      {formatTime(appointment.at)} {appointment.label}
                    </div>
                  ))}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AppointmentsPage() {
  const [tab, setTab] = useState<"upcoming" | "past" | "calendar">("upcoming");
  const [showBook, setShowBook] = useState(false);
  const [page, setPage] = useState(1);

  const appointments = useAppointments({ page, pageSize: 20, sort: "startsAt", order: "desc" });
  const cancelAppointment = useCancelAppointment();

  const rows = appointments.data?.rows ?? [];
  const now = Date.now();
  const upcoming = rows.filter((row) => new Date(row.at).getTime() >= now).sort((a, b) => a.at.localeCompare(b.at));
  const past = rows.filter((row) => new Date(row.at).getTime() < now);
  const pending = upcoming.filter((row) => row.status === "REQUESTED").length;

  // The appointment list exposes `doctorId` only; prescription rows carry the
  // matching doctor name, so use them to label the care team.
  const prescriptions = usePrescriptions({ pageSize: 50 });
  const doctorNames = useMemo(() => {
    const map = new Map<string, string>();
    (prescriptions.data?.rows ?? []).forEach((row) => {
      if (row.doctorId && row.doctorName) map.set(row.doctorId, row.doctorName);
    });
    return map;
  }, [prescriptions.data]);

  const doctorLabel = (doctorId: string) => doctorNames.get(doctorId) ?? `Doctor ${doctorId.slice(0, 6)}`;

  const doctors = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((row) => {
      if (row.doctorId && !map.has(row.doctorId)) map.set(row.doctorId, doctorLabel(row.doctorId));
    });
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [rows, doctorNames]);

  return (
    <div className="p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-[26px] font-extrabold text-foreground mb-1 font-['Plus_Jakarta_Sans',sans-serif]">My Appointments</h1>
          <p className="text-muted-foreground text-[15px]">
            {upcoming.length} upcoming · {pending} pending approval
          </p>
        </div>
        <button onClick={() => setShowBook(true)} className="flex items-center gap-2 py-[11px] px-5 bg-blue-600 text-white border-none rounded-[10px] text-sm font-semibold cursor-pointer">
          <Plus size={16} /> Book Appointment
        </button>
      </div>

      {showBook && <BookModal doctors={doctors} onClose={() => setShowBook(false)} />}

      {/* Tab Bar */}
      <div className="flex gap-1 mb-5 bg-card border border-border rounded-xl p-1 w-fit">
        {[
          ["upcoming", `Upcoming (${upcoming.length})`],
          ["past", "Past Appointments"],
          ["calendar", "Calendar View"],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id as typeof tab)}
            className={`py-2 px-[18px] border-none rounded-[9px] cursor-pointer text-[13px] font-semibold ${tab === id ? "bg-blue-600 text-white" : "bg-transparent text-muted-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {appointments.isLoading && <QueryLoading text="Loading your appointments…" />}
      {appointments.isError && <QueryError error={appointments.error} onRetry={() => void appointments.refetch()} />}

      {!appointments.isLoading && !appointments.isError && (
        <>
          {tab === "upcoming" && (
            <div className="flex flex-col gap-4">
              {upcoming.map((appointment) => {
                const virtual = appointment.mode === "VIRTUAL";
                return (
                  <div key={appointment.id} className="bg-card border border-border rounded-2xl p-6 flex gap-5 items-start card-shadow">
                    <div
                      className={cn(
                        "w-[54px] h-[54px] rounded-full flex items-center justify-center text-base font-extrabold shrink-0 border-2",
                        virtual
                          ? "bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800"
                          : "bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
                      )}
                    >
                      {doctorLabel(appointment.doctorId).split(" ").map((part: string) => part[0]).join("").slice(0, 2)}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="text-base font-bold text-foreground">{doctorLabel(appointment.doctorId)}</div>
                          <div className="text-[13px] font-semibold text-muted-foreground">{appointment.type}</div>
                        </div>
                        <span className={cn("text-xs font-bold px-3 py-1 rounded-full", statusClass[appointment.status] ?? "bg-muted text-muted-foreground")}>
                          {toLabel(appointment.status)}
                        </span>
                      </div>
                      <div className="flex gap-5 flex-wrap mb-2.5">
                        <div className="flex items-center gap-1.5 text-[13px] text-foreground">
                          <Calendar size={14} color="var(--muted-foreground)" /> {formatDate(appointment.at)}
                        </div>
                        <div className="flex items-center gap-1.5 text-[13px] text-foreground">
                          <Clock size={14} color="var(--muted-foreground)" /> {formatTime(appointment.at)} – {formatTime(appointment.endsAt)}
                        </div>
                        <div className="flex items-center gap-1.5 text-[13px] text-foreground">
                          {virtual ? <Video size={14} color="var(--muted-foreground)" /> : <MapPin size={14} color="var(--muted-foreground)" />}{" "}
                          {toLabel(appointment.mode)}
                        </div>
                      </div>
                      <div className="text-[13px] text-foreground mb-3.5 py-2 px-3 bg-muted rounded-lg">
                        <strong>Reason:</strong> {appointment.reason ?? "Not specified"}
                      </div>
                      <div className="flex gap-2.5">
                        {virtual && appointment.status === "CONFIRMED" && (
                          <button className="flex items-center gap-1.5 py-2 px-4 bg-violet-600 text-white border-none rounded-lg text-[13px] font-semibold cursor-pointer">
                            <Video size={14} /> Join Video Call
                          </button>
                        )}
                        <a href="/patient/appointments" className="py-2 px-4 bg-muted text-foreground border border-border rounded-lg text-[13px] font-semibold cursor-pointer">
                          Reschedule
                        </a>
                        <button
                          onClick={() =>
                            cancelAppointment.mutate(
                              { appointmentId: appointment.id, reason: "Cancelled by patient" },
                              {
                                onSuccess: () => toast.success("Appointment cancelled"),
                                onError: (error) => toast.error(errorMessage(error, "Could not cancel the appointment.")),
                              },
                            )
                          }
                          disabled={cancelAppointment.isPending}
                          className="py-2 px-4 bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 border-none rounded-lg text-[13px] font-semibold cursor-pointer disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {upcoming.length === 0 && <InlineEmpty text="You have no upcoming appointments." />}
            </div>
          )}

          {tab === "past" && (
            <div className="bg-card border border-border rounded-2xl p-6 card-shadow">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b-2 border-border">
                    {["Doctor", "Date & Time", "Type", "Status", "Reason"].map((h) => (
                      <th key={h} className="py-2.5 px-3.5 text-left text-xs font-bold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {past.map((appointment) => (
                    <tr key={appointment.id} className="border-b border-border">
                      <td className="p-3.5">
                        <div className="font-semibold text-foreground">{doctorLabel(appointment.doctorId)}</div>
                        <div className="text-[11px] text-muted-foreground">{appointment.type}</div>
                      </td>
                      <td className="p-3.5 text-foreground">
                        <div>{formatDate(appointment.at)}</div>
                        <div className="text-xs text-muted-foreground">{formatTime(appointment.at)}</div>
                      </td>
                      <td className="p-3.5">
                        <span className={cn("text-[11px] py-[3px] px-2 rounded-md font-semibold", appointment.mode === "VIRTUAL" ? "bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-400" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400")}>
                          {toLabel(appointment.mode)}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className={cn("text-[11px] font-bold px-2.5 py-[3px] rounded-full", statusClass[appointment.status] ?? "bg-muted text-muted-foreground")}>
                          {toLabel(appointment.status)}
                        </span>
                      </td>
                      <td className="p-3.5 text-muted-foreground text-xs max-w-[200px]">{appointment.reason ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {past.length === 0 && <InlineEmpty text="No past appointments on this page." />}
            </div>
          )}

          {tab === "calendar" && (
            <MonthCalendar
              appointments={rows.map((row) => ({ id: row.id, at: row.at, label: doctorLabel(row.doctorId) }))}
            />
          )}

          <ServerPager meta={appointments.data?.meta} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
