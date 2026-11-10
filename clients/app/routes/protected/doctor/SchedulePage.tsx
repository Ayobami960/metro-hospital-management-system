import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Video, User, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

import { useAppointments } from "@/hooks/appointments/appointments.hooks";
import { useSession } from "@/hooks/auth/use-session";
import { QueryError, QueryLoading } from "@/components/globals/query-state";
import { formatTime, isoDate, label as toLabel } from "@/lib/format";
import type { AppointmentRow } from "@/services/appointments/appointment.api";

const SLOT_H = 60;
const HOURS = Array.from({ length: 10 }, (_, i) => 8 + i);

const startOfWeek = (offset: number) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  const day = (date.getDay() + 6) % 7; // Monday = 0
  date.setDate(date.getDate() - day + offset * 7);
  return date;
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

function useDayAppointments(dates: Date[]) {
  const { data: session } = useSession();
  const doctorId = session?.doctorId ?? undefined;
  const week = useMemo(
    () =>
      dates.map((date) => ({
        date,
        iso: isoDate(date),
      })),
    [dates],
  );
  return week.map((day) => ({
    ...day,
    query: useAppointments({ doctorId, date: day.iso, pageSize: 50 }),
  }));
}

export default function SchedulePage() {
  const [view, setView] = useState<"Week" | "Day">("Week");
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  const weekStart = startOfWeek(weekOffset);
  const dates = useMemo(() => Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)), [weekStart.getTime()]);
  const days = useDayAppointments(dates);

  const appointmentsFor = (dayIndex: number, hour: number): AppointmentRow | undefined =>
    (days[dayIndex]?.query.data?.rows ?? []).find((appointment) => new Date(appointment.at).getHours() === hour);

  const isLoading = days.some((day) => day.query.isLoading);
  const isError = days.find((day) => day.query.isError);
  const dayLabel = (date: Date) =>
    date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });

  const renderCell = (dayIndex: number, hour: number) => {
    const appointment = appointmentsFor(dayIndex, hour);
    if (!appointment) {
      return <div className="rounded-lg border border-dashed border-border cursor-pointer transition-colors duration-100" style={{ height: SLOT_H }} />;
    }
    const isVirtual = appointment.mode === "VIRTUAL";
    const durationHours = Math.max(
      1,
      (new Date(appointment.endsAt).getTime() - new Date(appointment.at).getTime()) / 3_600_000,
    );
    return (
      <div
        className={`rounded-[10px] p-2.5 cursor-pointer overflow-hidden border-l-[3px] ${isVirtual ? "bg-violet-100 border-violet-600" : "bg-blue-100 border-blue-600"}`}
        style={{ height: SLOT_H * durationHours - 4 }}
      >
        <div className={`text-xs font-bold mb-0.5 whitespace-nowrap overflow-hidden text-ellipsis ${isVirtual ? "text-violet-700" : "text-blue-800"}`}>
          {appointment.patientName}
        </div>
        <div className={`text-[10px] flex items-center gap-0.5 ${isVirtual ? "text-violet-600" : "text-blue-500"}`}>
          {isVirtual ? <Video size={10} /> : <User size={10} />} {toLabel(appointment.mode)}
        </div>
      </div>
    );
  };

  const weekAppointments = days.flatMap((day) => day.query.data?.rows ?? []);
  const firstSlot = weekAppointments.length
    ? weekAppointments.reduce((earliest, appointment) => (appointment.at < earliest ? appointment.at : earliest), weekAppointments[0].at)
    : null;
  const lastSlot = weekAppointments.length
    ? weekAppointments.reduce((latest, appointment) => (appointment.endsAt > latest ? appointment.endsAt : latest), weekAppointments[0].endsAt)
    : null;

  return (
    <div className="p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-[26px] font-extrabold text-foreground mb-1 font-['Plus_Jakarta_Sans',sans-serif]">Schedule</h1>
          <p className="text-muted-foreground text-[15px]">
            Week of {dates[0].toLocaleDateString(undefined, { month: "long", day: "numeric" })} – {dates[4].toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <div className="flex gap-2.5 items-center">
          <div className="flex gap-0.5 bg-muted rounded-[10px] p-0.5">
            {(["Week", "Day"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-[7px] rounded-lg border-none cursor-pointer text-[13px] ${view === v ? "bg-card text-foreground font-bold" : "bg-transparent text-muted-foreground font-medium"}`}
              >
                {v}
              </button>
            ))}
          </div>
          <button onClick={() => setShowSettings(!showSettings)} className="flex items-center gap-1.5 py-[9px] px-4 bg-card border border-border rounded-[10px] cursor-pointer text-[13px] font-semibold text-foreground">
            <Settings size={14} /> Settings
          </button>
          <div className="flex gap-1">
            <button onClick={() => setWeekOffset((offset) => offset - 1)} className="py-[9px] px-3 bg-card border border-border rounded-[10px] cursor-pointer text-foreground">
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => setWeekOffset((offset) => offset + 1)} className="py-[9px] px-3 bg-card border border-border rounded-[10px] cursor-pointer text-foreground">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {showSettings && (
        <div className="bg-card border border-border rounded-2xl p-6 mb-5">
          <h3 className="text-[15px] font-bold text-foreground mb-4 font-['Plus_Jakarta_Sans',sans-serif]">This Week at a Glance</h3>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Booked Appointments", value: String(weekAppointments.length) },
              { label: "First Appointment", value: firstSlot ? formatTime(firstSlot) : "—" },
              { label: "Last Appointment Ends", value: lastSlot ? formatTime(lastSlot) : "—" },
              { label: "Virtual", value: String(weekAppointments.filter((a) => a.mode === "VIRTUAL").length) },
              { label: "In Person", value: String(weekAppointments.filter((a) => a.mode === "IN_PERSON").length) },
              { label: "Requests Awaiting Review", value: String(weekAppointments.filter((a) => a.status === "REQUESTED").length) },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-xs font-semibold text-muted-foreground block mb-1.5">{stat.label}</div>
                <div className="w-full py-[9px] px-3 rounded-lg border border-border bg-muted text-foreground text-sm font-mono">{stat.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4 mb-4 text-xs">
        {[
          { label: "In-Person", bg: "bg-blue-100 dark:bg-blue-950", border: "border-l-blue-600 dark:border-l-blue-400" },
          { label: "Virtual", bg: "bg-violet-100 dark:bg-violet-950", border: "border-l-violet-600 dark:border-l-violet-400" },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className={cn("w-3 h-3 rounded-[3px] border-l-[3px]", l.bg, l.border)} />
            <span className="text-muted-foreground">{l.label}</span>
          </div>
        ))}
      </div>

      {isLoading && <QueryLoading text="Loading your schedule…" />}
      {!isLoading && isError && <QueryError error={isError.query.error} onRetry={() => void isError.query.refetch()} />}

      {!isLoading && !isError && view === "Week" && (
        <div className="bg-card border border-border rounded-2xl p-6 overflow-x-auto card-shadow">
          <div className="grid gap-0" style={{ gridTemplateColumns: "64px repeat(5, 1fr)", minWidth: 700 }}>
            {/* Header */}
            <div className="border-b border-border pb-3" />
            {dates.map((date, i) => (
              <div key={i} className="border-b border-border pb-3 pl-2 text-center">
                <div className="text-[11px] font-bold text-muted-foreground uppercase">
                  {date.toLocaleDateString(undefined, { weekday: "short" })}
                </div>
                <div className="text-lg font-extrabold text-foreground font-mono">{date.getDate()}</div>
              </div>
            ))}
            {/* Time slots */}
            {HOURS.map((hour) => (
              <div key={`${hour}-row`} className="contents">
                <div className="pt-2 pr-3 text-right text-[11px] text-muted-foreground border-r border-border font-mono">
                  {String(hour).padStart(2, "0")}:00
                </div>
                {[0, 1, 2, 3, 4].map((dayIndex) => (
                  <div key={dayIndex} className="p-1 border-b border-r border-border">
                    {renderCell(dayIndex, hour)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {!isLoading && !isError && view === "Day" && (
        <div className="grid gap-4" style={{ gridTemplateColumns: "200px 1fr" }}>
          <div className="flex flex-col gap-2">
            {dates.map((date, i) => (
              <button
                key={i}
                onClick={() => setSelectedDay(i)}
                className={`py-3 px-4 rounded-xl cursor-pointer text-left ${selectedDay === i ? "border-2 border-blue-600 bg-blue-100" : "border border-border bg-card"}`}
              >
                <div className="text-[13px] font-bold text-foreground">{dayLabel(date)}</div>
                <div className="text-[11px] text-muted-foreground">
                  {days[i]?.query.data?.rows.length ?? 0} appts
                </div>
              </button>
            ))}
          </div>
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="text-base font-bold text-foreground mb-4 font-['Plus_Jakarta_Sans',sans-serif]">{dayLabel(dates[selectedDay])}</h3>
            <div className="flex flex-col">
              {HOURS.map((hour) => {
                const appointment = appointmentsFor(selectedDay, hour);
                return (
                  <div key={hour} className="flex gap-4 border-b border-border items-stretch" style={{ minHeight: SLOT_H }}>
                    <div className="w-14 pt-3 text-[11px] text-muted-foreground font-mono shrink-0">
                      {String(hour).padStart(2, "0")}:00
                    </div>
                    <div className="flex-1 py-2">
                      {appointment ? (
                        <div className={`rounded-[10px] py-2.5 px-3.5 border-l-[3px] ${appointment.mode === "VIRTUAL" ? "bg-violet-100 border-violet-600" : "bg-blue-100 border-blue-600"}`}>
                          <div className={`text-sm font-bold ${appointment.mode === "VIRTUAL" ? "text-violet-700" : "text-blue-800"}`}>
                            {appointment.patientName}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            {appointment.mode === "VIRTUAL" ? <Video size={11} /> : <User size={11} />}{" "}
                            {toLabel(appointment.mode)} · {formatTime(appointment.at)}–{formatTime(appointment.endsAt)}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
