import { randomBytes } from "node:crypto";

/**
 * Human-readable, collision-resistant document numbers (invoice, payment,
 * claim, purchase order, specimen barcode).
 *
 * The schema has no sequences for these yet, so the suffix is derived from
 * crypto-random bytes rather than a counter: two concurrent requests can never
 * produce the same number, and no DDL is needed to add a document type. When
 * the sequences are added (see docs/gap-analysis.md), only this helper changes.
 */
const ALPHABET = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export const referenceNumber = (prefix: string): string => {
  const bytes = randomBytes(6);
  let suffix = "";
  for (const byte of bytes) suffix += ALPHABET[byte % ALPHABET.length];
  return `${prefix}-${suffix}`;
};

/** Barcode printed on a specimen label, e.g. `SMP-8F3K2Q-A`. */
export const specimenBarcode = (aliquot = "A"): string =>
  `${referenceNumber("SMP")}-${aliquot}`;
