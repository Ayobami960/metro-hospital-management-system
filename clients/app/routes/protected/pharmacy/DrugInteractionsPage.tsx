import { useMemo, useState } from "react";
import { Search, X, AlertTriangle, Info, ShieldAlert, ShieldCheck } from "lucide-react";

import { useDrugs, useInteractionCheck } from "@/hooks/clinical/clinical.hooks";
import type { DrugInteraction } from "@/services/clinical/clinical.api";
import { QueryError } from "@/components/globals/query-state";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { label as toLabel } from "@/lib/format";

type SelectedDrug = { id: string; name: string };

const severityConfig: Record<string, { color: string; bg: string; icon: typeof ShieldAlert; label: string }> = {
  MAJOR: { color: "#dc2626", bg: "#fee2e2", icon: ShieldAlert, label: "Major" },
  MODERATE: { color: "#ca8a04", bg: "#fef9c3", icon: AlertTriangle, label: "Moderate" },
  MINOR: { color: "#2563eb", bg: "#dbeafe", icon: Info, label: "Minor" },
  NONE: { color: "#16a34a", bg: "#dcfce7", icon: ShieldCheck, label: "None" },
};

const pairKey = (a: string, b: string) => [a, b].sort().join("|");

const severityOf = (interaction: DrugInteraction | undefined) =>
  interaction ? interaction.severity.toUpperCase() : "NONE";

