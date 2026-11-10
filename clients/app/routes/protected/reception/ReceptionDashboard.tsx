import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Users, Calendar, Clock, CheckCircle, Plus, Shield } from "lucide-react";

import { useReceptionDashboard } from "@/hooks/dashboards/dashboard.hooks";
import {
  useCallNextPatient,
  useCompleteQueueEntry,
  useStartQueueEntry,
} from "@/hooks/reception/reception.hooks";
import { usePatients, usePatientEligibility } from "@/hooks/patients/patients.hooks";
import { QueryError, QueryLoading, InlineEmpty } from "@/components/globals/query-state";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { errorMessage } from "@/services/api/api-error";
import { formatDate, formatTime, isoDate, label as toLabel, money, relativeTime } from "@/lib/format";

const statusStyle: Record<string, { bg: string; color: string }> = {
  WAITING: { bg: "#fef9c3", color: "#ca8a04" },
  CALLED: { bg: "#dbeafe", color: "#2563eb" },
  IN_PROGRESS: { bg: "#dcfce7", color: "#16a34a" },
  COMPLETED: { bg: "#f1f5f9", color: "#64748b" },
  REMOVED: { bg: "#fee2e2", color: "#dc2626" },
  REQUESTED: { bg: "#fef9c3", color: "#ca8a04" },
  SCHEDULED: { bg: "#dbeafe", color: "#2563eb" },
  CONFIRMED: { bg: "#dbeafe", color: "#2563eb" },
  CHECKED_IN: { bg: "#dcfce7", color: "#16a34a" },
};

function Badge({ status }: { status: string }) {
  const style = statusStyle[status] ?? statusStyle.CONFIRMED;
  return (
    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap" style={{ backgroundColor: style.bg, color: style.color }}>
      {toLabel(status)}
    </span>
  );
}

