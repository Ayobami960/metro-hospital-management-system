CREATE TYPE "hms"."otp_purpose" AS ENUM('EMAIL_VERIFICATION', 'DAILY_ROOM_ACCESS', 'PATIENT_LOGIN', 'ADMIN_2FA');--> statement-breakpoint
ALTER TYPE "hms"."email_purpose" ADD VALUE 'EMAIL_VERIFICATION';--> statement-breakpoint
ALTER TYPE "hms"."email_purpose" ADD VALUE 'PATIENT_LOGIN';--> statement-breakpoint
ALTER TYPE "hms"."email_purpose" ADD VALUE 'ADMIN_2FA';--> statement-breakpoint
CREATE TABLE "hms"."otp_code" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"purpose" "hms"."otp_purpose" NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"delivery_status" text DEFAULT 'PENDING' NOT NULL,
	"delivery_attempts" integer DEFAULT 0 NOT NULL,
	"last_delivery_error" text,
	"sent_at" timestamp with time zone,
	"last_attempt_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."room_access_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "hms"."user_role" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hms"."user" ADD COLUMN IF NOT EXISTS "email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hms"."user" ADD COLUMN IF NOT EXISTS "onboarding_completed_at" timestamp with time zone;--> statement-breakpoint
-- Existing accounts are already onboarded; only accounts created after this
-- migration must complete the first-login profile form.
UPDATE "hms"."user"
   SET "onboarding_completed_at" = COALESCE("updated_at", "created_at", now())
 WHERE "onboarding_completed_at" IS NULL;--> statement-breakpoint
UPDATE "hms"."user"
   SET "email_verified_at" = COALESCE("created_at", now())
 WHERE "email_verified" = true AND "email_verified_at" IS NULL;--> statement-breakpoint
ALTER TABLE "hms"."otp_code" ADD CONSTRAINT "otp_code_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "hms"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."room_access_session" ADD CONSTRAINT "room_access_session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "hms"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "otp_user_purpose_idx" ON "hms"."otp_code" USING btree ("user_id","purpose","created_at");--> statement-breakpoint
CREATE INDEX "otp_expiry_idx" ON "hms"."otp_code" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "room_access_token_uq" ON "hms"."room_access_session" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "room_access_user_idx" ON "hms"."room_access_session" USING btree ("user_id","created_at");--> statement-breakpoint
