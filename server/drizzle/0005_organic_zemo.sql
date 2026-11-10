CREATE TABLE "hms"."patient_profile_draft" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hms"."patient_profile_draft" ADD CONSTRAINT "patient_profile_draft_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "hms"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "patient_profile_draft_user_uq" ON "hms"."patient_profile_draft" USING btree ("user_id");