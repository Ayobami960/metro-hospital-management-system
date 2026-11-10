-- Self-registration and expanded staff management fields.
ALTER TABLE "hms"."patient" ADD COLUMN IF NOT EXISTS "gender" text;--> statement-breakpoint
ALTER TABLE "hms"."patient_insurance" ALTER COLUMN "insurer_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "hms"."patient_insurance" ALTER COLUMN "plan_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "hms"."patient_insurance" ADD COLUMN IF NOT EXISTS "provider_name" text;--> statement-breakpoint
ALTER TABLE "hms"."patient_insurance" ADD COLUMN IF NOT EXISTS "plan_name" text;--> statement-breakpoint
-- The staff profile already stores department/specialty ids; add the FK the
-- original baseline omitted so deleting a reference record cannot orphan them.
DO $$
BEGIN
  ALTER TABLE "hms"."staff_profile"
    ADD CONSTRAINT "staff_profile_department_id_department_id_fk"
    FOREIGN KEY ("department_id") REFERENCES "hms"."department"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "hms"."staff_profile"
    ADD CONSTRAINT "staff_profile_specialty_id_specialty_id_fk"
    FOREIGN KEY ("specialty_id") REFERENCES "hms"."specialty"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
