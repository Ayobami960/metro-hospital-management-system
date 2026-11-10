import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Calendar, Clock, Video, User, Plus, CheckCircle, RefreshCw, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  useAppointments,
  useCancelAppointment,
  useCreateAppointment,
} from "@/hooks/appointments/appointments.hooks";
import { usePatients } from "@/hooks/patients/patients.hooks";
import { useSession } from "@/hooks/auth/use-session";
import { appointmentSchema, type AppointmentFormValues } from "@/schemas/appointment.schema";
import { QueryError, QueryLoading } from "@/components/globals/query-state";
import { ServerPager } from "@/components/globals/server-pager";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { errorMessage } from "@/services/api/api-error";
import { formatDate, formatTime, isoDate, label as toLabel } from "@/lib/format";

const statusClass: Record<string, string> = {
  CHECKED_IN: "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400",
  IN_PROGRESS: "bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-400",
  COMPLETED: "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400",
  SCHEDULED: "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400",
  CONFIRMED: "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400",
  REQUESTED: "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400",
  CANCELLED: "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400",
  NO_SHOW: "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400",
};

function StatusBadge({ status }: { status: string }) {
  const cls = statusClass[status] ?? "bg-muted text-muted-foreground";
  return <span className={cn("text-[11px] font-bold px-2.5 py-[3px] rounded-full", cls)}>{toLabel(status)}</span>;
}

