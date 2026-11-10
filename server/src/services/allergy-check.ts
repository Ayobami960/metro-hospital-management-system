import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import { patientAllergies } from "../db/schema/patients.js";
import { drugs } from "../db/schema/reference.js";

/** Cross-reactivity groups: allergen label -> drug-name fragments. */
const ALLERGEN_CLASSES: Record<string, string[]> = {
  penicillin: ["penicillin", "amoxicillin", "ampicillin", "piperacillin", "nafcillin", "oxacillin", "dicloxacillin"],
  penicillins: ["penicillin", "amoxicillin", "ampicillin", "piperacillin", "nafcillin", "oxacillin", "dicloxacillin"],
  cephalosporin: ["cephalexin", "cefazolin", "ceftriaxone", "cefuroxime", "cefdinir", "cefepime"],
  cephalosporins: ["cephalexin", "cefazolin", "ceftriaxone", "cefuroxime", "cefdinir", "cefepime"],
  sulfa: ["sulfamethoxazole", "sulfasalazine", "sulfadiazine"],
  sulfonamides: ["sulfamethoxazole", "sulfasalazine", "sulfadiazine"],
  nsaid: ["ibuprofen", "naproxen", "diclofenac", "ketorolac", "indomethacin", "celecoxib"],
  nsaids: ["ibuprofen", "naproxen", "diclofenac", "ketorolac", "indomethacin", "celecoxib"],
  opioid: ["morphine", "codeine", "oxycodone", "hydrocodone", "fentanyl", "tramadol"],
  opioids: ["morphine", "codeine", "oxycodone", "hydrocodone", "fentanyl", "tramadol"],
  aspirin: ["aspirin", "acetylsalicylic"],
  latex: ["latex"],
};

const BLOCKING = new Set(["SEVERE", "LIFE_THREATENING"]);

export const normalizeAllergen = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export interface AllergyConflict {
  allergyId: string;
  allergen: string;
  severity: "MILD" | "MODERATE" | "SEVERE" | "LIFE_THREATENING";
  reaction: string | null;
  drugId: string;
  drugName: string;
  blocking: boolean;
  verified: boolean;
}

export const allergenMatchesDrug = (allergen: string, drugName: string, genericName?: string | null): boolean => {
  const haystack = normalizeAllergen(`${drugName} ${genericName ?? ""}`);
  const needle = normalizeAllergen(allergen);
  if (!needle) return false;

  const terms = new Set<string>([needle]);
  for (const fragment of ALLERGEN_CLASSES[needle] ?? []) terms.add(fragment);

  for (const term of terms) {
    if (term.length < 3) continue;
    const pattern = new RegExp(`(^|\\s)${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|\\s)`);
    if (pattern.test(haystack) || haystack.includes(term)) return true;
  }
  return false;
};

/**
 * Called at prescribe and dispense time. Only ACTIVE rows participate; an
 * `ENTERED_IN_ERROR` retraction must never block a prescription.
 */
export const findDrugAllergyConflicts = async (
  patientId: string,
  drugIds: string[],
  tx: Pick<typeof db, "select"> = db,
): Promise<AllergyConflict[]> => {
  if (drugIds.length === 0) return [];
  const [allergies, medicationRows] = await Promise.all([
    tx
      .select()
      .from(patientAllergies)
      .where(and(eq(patientAllergies.patientId, patientId), eq(patientAllergies.status, "ACTIVE"))),
    tx.select().from(drugs).where(inArray(drugs.id, drugIds)),
  ]);

  const conflicts: AllergyConflict[] = [];
  for (const allergy of allergies) {
    for (const drug of medicationRows) {
      if (!allergenMatchesDrug(allergy.allergen, drug.name, drug.genericName)) continue;
      conflicts.push({
        allergyId: allergy.id,
        allergen: allergy.allergen,
        severity: allergy.severity,
        reaction: allergy.reaction,
        drugId: drug.id,
        drugName: drug.name,
        blocking: BLOCKING.has(allergy.severity),
        verified: Boolean(allergy.verifiedAt),
      });
    }
  }
  return conflicts;
};

export const blockingConflicts = (conflicts: AllergyConflict[]): AllergyConflict[] =>
  conflicts.filter((conflict) => conflict.blocking);

export const summarizeConflicts = (conflicts: AllergyConflict[]) => ({
  total: conflicts.length,
  blocking: conflicts.filter((c) => c.blocking).length,
  warning: conflicts.filter((c) => !c.blocking).length,
  requiresOverride: conflicts.some((c) => c.blocking),
  conflicts,
});
