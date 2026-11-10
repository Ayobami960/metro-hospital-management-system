ALTER TABLE "hms"."patient_insurance" ALTER COLUMN "insurer_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "hms"."patient_insurance" ALTER COLUMN "plan_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "hms"."patient_insurance" ADD COLUMN IF NOT EXISTS "provider_name" text;--> statement-breakpoint
ALTER TABLE "hms"."patient_insurance" ADD COLUMN IF NOT EXISTS "plan_name" text;--> statement-breakpoint
ALTER TABLE "hms"."patient" ADD COLUMN IF NOT EXISTS "gender" text;