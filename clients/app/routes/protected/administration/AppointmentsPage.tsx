import { useState } from "react";
import { Calendar, Search } from "lucide-react";

import { useAppointments } from "@/hooks/appointments/appointments.hooks";
import { QueryError, QueryLoading } from "@/components/globals/query-state";
import { ServerPager } from "@/components/globals/server-pager";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { formatDate, formatTime, label as toLabel } from "@/lib/format";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "REQUESTED", label: "Requested" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "CHECKED_IN", label: "Checked In" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "NO_SHOW", label: "No Show" },
];

const statusStyles: Record<string, { bg: string; text: string }> = {
  REQUESTED: { bg: "#fef9c3", text: "#ca8a04" },
  SCHEDULED: { bg: "#dbeafe", text: "#2563eb" },
  CONFIRMED: { bg: "#dbeafe", text: "#2563eb" },
  CHECKED_IN: { bg: "#dcfce7", text: "#16a34a" },
  IN_PROGRESS: { bg: "#ede9fe", text: "#7c3aed" },
  COMPLETED: { bg: "#dcfce7", text: "#16a34a" },
  CANCELLED: { bg: "#fee2e2", text: "#dc2626" },
  NO_SHOW: { bg: "#f1f5f9", text: "#64748b" },
};

export default function AppointmentsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [date, setDate] = useState("");
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebouncedValue(search);
  const appointments = useAppointments({
    page,
    pageSize: 20,
    search: debouncedSearch || undefined,
    status: status || undefined,
    date: date || undefined,
  });

  const rows = appointments.data?.rows ?? [];

  return (
    <div className="p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground mb-1">Appointments</h1>
          <p className="text-sm text-muted-foreground">Hospital-wide appointment schedule</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar size={15} />
          {appointments.data?.meta ? `${appointments.data.meta.total} appointments` : "—"}
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 mb-4 flex gap-3 items-center">
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by patient or MRN..."
            className="w-full pl-9 pr-3 py-2 bg-muted border border-border rounded-lg text-[13px] text-foreground outline-none focus:border-blue-600 transition-colors"
          />
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 bg-muted border border-border rounded-lg text-[13px] text-foreground"
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 bg-muted border border-border rounded-lg text-[13px] text-foreground cursor-pointer"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        {appointments.isLoading && <QueryLoading text="Loading appointments…" />}
        {appointments.isError && (
          <QueryError error={appointments.error} onRetry={() => void appointments.refetch()} />
        )}

        {!appointments.isLoading && !appointments.isError && (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b-2 border-border">
                  {["Date", "Time", "Patient", "MRN", "Doctor", "Type", "Mode", "Priority", "Status"].map((h) => (
                    <th key={h} className="text-left py-2 px-3.5 text-xs font-bold text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const style = statusStyles[row.status] ?? statusStyles.NO_SHOW;
                  return (
                    <tr key={row.id} className="border-b border-border">
                      <td className="py-3 px-3.5 text-foreground whitespace-nowrap">{formatDate(row.at)}</td>
                      <td className="py-3 px-3.5 font-mono text-xs text-foreground">{formatTime(row.at)}</td>
                      <td className="py-3 px-3.5 font-bold text-foreground">{row.patientName}</td>
                      <td className="py-3 px-3.5 font-mono text-xs text-blue-600 font-bold">{row.mrn}</td>
                      <td className="py-3 px-3.5 text-muted-foreground">{row.doctorId ? toLabel(row.doctorId.slice(0, 8)) : "—"}</td>
                      <td className="py-3 px-3.5 text-muted-foreground">{row.type}</td>
                      <td className="py-3 px-3.5 text-muted-foreground">{toLabel(row.mode)}</td>
                      <td className="py-3 px-3.5 text-muted-foreground">{toLabel(row.priority)}</td>
                      <td className="py-3 px-3.5">
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full" style={{ backgroundColor: style.bg, color: style.text }}>
                          {toLabel(row.status)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">No appointments match your filters.</div>
            )}
          </div>
        )}
        <ServerPager meta={appointments.data?.meta} onPageChange={setPage} />
      </div>
    </div>
  );
}