export default function DrugInteractionsPage() {
  const [selectedDrugs, setSelectedDrugs] = useState<SelectedDrug[]>([]);
  const [searchVal, setSearchVal] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const drugSearch = useDebouncedValue(searchVal);
  const catalogue = useDrugs(drugSearch || undefined);
  const selectedIds = useMemo(() => selectedDrugs.map((drug) => drug.id), [selectedDrugs]);
  const check = useInteractionCheck(selectedIds);

  const filteredSuggestions = (catalogue.data ?? [])
    .filter((drug) => !selectedIds.includes(drug.id))
    .slice(0, 8);

  const interactionByPair = useMemo(() => {
    const map = new Map<string, DrugInteraction>();
    for (const interaction of check.data ?? []) {
      map.set(pairKey(interaction.drugAId, interaction.drugBId), interaction);
    }
    return map;
  }, [check.data]);

  const lookup = (a: SelectedDrug, b: SelectedDrug) => interactionByPair.get(pairKey(a.id, b.id));

  const addDrug = (drug: SelectedDrug) => {
    if (selectedDrugs.length < 5 && !selectedIds.includes(drug.id)) {
      setSelectedDrugs((prev) => [...prev, drug]);
    }
    setSearchVal("");
    setShowDropdown(false);
  };

  const removeDrug = (drugId: string) => {
    setSelectedDrugs((prev) => prev.filter((drug) => drug.id !== drugId));
  };

  const pairs: Array<{ drug1: SelectedDrug; drug2: SelectedDrug; interaction: DrugInteraction | undefined }> = [];
  for (let i = 0; i < selectedDrugs.length; i++) {
    for (let j = i + 1; j < selectedDrugs.length; j++) {
      pairs.push({
        drug1: selectedDrugs[i],
        drug2: selectedDrugs[j],
        interaction: lookup(selectedDrugs[i], selectedDrugs[j]),
      });
    }
  }

  const countBySeverity = (severity: string) =>
    pairs.filter((pair) => severityOf(pair.interaction) === severity).length;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-[26px] font-extrabold text-foreground mb-1 font-['Plus_Jakarta_Sans',sans-serif]">Drug Interaction Checker</h1>
        <p className="text-muted-foreground text-[15px]">Check for interactions between up to 5 medications simultaneously</p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="text-base font-bold text-foreground mb-3.5 font-['Plus_Jakarta_Sans',sans-serif]">Add Medications</h2>

        <div className="flex flex-wrap gap-2 mb-3">
          {selectedDrugs.map((drug) => (
            <span key={drug.id} className="inline-flex items-center gap-1.5 py-1.5 px-3 bg-blue-100 text-blue-800 rounded-full text-[13px] font-semibold">
              {drug.name}
              <button onClick={() => removeDrug(drug.id)} className="bg-transparent border-none cursor-pointer text-blue-600 p-0 flex">
                <X size={14} />
              </button>
            </span>
          ))}
          {selectedDrugs.length < 5 && (
            <div className="relative">
              <div className="flex items-center gap-1.5 border border-border rounded-full py-1.5 px-3 bg-muted">
                <Search size={14} color="var(--muted-foreground)" />
                <input
                  value={searchVal}
                  onChange={(event) => { setSearchVal(event.target.value); setShowDropdown(true); }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                  placeholder="Add drug..."
                  className="border-none bg-transparent text-[13px] text-foreground outline-none w-[120px]"
                />
              </div>
              {showDropdown && filteredSuggestions.length > 0 && (
                <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-[10px] shadow-lg z-[100] min-w-[200px]">
                  {filteredSuggestions.map((drug) => (
                    <button key={drug.id} onMouseDown={() => addDrug({ id: drug.id, name: drug.name })}
                      className="block w-full py-2.5 px-3.5 border-none bg-transparent text-left text-[13px] text-foreground cursor-pointer font-medium">
                      {drug.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{selectedDrugs.length}/5 medications added</p>
      </div>

      {check.isError && (
        <div className="mt-5">
          <QueryError error={check.error} onRetry={() => void check.refetch()} />
        </div>
      )}

      {selectedDrugs.length >= 2 && (
        <>
          <div className="grid grid-cols-4 gap-4 mt-5 mb-5">
            {[
              { label: "Major", count: countBySeverity("MAJOR"), color: "#dc2626", bg: "#fee2e2" },
              { label: "Moderate", count: countBySeverity("MODERATE"), color: "#ca8a04", bg: "#fef9c3" },
              { label: "Minor", count: countBySeverity("MINOR"), color: "#2563eb", bg: "#dbeafe" },
              { label: "No Interaction", count: countBySeverity("NONE"), color: "#16a34a", bg: "#dcfce7" },
            ].map((stat) => (
              <div key={stat.label} className="bg-card border border-border rounded-2xl p-5 flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: stat.bg }}>
                  <span className="text-lg font-extrabold font-mono" style={{ color: stat.color }}>{stat.count}</span>
                </div>
                <div>
                  <div className="text-[13px] font-bold" style={{ color: stat.color }}>{stat.label}</div>
                  <div className="text-xs text-muted-foreground">interaction{stat.count !== 1 ? "s" : ""}</div>
                </div>
              </div>
            ))}
          </div>

          {selectedDrugs.length >= 3 && (
            <div className="bg-card border border-border rounded-2xl p-6 mb-5 overflow-x-auto">
              <h2 className="text-base font-bold text-foreground mb-4 font-['Plus_Jakarta_Sans',sans-serif]">Interaction Matrix</h2>
              <table className="border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="py-2 px-3 text-muted-foreground"></th>
                    {selectedDrugs.map((drug) => (
                      <th key={drug.id} className="py-2 px-3 font-bold text-foreground whitespace-nowrap">{drug.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selectedDrugs.map((rowDrug) => (
                    <tr key={rowDrug.id}>
                      <td className="py-2 px-3 font-bold text-foreground whitespace-nowrap">{rowDrug.name}</td>
                      {selectedDrugs.map((colDrug) => {
                        if (rowDrug.id === colDrug.id) {
                          return <td key={colDrug.id} className="py-2 px-3 bg-muted rounded-md">—</td>;
                        }
                        const severity = severityOf(lookup(rowDrug, colDrug));
                        const config = severityConfig[severity] ?? severityConfig.NONE;
                        return (
                          <td key={colDrug.id} className="py-2 px-3">
                            <span className="inline-block py-1 px-2.5 rounded-md text-[11px] font-bold whitespace-nowrap" style={{ backgroundColor: config.bg, color: config.color }}>
                              {config.label}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-col gap-4">
            {pairs.map(({ drug1, drug2, interaction }) => {
              const severity = severityOf(interaction);
              const config = severityConfig[severity] ?? severityConfig.NONE;
              const Icon = config.icon;
              return (
                <div key={`${drug1.id}-${drug2.id}`} className="bg-card border border-border rounded-2xl p-6" style={{ borderLeft: `4px solid ${config.color}` }}>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center" style={{ backgroundColor: config.bg }}>
                        <Icon size={18} color={config.color} />
                      </div>
                      <div>
                        <div className="text-[15px] font-bold text-foreground font-['Plus_Jakarta_Sans',sans-serif]">
                          {drug1.name} + {drug2.name}
                        </div>
                        <span className="text-[11px] font-bold px-2.5 py-[3px] rounded-full" style={{ backgroundColor: config.bg, color: config.color }}>
                          {toLabel(severity)} Interaction
                        </span>
                      </div>
                    </div>
                  </div>
                  {interaction ? (
                    <div className="flex flex-col gap-2.5">
                      {interaction.mechanism && (
                        <div>
                          <div className="text-xs font-bold text-muted-foreground mb-1 uppercase tracking-wide">Mechanism</div>
                          <p className="text-[13px] text-foreground leading-relaxed m-0">{interaction.mechanism}</p>
                        </div>
                      )}
                      <div className="rounded-[10px] py-3 px-3.5" style={{ backgroundColor: config.bg }}>
                        <div className="text-xs font-bold mb-1 uppercase tracking-wide" style={{ color: config.color }}>Management</div>
                        <p className="text-[13px] text-foreground leading-relaxed m-0">
                          {interaction.management ?? "No management guidance is recorded for this interaction."}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[13px] text-muted-foreground m-0">
                      {check.isLoading
                        ? "Checking this combination…"
                        : "No clinically significant interaction known between these two medications. Continue to monitor for unexpected effects."}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {selectedDrugs.length < 2 && (
        <div className="bg-card border border-border rounded-2xl p-12 mt-5 text-center">
          <Search size={40} color="var(--muted-foreground)" className="mb-4" />
          <div className="text-base font-bold text-foreground mb-2">Add at least 2 medications to check interactions</div>
          <div className="text-sm text-muted-foreground">Search and select drugs from the input above to see their interaction profile.</div>
        </div>
      )}
    </div>
  );
}