function NewApptModal({ onClose }: { onClose: () => void }) {
  const { data: session } = useSession();
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search);
  const patients = usePatients({ pageSize: 20, search: debounced || undefined });
  const createAppointment = useCreateAppointment();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      patientId: "",
      doctorId: session?.doctorId ?? "",
      startsAt: "",
      mode: "IN_PERSON",
      type: "Consultation",
      priority: "ROUTINE",
      reason: "",
    },
  });

  const onSubmit = async (values: AppointmentFormValues) => {
    try {
      await createAppointment.mutateAsync({
        patientId: values.patientId,
        doctorId: session?.doctorId ?? values.doctorId ?? "",
        startsAt: new Date(values.startsAt).toISOString(),
        mode: values.mode,
        type: values.type || undefined,
        priority: values.priority,
        reason: values.reason || undefined,
      });
      toast.success("Appointment scheduled");
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, "Could not schedule the appointment."));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-card rounded-[20px] p-8 w-[480px] shadow-[0_20px_60px_rgba(0,0,0,0.2)]"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-extrabold text-foreground font-['Plus_Jakarta_Sans',sans-serif]">Schedule Appointment</h2>
          <button type="button" onClick={onClose} className="bg-transparent border-none cursor-pointer text-muted-foreground text-[22px]">×</button>
        </div>

        <div className="mb-4">
          <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Patient</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patients…"
            className="w-full py-2 px-3 mb-2 rounded-[10px] border border-border bg-background text-foreground text-sm box-border"
          />
          <select
            {...register("patientId")}
            className="w-full py-2.5 px-3 rounded-[10px] border border-border bg-background text-foreground text-sm"
          >
            <option value="">Select a patient</option>
            {(patients.data?.rows ?? []).map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.name} · {patient.mrn}
              </option>
            ))}
          </select>
          {errors.patientId && <p className="text-[11px] text-red-600 mt-1">{errors.patientId.message}</p>}
        </div>

        <div className="mb-4">
          <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Date &amp; Time</label>
          <input
            type="datetime-local"
            {...register("startsAt")}
            className="w-full py-2.5 px-3 rounded-[10px] border border-border bg-background text-foreground text-sm box-border"
          />
          {errors.startsAt && <p className="text-[11px] text-red-600 mt-1">{errors.startsAt.message}</p>}
        </div>

        <div className="mb-4">
          <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Type</label>
          <select {...register("mode")} className="w-full py-2.5 px-3 rounded-[10px] border border-border bg-background text-foreground text-sm">
            <option value="IN_PERSON">In-Person</option>
            <option value="VIRTUAL">Virtual</option>
          </select>
        </div>

        <div className="mb-4">
          <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Reason</label>
          <input
            {...register("reason")}
            className="w-full py-2.5 px-3 rounded-[10px] border border-border bg-background text-foreground text-sm box-border"
          />
        </div>

        <div className="flex gap-3 mt-2">
          <button type="button" onClick={onClose} className="flex-1 py-3 rounded-[10px] border border-border bg-muted text-foreground font-semibold cursor-pointer text-sm">Cancel</button>
          <button type="submit" disabled={createAppointment.isPending} className="flex-1 py-3 rounded-[10px] border-none bg-blue-600 text-white font-bold cursor-pointer text-sm disabled:opacity-60">
            {createAppointment.isPending ? "Scheduling…" : "Schedule"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AppointmentsPage() {
  const [tab, setTab] = useState<"Today" | "All Appointments">("Today");
  const [showModal, setShowModal] = useState(false);
  const [page, setPage] = useState(1);
  const today = isoDate();

  const appointments = useAppointments({
    page,
    pageSize: 20,
    date: tab === "Today" ? today : undefined,
  });
  const cancelAppointment = useCancelAppointment();

  const rows = appointments.data?.rows ?? [];
  const completed = rows.filter((a) => a.status === "COMPLETED").length;
  const upcoming = rows.filter((a) => a.status === "SCHEDULED" || a.status === "CONFIRMED").length;

  const stats = [
    { label: "Today's Total", value: String(appointments.data?.meta.total ?? rows.length), icon: Calendar, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-950" },
    { label: "Completed", value: String(completed), icon: CheckCircle, color: "text-green-600 dark:text-green-400", bg: "bg-green-100 dark:bg-green-950" },
    { label: "Upcoming", value: String(upcoming), icon: Clock, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-950" },
  ];

  return (
    <div className="p-6">
      {showModal && <NewApptModal onClose={() => setShowModal(false)} />}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-[26px] font-extrabold text-foreground mb-1 font-['Plus_Jakarta_Sans',sans-serif]">Appointments</h1>
          <p className="text-muted-foreground text-[15px]">Manage your patient schedule</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 py-3 px-5 bg-blue-600 text-white border-none rounded-xl font-bold text-sm cursor-pointer">
          <Plus size={16} /> New Appointment
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-card border border-border rounded-2xl p-6 flex gap-3.5 items-center card-shadow">
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

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-muted rounded-xl p-1 w-fit">
        {(["Today", "All Appointments"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setPage(1);
            }}
            className={`px-4 py-2 rounded-[10px] border-none cursor-pointer text-[13px] transition-all duration-150 ${
              tab === t ? "bg-card text-foreground font-bold shadow-sm" : "bg-transparent text-muted-foreground font-medium"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Appointments List */}
      <div className="bg-card border border-border rounded-2xl p-6 card-shadow">
        {appointments.isLoading && <QueryLoading text="Loading appointments…" />}
        {appointments.isError && <QueryError error={appointments.error} onRetry={() => void appointments.refetch()} />}

        {!appointments.isLoading && !appointments.isError && (
          <div className="flex flex-col">
            {rows.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">No appointments for this view.</div>
            )}
            {rows.map((a, i) => (
              <div key={a.id} className={`flex items-center gap-4 py-4 ${i < rows.length - 1 ? "border-b border-border" : ""}`}>
                <div className="w-[60px] text-center shrink-0">
                  <div className="text-xs font-bold text-blue-600 font-mono">{formatTime(a.at)}</div>
                  <div className="text-[10px] text-muted-foreground">{formatDate(a.at)}</div>
                </div>
                <div className="w-[42px] h-[42px] rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-[13px] font-bold text-blue-600 dark:text-blue-400 shrink-0">
                  {a.patientName.split(" ").map((n) => n[0]).join("")}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-bold text-foreground">{a.patientName}</span>
                    <span className="text-xs text-muted-foreground">· {a.mrn}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{a.reason ?? "No reason recorded"}</div>
                </div>
                <div className="flex items-center gap-2.5">
                  <StatusBadge status={a.status} />
                  <span className={cn("text-[11px] px-2 py-[3px] rounded-md font-semibold flex items-center gap-1", a.mode === "VIRTUAL" ? "bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-400" : "bg-muted text-muted-foreground")}>
                    {a.mode === "VIRTUAL" ? <Video size={10} /> : <User size={10} />} {toLabel(a.mode)}
                  </span>
                  <a href={`/doctor/emr?patientId=${a.patientId}`} className="py-1.5 px-3 bg-blue-600 text-white border-none rounded-lg text-xs font-semibold cursor-pointer">
                    Start Visit
                  </a>
                  <a href="/doctor/schedule" className="py-1.5 px-2.5 bg-muted text-foreground border-none rounded-lg text-xs cursor-pointer flex items-center gap-1">
                    <RefreshCw size={12} /> Reschedule
                  </a>
                  <button
                    onClick={() =>
                      cancelAppointment.mutate(
                        { appointmentId: a.id, reason: "Cancelled by doctor" },
                        {
                          onSuccess: () => toast.success("Appointment cancelled"),
                          onError: (cancelError) => toast.error(errorMessage(cancelError, "Could not cancel.")),
                        },
                      )
                    }
                    disabled={cancelAppointment.isPending || a.status === "COMPLETED" || a.status === "CANCELLED"}
                    className="py-1.5 px-2.5 bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 border-none rounded-lg text-xs cursor-pointer flex items-center gap-1 disabled:opacity-40"
                  >
                    <XCircle size={12} /> Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <ServerPager meta={appointments.data?.meta} onPageChange={setPage} />
      </div>
    </div>
  );
}
