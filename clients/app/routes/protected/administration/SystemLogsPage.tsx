import { useState } from "react";
import { toast } from "sonner";
import { Search, Download, AlertTriangle, Info, CheckCircle, XCircle } from "lucide-react";

import { useAuditLogs } from "@/hooks/clinical/clinical.hooks";
import { systemLogsLevels as levels } from "@/data";
import { QueryError, QueryLoading } from "@/components/globals/query-state";
import { ServerPager } from "@/components/globals/server-pager";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { API_ENDPOINTS, downloadFile } from "@/services/api/client";
import { errorMessage } from "@/services/api/api-error";
import { formatDate, formatTime, label as toLabel } from "@/lib/format";

const levelIcons: Record<string, typeof Info> = {
  INFO: Info,
  WARNING: AlertTriangle,
  DANGER: XCircle,
  SUCCESS: CheckCircle,
};
const levelColors: Record<string, { bg: string; text: string; dot: string }> = {
  INFO: { bg: "#dbeafe", text: "#2563eb", dot: "#2563eb" },
  WARNING: { bg: "#fef9c3", text: "#d97706", dot: "#d97706" },
  DANGER: { bg: "#fee2e2", text: "#dc2626", dot: "#dc2626" },
  SUCCESS: { bg: "#dcfce7", text: "#16a34a", dot: "#16a34a" },
};

/** Audit modules as written by the API (`writeAudit({ module })`). */
const MODULE_FILTERS = [
  "patients",
  "appointments",
  "clinical",
  "nursing",
  "laboratory",
  "pharmacy",
  "billing",
  "reception",
  "admin",
  "files",
  "exports",
  "documents",
].map((value) => ({ value, label: toLabel(value) }));

export default function SystemLogsPage() {
  const [search, setSearch] = useState("");
  const [filterModule, setFilterModule] = useState("");
  const [filterLevel, setFilterLevel] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const debouncedSearch = useDebouncedValue(search);
  const logs = useAuditLogs({
    page,
    pageSize: 25,
    search: debouncedSearch || undefined,
    module: filterModule || undefined,
    level: filterLevel || undefined,
  });

  const rows = logs.data?.rows ?? [];

  const exportLogs = async () => {
    setExporting(true);
    try {
      await downloadFile(`${API_ENDPOINTS.exports("audit-logs")}?format=xlsx`, "audit-logs.xlsx");
    } catch (error) {
      toast.error(errorMessage(error, "Could not export the audit log."));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground mb-1">System Logs</h1>
          <p className="text-sm text-muted-foreground">Audit trail and system activity logs</p>
        </div>
        <button
          onClick={() => void exportLogs()}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2.5 bg-muted text-foreground border border-border rounded-[10px] cursor-pointer font-semibold text-[13px] disabled:opacity-60"
        >
          <Download size={15} /> {exporting ? "Exporting…" : "Export Logs"}
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 mb-4 flex gap-3 items-center">
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search logs..."
            className="w-full pl-8 pr-3 py-2 bg-muted border border-border rounded-lg text-[13px] text-foreground outline-none box-border"
          />
        </div>
        <select
          value={filterModule}
          onChange={(e) => {
            setFilterModule(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 bg-muted border border-border rounded-lg text-[13px] text-foreground cursor-pointer"
        >
          <option value="">All Modules</option>
          {MODULE_FILTERS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        <select
          value={filterLevel}
          onChange={(e) => {
            setFilterLevel(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 bg-muted border border-border rounded-lg text-[13px] text-foreground cursor-pointer"
        >
          {levels.map((l) => (
            <option key={l} value={l === "All Levels" ? "" : l.toUpperCase()}>
              {l === "All Levels" ? l : toLabel(l.toUpperCase())}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        {logs.isLoading && <QueryLoading text="Loading audit trail…" />}
        {logs.isError && <QueryError error={logs.error} onRetry={() => void logs.refetch()} />}

        {!logs.isLoading && !logs.isError && (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b-2 border-border">
                  {["Timestamp", "Actor", "Action", "Entity", "Level", "Module"].map((h) => (
                    <th key={h} className="text-left py-2.5 px-3.5 text-xs font-bold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((log) => {
                  const Icon = levelIcons[log.level] ?? Info;
                  const lc = levelColors[log.level] ?? levelColors.INFO;
                  return (
                    <tr key={log.id} className="border-b border-border">
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="font-mono text-xs text-foreground">{formatTime(log.createdAt)}</div>
                        <div className="text-[11px] text-muted-foreground">{formatDate(log.createdAt)}</div>
                      </td>
                      <td className="py-3 px-3.5 font-semibold text-foreground">
                        <div>{log.actorRole ? toLabel(log.actorRole) : "System"}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">{log.actorId ?? "—"}</div>
                      </td>
                      <td className="py-3 px-3.5 font-semibold text-foreground">{log.action}</td>
                      <td className="py-3 px-3.5 text-muted-foreground">
                        {log.entityType ? `${toLabel(log.entityType)}${log.entityId ? ` · ${log.entityId}` : ""}` : "—"}
                      </td>
                      <td className="py-3 px-3.5">
                        <span className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full w-fit" style={{ backgroundColor: lc.bg, color: lc.text }}>
                          <Icon size={11} /> {toLabel(log.level)}
                        </span>
                      </td>
                      <td className="py-3 px-3.5">
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">{log.module}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length === 0 && <div className="text-center py-10 text-muted-foreground">No logs match your filters.</div>}
          </div>
        )}
        <ServerPager meta={logs.data?.meta} onPageChange={setPage} />
      </div>
    </div>
  );
}