export default function ReceptionDashboard() {
  const navigate = useNavigate();
  const dashboard = useReceptionDashboard();
  const callNext = useCallNextPatient();
  const startEntry = useStartQueueEntry();
  const completeEntry = useCompleteQueueEntry();

  const [insuranceSearch, setInsuranceSearch] = useState("");
  const [lookupPatientId, setLookupPatientId] = useState("");
  const [insuranceQuery, setInsuranceQuery] = useState("");
  const lookup = usePatients({ pageSize: 10, search: useDebouncedValue(insuranceQuery) || undefined });
  const eligibility = usePatientEligibility(lookupPatientId || null);

  if (dashboard.isLoading) {
    return (
      <div className="p-6">
        <QueryLoading text="Loading the desk…" />
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

  const { stats, queue, todayAppointments, pendingRequests } = dashboard.data;

  const cards = [
    { label: "In Queue", value: String(stats.inQueue), sub: `${stats.waiting} waiting`, icon: Users, bg: "#dbeafe", color: "#2563eb" },
    { label: "Avg Wait", value: `${stats.avgWaitMinutes} min`, sub: `${stats.called} called`, icon: Clock, bg: "#fef9c3", color: "#ca8a04" },
    { label: "Today's Appointments", value: String(stats.todayAppointments), sub: `${stats.checkedIn} checked in`, icon: Calendar, bg: "#dcfce7", color: "#16a34a" },
    { label: "Completed", value: String(stats.completedToday), sub: `${stats.noShowsToday} no-shows`, icon: CheckCircle, bg: "#f1f5f9", color: "#64748b" },
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground mb-1">Reception Desk 🏥</h1>
          <p className="text-sm text-muted-foreground">
            {formatDate(isoDate())} · {stats.registeredToday} registered today · Main Lobby
          </p>
        </div>
        <div className="flex gap-2.5">
          <button onClick={() => navigate("/reception/register")} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white border-none rounded-[10px] text-sm font-semibold cursor-pointer">
            <Plus size={16} /> Register Walk-In
          </button>
          <button
            onClick={() =>
              callNext.mutate(undefined, {
                onSuccess: (entry) => toast.success(`Called ticket ${entry.ticketNumber}`),
                onError: (error) => toast.error(errorMessage(error, "Nobody is waiting to be called.")),
              })
            }
            disabled={callNext.isPending || stats.waiting === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-card text-foreground border border-border rounded-[10px] text-sm font-semibold cursor-pointer disabled:opacity-50"
          >
            <CheckCircle size={16} /> Call Next
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-card border border-border rounded-2xl p-5 flex gap-3.5 items-center">
              <div className="w-[46px] h-[46px] rounded-[14px] flex items-center justify-center" style={{ backgroundColor: card.bg }}>
                <Icon size={20} style={{ color: card.color }} />
              </div>
              <div>
                <div className="text-[22px] font-extrabold text-foreground">{card.value}</div>
                <div className="text-xs text-muted-foreground">{card.label}</div>
                <div className="text-[11px] font-semibold" style={{ color: card.color }}>{card.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        <div className="bg-card border border-border rounded-2xl p-5 lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-bold text-foreground">Live Patient Queue</h3>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-600 animate-pulse" />
              <span className="text-xs text-green-600 font-semibold">Live</span>
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            {queue.map((entry) => (
              <div
                key={entry.id}
                className={`flex items-center gap-3.5 p-3.5 rounded-xl ${entry.priority === "STAT" ? "bg-red-50 border border-red-200" : "bg-muted"}`}
              >
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-extrabold shrink-0">
                  {entry.position}
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-bold text-foreground">
                    {entry.patientName} <span className="text-muted-foreground font-normal text-xs">· {entry.mrn}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {entry.ticketNumber} · Arrived {formatTime(entry.checkInAt)}
                  </div>
                </div>
                <div className="flex gap-1.5 items-center">
                  <Badge status={entry.status} />
                  <div className="text-right">
                    <div className="text-[11px] text-muted-foreground">Wait</div>
                    <div className="text-xs font-bold font-mono" style={{ color: entry.waitMinutes > 30 ? "#dc2626" : "var(--foreground)" }}>
                      {entry.waitMinutes} min
                    </div>
                  </div>
                </div>
                <button
                  onClick={() =>
                    (entry.status === "CALLED" ? startEntry : completeEntry).mutate(entry.id, {
                      onSuccess: () => toast.success("Queue updated"),
                      onError: (error) => toast.error(errorMessage(error, "Could not update the queue.")),
                    })
                  }
                  disabled={entry.status === "COMPLETED" || entry.status === "REMOVED"}
                  className="px-3 py-1.5 bg-blue-600 text-white border-none rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap disabled:opacity-40"
                >
                  {entry.status === "CALLED" ? "Start Visit" : "Check In"}
                </button>
              </div>
            ))}
            {queue.length === 0 && <InlineEmpty text="The queue is empty." />}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="text-base font-bold text-foreground mb-4">Insurance Verification</h3>
            <div className="flex gap-2 mb-3">
              <input
                className="flex-1 px-3 py-2 border-[1.5px] border-border rounded-lg text-[13px] bg-card text-foreground outline-none box-border focus:border-blue-600"
                placeholder="Enter insurance ID..."
                value={insuranceSearch}
                onChange={(e) => setInsuranceSearch(e.target.value)}
              />
              <button
                onClick={() => setInsuranceQuery(insuranceSearch)}
                className="px-3.5 py-2 bg-blue-600 text-white border-none rounded-lg text-[13px] font-semibold cursor-pointer flex items-center gap-1.5"
              >
                <Shield size={14} /> Find
              </button>
            </div>
            {insuranceQuery && (
              <div className="flex flex-col gap-1.5 mb-2">
                {(lookup.data?.rows ?? []).map((patient) => (
                  <button
                    key={patient.id}
                    onClick={() => setLookupPatientId(patient.id)}
                    className="text-left text-xs py-1.5 px-2 rounded-md bg-muted hover:bg-accent"
                  >
                    {patient.name} · {patient.mrn}
                  </button>
                ))}
                {lookup.data && lookup.data.rows.length === 0 && (
                  <div className="text-xs text-muted-foreground">No patient matches that search.</div>
                )}
              </div>
            )}
            {eligibility.isLoading && <div className="text-xs text-muted-foreground">Checking eligibility…</div>}
            {eligibility.isError && <div className="text-xs text-red-600">{errorMessage(eligibility.error)}</div>}
            {eligibility.data && (
              <div className="p-3.5 rounded-xl" style={{ backgroundColor: eligibility.data.eligible ? "#dcfce7" : "#fee2e2", border: `1px solid ${eligibility.data.eligible ? "#86efac" : "#fecaca"}` }}>
                <div className="text-[13px] font-bold" style={{ color: eligibility.data.eligible ? "#16a34a" : "#dc2626" }}>
                  {eligibility.data.eligible ? "✓ Coverage active" : "✗ Coverage not active"}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {[
                    eligibility.data.insurer,
                    eligibility.data.plan,
                    eligibility.data.copayMinor != null ? `Copay ${money(eligibility.data.copayMinor)}` : null,
                    eligibility.data.reason,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "No plan details returned."}
                </div>
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="text-base font-bold text-foreground mb-4">Today's Appointments</h3>
            <div className="flex flex-col gap-2">
              {todayAppointments.slice(0, 6).map((appointment) => (
                <div key={appointment.id} className="flex items-center gap-2.5 p-2.5 bg-muted rounded-[10px]">
                  <span className="text-xs font-bold text-blue-600 font-mono w-14 shrink-0">{formatTime(appointment.at)}</span>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-foreground">{appointment.patientName}</div>
                    <div className="text-[11px] text-muted-foreground">{appointment.doctorName} · {toLabel(appointment.mode)}</div>
                  </div>
                  <Badge status={appointment.status} />
                </div>
              ))}
              {todayAppointments.length === 0 && <InlineEmpty text="No appointments booked for today." />}
            </div>
          </div>
        </div>
      </div>

      {pendingRequests.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-base font-bold text-foreground mb-4">Pending Appointment Requests</h3>
          <div className="flex flex-col gap-2">
            {pendingRequests.map((request) => (
              <div key={request.id} className="flex items-center gap-3.5 p-3.5 bg-muted rounded-xl">
                <div className="flex-1">
                  <div className="text-[13px] font-bold text-foreground">
                    {request.patientName} · {request.doctorName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Requested for {relativeTime(request.requestedFor)} · {toLabel(request.mode)}
                    {request.reason ? ` · ${request.reason}` : ""}
                  </div>
                </div>
                <a href="/reception/appointments" className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold">
                  Review
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
