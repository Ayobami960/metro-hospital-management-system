-- Patient MRNs are generated from this sequence. It was referenced by the
-- patient services but never created by the baseline schema, which made every
-- first-time patient onboarding fail at the MRN allocation step.
CREATE SEQUENCE IF NOT EXISTS "hms"."patient_mrn_seq";--> statement-breakpoint
-- Continue after any MRNs that already exist instead of colliding with them.
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
