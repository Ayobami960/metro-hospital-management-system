import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Search, Download, UserPlus, X, ChevronRight, ShieldCheck } from "lucide-react";

import { usePatients, usePatient, usePatientEligibility } from "@/hooks/patients/patients.hooks";
import { useClinicalSummary } from "@/hooks/clinical/clinical.hooks";
import { QueryError, QueryLoading } from "@/components/globals/query-state";
import { ServerPager } from "@/components/globals/server-pager";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { downloadFile, API_ENDPOINTS } from "@/services/api/client";
import { errorMessage } from "@/services/api/api-error";
import { formatDate, label as toLabel, money } from "@/lib/format";

const statusStyles: Record<string, { bg: string; text: string }> = {
  ACTIVE: { bg: "#dcfce7", text: "#16a34a" },
  INACTIVE: { bg: "#fee2e2", text: "#dc2626" },
  DECEASED: { bg: "#f1f5f9", text: "#64748b" },
  MERGED: { bg: "#f1f5f9", text: "#64748b" },
};

export default function PatientsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [insuranceId, setInsuranceId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const debouncedSearch = useDebouncedValue(search);
  const patients = usePatients({ page, pageSize: 20, search: debouncedSearch || undefined });
  const detail = usePatient(selectedId);
  const summary = useClinicalSummary(selectedId);
  const eligibility = usePatientEligibility(insuranceId);

  const rows = patients.data?.rows ?? [];
  const meta = patients.data?.meta;
  const selected = detail.data ?? rows.find((row) => row.id === selectedId) ?? null;

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadFile(
        `${API_ENDPOINTS.exports("patients")}?format=csv&search=${encodeURIComponent(debouncedSearch)}`,
        "patients.csv",
      );
    } catch (error) {
      toast.error(errorMessage(error, "Could not export patients."));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-6 flex gap-5 h-[calc(100vh-80px)] box-border">
      <div className="flex-1 overflow-auto">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-foreground mb-1">Patient Records</h1>
            <p className="text-sm text-muted-foreground">
              {meta ? meta.total : rows.length} total patients in the system
            </p>
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={() => void exportCsv()}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2.5 bg-muted text-foreground border border-border rounded-xl cursor-pointer font-semibold text-[13px] hover:bg-accent transition-colors disabled:opacity-60"
            >
              <Download size={15} /> {exporting ? "Exporting…" : "Export CSV"}
            </button>
            <button
              onClick={() => navigate("/reception/register")}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white border-none rounded-xl cursor-pointer font-bold text-[13px] hover:bg-blue-700 transition-colors"
            >
              <UserPlus size={15} /> Register Patient
            </button>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-3 mb-4">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name or MRN..."
              className="w-full pl-9 pr-3 py-2.5 bg-muted border border-border rounded-lg text-[13px] text-foreground outline-none focus:border-blue-600 transition-colors box-border"
            />
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5">
          {patients.isLoading && <QueryLoading text="Loading patients…" />}
          {patients.isError && <QueryError error={patients.error} onRetry={() => void patients.refetch()} />}

          {!patients.isLoading && !patients.isError && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b-2 border-border">
                      {["MRN", "Name", "Age/DOB", "Sex", "Blood Type", "BMI", "Phone", "Status", "SSN", ""].map((h) => (
                        <th key={h} className="text-left py-2 px-3.5 text-xs font-bold text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p) => {
                      const style = statusStyles[p.status] ?? statusStyles.INACTIVE;
                      return (
                        <tr
                          key={p.id}
                          className={`border-b border-border cursor-pointer transition-colors ${selectedId === p.id ? "bg-muted" : ""}`}
                          onClick={() => {
                            setSelectedId(p.id);
                            setInsuranceId(null);
                          }}
                        >
                          <td className="py-3 px-3.5 font-mono text-xs text-blue-600 font-bold">{p.mrn}</td>
                          <td className="py-3 px-3.5 font-bold text-foreground">{p.name}</td>
                          <td className="py-3 px-3.5 text-muted-foreground text-xs">
                            <div className="font-semibold text-foreground">{p.age} yrs</div>
                            <div className="text-[11px]">{formatDate(p.dateOfBirth)}</div>
                          </td>
                          <td className="py-3 px-3.5 text-muted-foreground">{toLabel(p.sexAtBirth)}</td>
                          <td className="py-3 px-3.5 font-mono font-bold text-red-600 text-[13px]">
                            {p.bloodType.replace("_POS", "+").replace("_NEG", "−")}
                          </td>
                          <td className="py-3 px-3.5 font-mono text-muted-foreground text-xs">
                            {p.bmi === null ? "—" : p.bmi.toFixed(1)}
                          </td>
                          <td className="py-3 px-3.5 text-muted-foreground text-xs">{p.phone ?? "—"}</td>
                          <td className="py-3 px-3.5">
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full" style={{ backgroundColor: style.bg, color: style.text }}>
                              {toLabel(p.status)}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 font-mono text-muted-foreground text-xs">
                            {p.ssnLast4 ? `•••-${p.ssnLast4}` : "—"}
                          </td>
                          <td className="py-3 px-3.5">
                            <ChevronRight size={14} className="text-muted-foreground" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {rows.length === 0 && (
                  <div className="text-center py-10 text-muted-foreground">No patients match your search.</div>
                )}
              </div>
              <ServerPager meta={meta} onPageChange={setPage} />
            </>
          )}
        </div>
      </div>

      {/* Slide-out detail panel */}
      {selectedId && (
        <div className="w-[340px] bg-card border border-border rounded-2xl p-6 shrink-0 overflow-y-auto">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-base font-extrabold text-foreground">Patient Details</h2>
            <button
              onClick={() => {
                setSelectedId(null);
                setInsuranceId(null);
              }}
              className="bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground"
            >
              <X size={18} />
            </button>
          </div>

          {detail.isLoading && <QueryLoading text="Loading patient…" />}
          {detail.isError && <QueryError error={detail.error} onRetry={() => void detail.refetch()} />}

          {selected && (
            <>
              <div className="text-center mb-5">
                <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-2xl font-extrabold text-white mx-auto mb-2.5">
                  {selected.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="font-extrabold text-base text-foreground">{selected.name}</div>
                <div className="font-mono text-xs text-blue-600 font-bold mt-0.5">{selected.mrn}</div>
                <span
                  className="text-[11px] font-bold px-2.5 py-0.5 rounded-full inline-block mt-2"
                  style={{
                    backgroundColor: (statusStyles[selected.status] ?? statusStyles.INACTIVE).bg,
                    color: (statusStyles[selected.status] ?? statusStyles.INACTIVE).text,
                  }}
                >
                  {toLabel(selected.status)}
                </span>
              </div>

              {[
                { label: "Date of Birth", value: `${formatDate(selected.dateOfBirth)} (${selected.age} yrs)` },
                { label: "Sex", value: toLabel(selected.sexAtBirth) },
                { label: "Blood Type", value: selected.bloodType.replace("_POS", "+").replace("_NEG", "−") },
                { label: "BMI", value: selected.bmi === null ? "—" : selected.bmi.toFixed(1) },
                { label: "Phone", value: selected.phone ?? "—" },
                { label: "Email", value: selected.email ?? "—" },
                { label: "SSN", value: selected.ssnLast4 ? `•••-${selected.ssnLast4}` : "—" },
              ].map((f) => (
                <div key={f.label} className="border-b border-border pb-3 mb-3">
                  <div className="text-[11px] font-bold text-muted-foreground mb-1">{f.label}</div>
                  <div className="text-[13px] text-foreground font-semibold">{f.value}</div>
                </div>
              ))}

              {detail.data && (
                <div className="border-b border-border pb-3 mb-3">
                  <div className="text-[11px] font-bold text-muted-foreground mb-1">Address</div>
                  <div className="text-[13px] text-foreground font-semibold">
                    {[detail.data.addressLine1, detail.data.city, detail.data.state, detail.data.postalCode]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </div>
                </div>
              )}

              <div className="border-b border-border pb-3 mb-3">
                <div className="text-[11px] font-bold text-muted-foreground mb-1">Allergies</div>
                {summary.isLoading && <div className="text-[13px] text-muted-foreground">Loading…</div>}
                {summary.data && (
                  <div className="text-[13px] text-foreground font-semibold">
                    {summary.data.noKnownAllergies
                      ? "No known allergies"
                      : summary.data.allergies.length === 0
                        ? "Not recorded"
                        : summary.data.allergies
                            .map((a) => `${a.allergen} (${toLabel(a.severity)})`)
                            .join(", ")}
                  </div>
                )}
              </div>

              <div className="pb-3 mb-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[11px] font-bold text-muted-foreground">Insurance</div>
                  <button
                    onClick={() => setInsuranceId(selected.id)}
                    disabled={eligibility.isFetching}
                    className="flex items-center gap-1 px-2 py-1 bg-muted border border-border rounded-md text-[10px] font-bold text-foreground cursor-pointer disabled:opacity-60"
                  >
                    <ShieldCheck size={10} /> {eligibility.isFetching ? "Checking…" : "Verify"}
                  </button>
                </div>
                {eligibility.data ? (
                  <div className="text-[13px] text-foreground font-semibold">
                    <div>{eligibility.data.insurer ?? "No active coverage"}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {eligibility.data.plan ?? ""} · {eligibility.data.status}
                      {eligibility.data.copayMinor !== undefined ? ` · copay ${money(eligibility.data.copayMinor)}` : ""}
                    </div>
                  </div>
                ) : (
                  <div className="text-[13px] text-muted-foreground">
                    {eligibility.isError ? errorMessage(eligibility.error) : "Not verified"}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
