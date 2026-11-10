-- The MRN sequence is referenced by the patient services but can be absent in a
-- database whose history predates 0002 (or where the sequence was dropped).
-- Recreate it idempotently and continue after existing MRNs.
CREATE SEQUENCE IF NOT EXISTS "hms"."patient_mrn_seq";--> statement-breakpoint
SELECT setval(
  '"hms"."patient_mrn_seq"'::regclass,
  COALESCE(
    (
      SELECT MAX((regexp_match("mrn", '^MRN-[0-9]{4}-([0-9]{6})$'))[1]::bigint)
      FROM "hms"."patient"
    ),
    0
  ) + 1,
  false
);
