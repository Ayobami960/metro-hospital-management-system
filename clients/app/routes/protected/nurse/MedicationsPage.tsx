import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle, Clock, AlertTriangle, XCircle, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

import { useNurseDashboard } from "@/hooks/dashboards/dashboard.hooks";
import { useAdministerMedication } from "@/hooks/nursing/nursing.hooks";
import { QueryError, QueryLoading, InlineEmpty } from "@/components/globals/query-state";
import { errorMessage } from "@/services/api/api-error";
import { formatDate, formatTime, isoDate, label as toLabel } from "@/lib/format";

const statusConfig: Record<string, { cls: string; icon: typeof CheckCircle }> = {
  GIVEN: { cls: "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400", icon: CheckCircle },
  SCHEDULED: { cls: "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400", icon: Clock },
  DUE: { cls: "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400", icon: Clock },
  OVERDUE: { cls: "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400", icon: AlertTriangle },
  HELD: { cls: "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400", icon: XCircle },
};

const routeClass: Record<string, string> = {
  PO: "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400",
  IV: "bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-400",
  SQ: "bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-400",
  IM: "bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-400",
};

type Window = "Next 1hr" | "Next 4hr" | "All Day";

export default function MedicationsPage() {
  const dashboard = useNurseDashboard();
  const administer = useAdministerMedication();
  const [timeFilter, setTimeFilter] = useState<Window>("All Day");

  if (dashboard.isLoading) {
    return (
      <div className="p-6">
        <QueryLoading text="Loading the medication record…" />
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

  const schedule = dashboard.data.medicationSchedule;
  const now = Date.now();
  const windowMs = timeFilter === "Next 1hr" ? 3_600_000 : timeFilter === "Next 4hr" ? 14_400_000 : null;
  const filtered = schedule.filter((entry) => {
    if (windowMs === null) return true;
    const due = new Date(entry.scheduledFor).getTime();
    return due >= now - 600_000 && due <= now + windowMs;
  });

  const stats = [
    { label: "Given", value: schedule.filter((entry) => entry.status === "GIVEN").length, color: "text-green-600 dark:text-green-400", bg: "bg-green-100 dark:bg-green-950", icon: CheckCircle },
    { label: "Pending", value: schedule.filter((entry) => entry.status === "SCHEDULED" || entry.status === "DUE").length, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-950", icon: Clock },
    { label: "Overdue", value: schedule.filter((entry) => entry.status === "OVERDUE").length, color: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-950", icon: AlertTriangle },
    { label: "Held", value: schedule.filter((entry) => entry.status === "HELD").length, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-950", icon: XCircle },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-[26px] font-extrabold text-foreground mb-1 font-['Plus_Jakarta_Sans',sans-serif]">Medication Administration Record</h1>
        <p className="text-muted-foreground text-[15px]">{formatDate(isoDate())} · {schedule.length} scheduled administrations</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-card border border-border rounded-2xl p-6 flex items-center gap-3.5 card-shadow">
              <div className={cn("w-[46px] h-[46px] rounded-[14px] flex items-center justify-center shrink-0", s.bg)}>
                <Icon size={20} className={s.color} />
              </div>
              <div>
                <div className="text-[26px] font-extrabold text-foreground font-mono">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MAR Table */}
      <div className="bg-card border border-border rounded-2xl p-6 card-shadow">
        {/* Toolbar */}
        <div className="flex justify-between items-center mb-5">
          <div className="text-base font-bold text-foreground font-['Plus_Jakarta_Sans',sans-serif]">
            Medication Administration Record
          </div>
          <div className="flex items-center gap-2">
            <Filter size={14} color="var(--muted-foreground)" />
            <span className="text-[13px] text-muted-foreground mr-1">Time window:</span>
            {(["Next 1hr", "Next 4hr", "All Day"] as Window[]).map((filter) => (
              <button
                key={filter}
                onClick={() => setTimeFilter(filter)}
                className={cn(
                  "py-[7px] px-3.5 rounded-lg text-xs font-semibold border-[1.5px] cursor-pointer transition-all duration-150",
                  timeFilter === filter ? "bg-cyan-600 text-white border-cyan-600" : "bg-card text-foreground border-border",
                )}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b-2 border-border">
                {["Patient", "Medication", "Dose", "Route", "Scheduled", "Status", "Action"].map((h) => (
                  <th key={h} className="py-2.5 px-3.5 text-left text-[11px] font-bold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => {
                const config = statusConfig[entry.status] ?? statusConfig.SCHEDULED;
                const StatusIcon = config.icon;
                const overdue = entry.status === "OVERDUE";
                const given = entry.status === "GIVEN";
                return (
                  <tr key={entry.id} className={cn("border-b border-border transition-colors duration-200", overdue ? "bg-red-50 dark:bg-red-950/20" : given ? "bg-green-50 dark:bg-green-950/20" : "")}>
                    <td className="py-3 px-3.5 font-bold text-foreground">
                      <div className="flex items-center gap-2">
                        {overdue && <AlertTriangle size={14} color="#dc2626" />}
                        {entry.patientName}
                      </div>
                    </td>
                    <td className="py-3 px-3.5 text-foreground font-medium">{entry.drug}</td>
                    <td className="py-3 px-3.5 font-mono font-bold text-foreground">{entry.dose}</td>
                    <td className="py-3 px-3.5">
                      <span className={cn("text-[11px] font-bold px-2 py-[3px] rounded-md", routeClass[entry.route] ?? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400")}>
                        {entry.route}
                      </span>
                    </td>
                    <td className={cn("py-3 px-3.5 font-mono font-bold", overdue ? "text-red-600 dark:text-red-400" : "text-foreground")}>
                      {entry.time || formatTime(entry.scheduledFor)}
                    </td>
                    <td className="py-3 px-3.5">
                      <div className={cn("flex items-center gap-1.5 py-[5px] px-2.5 rounded-full w-fit", config.cls)}>
                        <StatusIcon size={12} />
                        <span className="text-[11px] font-bold">{toLabel(entry.status)}</span>
                      </div>
                      {entry.holdReason && <div className="text-[11px] text-amber-600 mt-0.5">{entry.holdReason}</div>}
                    </td>
                    <td className="py-3 px-3.5">
                      {!given && entry.status !== "HELD" && (
                        <button
                          onClick={() =>
                            administer.mutate(
                              { medicationId: entry.id, input: { status: "GIVEN" } },
                              {
                                onSuccess: () => toast.success("Dose recorded as given"),
                                onError: (error) => toast.error(errorMessage(error, "Could not record the dose.")),
                              },
                            )
                          }
                          disabled={administer.isPending}
                          className={cn(
                            "py-[7px] px-3.5 text-white border-none rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap disabled:opacity-60",
                            overdue ? "bg-red-600 dark:bg-red-500" : "bg-cyan-600 dark:bg-cyan-500",
                          )}
                        >
                          Mark as Given
                        </button>
                      )}
                      {given && <span className="text-xs text-green-600 font-bold">✓ Given</span>}
                      {entry.status === "HELD" && <span className="text-xs text-amber-600 font-bold">— Held</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <InlineEmpty text="No administrations in this time window." />}
        </div>
      </div>
    </div>
  );
}
