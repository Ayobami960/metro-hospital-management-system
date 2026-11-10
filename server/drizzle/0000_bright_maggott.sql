CREATE TYPE "hms"."acuity" AS ENUM('STABLE', 'MONITORING', 'CRITICAL', 'DISCHARGE_READY');--> statement-breakpoint
CREATE TYPE "hms"."admission_status" AS ENUM('ACTIVE', 'DISCHARGED', 'TRANSFERRED');--> statement-breakpoint
CREATE TYPE "hms"."allergen_source" AS ENUM('PATIENT_REPORTED', 'CLINICIAN', 'PHARMACY', 'IMPORTED');--> statement-breakpoint
CREATE TYPE "hms"."allergy_severity" AS ENUM('MILD', 'MODERATE', 'SEVERE', 'LIFE_THREATENING');--> statement-breakpoint
CREATE TYPE "hms"."allergy_status" AS ENUM('ACTIVE', 'INACTIVE', 'ENTERED_IN_ERROR');--> statement-breakpoint
CREATE TYPE "hms"."appointment_mode" AS ENUM('IN_PERSON', 'VIRTUAL');--> statement-breakpoint
CREATE TYPE "hms"."appointment_status" AS ENUM('REQUESTED', 'SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED');--> statement-breakpoint
CREATE TYPE "hms"."audit_level" AS ENUM('INFO', 'WARNING', 'DANGER', 'SUCCESS');--> statement-breakpoint
CREATE TYPE "hms"."bed_status" AS ENUM('AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE', 'CLEANING');--> statement-breakpoint
CREATE TYPE "hms"."blood_type" AS ENUM('A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "hms"."claim_status" AS ENUM('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PARTIALLY_APPROVED', 'DENIED', 'APPEALED');--> statement-breakpoint
CREATE TYPE "hms"."conversation_type" AS ENUM('DIRECT', 'CARE_TEAM');--> statement-breakpoint
CREATE TYPE "hms"."email_purpose" AS ENUM('INVITE', 'PASSWORD_RESET', 'WELCOME', 'BILLING_REMINDER', 'DAILY_CODE');--> statement-breakpoint
CREATE TYPE "hms"."encounter_status" AS ENUM('PLANNED', 'ARRIVED', 'IN_PROGRESS', 'ON_HOLD', 'FINISHED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "hms"."encounter_type" AS ENUM('OUTPATIENT', 'INPATIENT', 'EMERGENCY', 'TELEHEALTH');--> statement-breakpoint
CREATE TYPE "hms"."equipment_status" AS ENUM('OPERATIONAL', 'MAINTENANCE_DUE', 'OUT_OF_SERVICE');--> statement-breakpoint
CREATE TYPE "hms"."file_owner_type" AS ENUM('PATIENT', 'ENCOUNTER', 'MESSAGE', 'RADIOLOGY', 'REPORT', 'INVOICE', 'AVATAR');--> statement-breakpoint
CREATE TYPE "hms"."installment_status" AS ENUM('PENDING', 'PAID', 'LATE', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "hms"."interaction_severity" AS ENUM('MINOR', 'MODERATE', 'MAJOR', 'CONTRAINDICATED');--> statement-breakpoint
CREATE TYPE "hms"."invoice_status" AS ENUM('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID', 'DISPUTED');--> statement-breakpoint
CREATE TYPE "hms"."lab_flag" AS ENUM('NORMAL', 'HIGH', 'LOW', 'CRITICAL_HIGH', 'CRITICAL_LOW');--> statement-breakpoint
CREATE TYPE "hms"."lab_order_status" AS ENUM('PENDING', 'COLLECTED', 'IN_PROGRESS', 'RESULTED', 'RELEASED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "hms"."med_admin_status" AS ENUM('DUE', 'GIVEN', 'HELD', 'REFUSED', 'MISSED');--> statement-breakpoint
CREATE TYPE "hms"."med_route" AS ENUM('PO', 'IV', 'SQ', 'IM', 'TOPICAL', 'INHALED', 'RECTAL', 'OPHTHALMIC');--> statement-breakpoint
CREATE TYPE "hms"."metric_type" AS ENUM('STEPS', 'WEIGHT', 'BLOOD_PRESSURE', 'HEART_RATE', 'GLUCOSE', 'SLEEP');--> statement-breakpoint
CREATE TYPE "hms"."note_status" AS ENUM('DRAFT', 'SIGNED', 'AMENDED');--> statement-breakpoint
CREATE TYPE "hms"."note_type" AS ENUM('SOAP', 'DAR', 'NARRATIVE', 'PROGRESS', 'CONSULT');--> statement-breakpoint
CREATE TYPE "hms"."notification_channel" AS ENUM('IN_APP', 'EMAIL', 'SMS');--> statement-breakpoint
CREATE TYPE "hms"."patient_status" AS ENUM('ACTIVE', 'INACTIVE', 'DECEASED', 'MERGED');--> statement-breakpoint
CREATE TYPE "hms"."payment_kind" AS ENUM('PAYMENT', 'REFUND', 'VOID');--> statement-breakpoint
CREATE TYPE "hms"."payment_method" AS ENUM('CASH', 'CHECK', 'CARD', 'INSURANCE', 'TRANSFER');--> statement-breakpoint
CREATE TYPE "hms"."payment_status" AS ENUM('PENDING', 'CLEARED', 'FAILED', 'REFUNDED', 'VOIDED');--> statement-breakpoint
CREATE TYPE "hms"."pharmacy_order_status" AS ENUM('NEW', 'PROCESSING', 'READY', 'DISPENSED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "hms"."plan_status" AS ENUM('ACTIVE', 'COMPLETED', 'DEFAULTED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "hms"."po_status" AS ENUM('DRAFT', 'SUBMITTED', 'SHIPPED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "hms"."prescription_status" AS ENUM('DRAFT', 'SIGNED', 'SENT', 'PARTIALLY_DISPENSED', 'DISPENSED', 'CANCELLED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "hms"."priority" AS ENUM('ROUTINE', 'URGENT', 'STAT');--> statement-breakpoint
CREATE TYPE "hms"."problem_source" AS ENUM('PATIENT_REPORTED', 'CLINICIAN', 'IMPORTED');--> statement-breakpoint
CREATE TYPE "hms"."problem_status" AS ENUM('ACTIVE', 'MONITORING', 'RESOLVED');--> statement-breakpoint
CREATE TYPE "hms"."queue_status" AS ENUM('WAITING', 'CALLED', 'IN_PROGRESS', 'COMPLETED', 'REMOVED');--> statement-breakpoint
CREATE TYPE "hms"."queue_type" AS ENUM('WALK_IN', 'APPOINTMENT');--> statement-breakpoint
CREATE TYPE "hms"."radiology_status" AS ENUM('ORDERED', 'SCHEDULED', 'IN_PROGRESS', 'PENDING_READ', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "hms"."refill_request_status" AS ENUM('REQUESTED', 'APPROVED', 'DENIED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "hms"."relationship_kind" AS ENUM('SPOUSE', 'PARENT', 'CHILD', 'SIBLING', 'GUARDIAN', 'OTHER');--> statement-breakpoint
CREATE TYPE "hms"."room_type" AS ENUM('STANDARD', 'PRIVATE', 'ICU', 'EMERGENCY', 'ISOLATION');--> statement-breakpoint
CREATE TYPE "hms"."sex_at_birth" AS ENUM('MALE', 'FEMALE', 'INTERSEX', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "hms"."specimen_status" AS ENUM('COLLECTED', 'IN_TRANSIT', 'RECEIVED', 'PROCESSING', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "hms"."staff_status" AS ENUM('ACTIVE', 'ON_LEAVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "hms"."stock_movement_reason" AS ENUM('RECEIPT', 'DISPENSE', 'ADJUSTMENT', 'EXPIRY', 'RETURN', 'TRANSFER', 'COUNT_CORRECTION');--> statement-breakpoint
CREATE TYPE "hms"."user_role" AS ENUM('SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'PATIENT', 'RECEPTION', 'PHARMACY', 'LABORATORY', 'BILLING');--> statement-breakpoint
CREATE TYPE "hms"."user_status" AS ENUM('INVITED', 'ACTIVE', 'SUSPENDED', 'LOCKED', 'DEACTIVATED');--> statement-breakpoint
CREATE TABLE "hms"."account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."email_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"email" text NOT NULL,
	"purpose" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."hospital_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"address_line_1" text,
	"city" text,
	"state" text,
	"postal_code" varchar(16),
	"phone" text,
	"email" text,
	"timezone" text NOT NULL,
	"currency" varchar(3) NOT NULL,
	"mrn_prefix" text DEFAULT 'MRN' NOT NULL,
	"invoice_due_days" integer DEFAULT 30 NOT NULL,
	"near_expiry_days" integer DEFAULT 90 NOT NULL,
	"audit_retention_years" integer DEFAULT 7 NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."login_attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"ip" text,
	"success" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."notification_preference" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"appointments" boolean DEFAULT true NOT NULL,
	"lab_results" boolean DEFAULT true NOT NULL,
	"prescriptions" boolean DEFAULT true NOT NULL,
	"bills" boolean DEFAULT true NOT NULL,
	"messages" boolean DEFAULT true NOT NULL,
	"email_channel" boolean DEFAULT true NOT NULL,
	"sms_channel" boolean DEFAULT false NOT NULL,
	"push_channel" boolean DEFAULT false NOT NULL,
	"privacy_share_for_research" boolean DEFAULT false NOT NULL,
	"privacy_share_with_family" boolean DEFAULT false NOT NULL,
	"privacy_analytics" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"device_name" text,
	"mfa_verified_at" timestamp with time zone,
	"mfa_method" text,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoke_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."staff_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text,
	"department_id" uuid,
	"specialty_id" uuid,
	"license_number" text,
	"employee_id" text,
	"ward" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"failed_verification_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" "hms"."user_role" DEFAULT 'PATIENT' NOT NULL,
	"status" "hms"."user_status" DEFAULT 'ACTIVE' NOT NULL,
	"phone" text,
	"hospital_id" text,
	"room_verified_at" timestamp with time zone,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."daily_verification_code" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"role" "hms"."user_role" NOT NULL,
	"code_hash" text NOT NULL,
	"verification_date" date NOT NULL,
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
CREATE TABLE "hms"."email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"purpose" "hms"."email_purpose" NOT NULL,
	"provider" text DEFAULT 'stub' NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."job_lock" (
	"name" text PRIMARY KEY NOT NULL,
	"locked_until" timestamp with time zone NOT NULL,
	"locked_by" text NOT NULL,
	"last_run_at" timestamp with time zone,
	"last_status" text,
	"last_detail" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."staff_invitation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" "hms"."user_role" NOT NULL,
	"hospital_id" text,
	"department_id" uuid,
	"employee_id" text,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"invited_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."analyte_range" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"analyte_id" uuid NOT NULL,
	"sex" "hms"."sex_at_birth",
	"age_min_years" integer DEFAULT 0 NOT NULL,
	"age_max_years" integer DEFAULT 150 NOT NULL,
	"low" numeric(12, 4),
	"high" numeric(12, 4),
	"critical_low" numeric(12, 4),
	"critical_high" numeric(12, 4),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."analyte" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_id" uuid NOT NULL,
	"name" text NOT NULL,
	"unit" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."bed" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"label" text NOT NULL,
	"status" "hms"."bed_status" DEFAULT 'AVAILABLE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."cpt_code" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"description" text NOT NULL,
	"price_minor" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."department" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"floor" text,
	"location" text,
	"head_doctor_id" uuid,
	"bed_capacity" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."doctor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"department_id" uuid,
	"specialty_id" uuid,
	"license_number" text NOT NULL,
	"license_expiry" timestamp with time zone,
	"consultation_fee_minor" integer DEFAULT 0 NOT NULL,
	"status" "hms"."staff_status" DEFAULT 'ACTIVE' NOT NULL,
	"credentials" text,
	"bio" text,
	"rating_avg" numeric(3, 2),
	"rating_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."drug_interaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"drug_a_id" uuid NOT NULL,
	"drug_b_id" uuid NOT NULL,
	"severity" "hms"."interaction_severity" NOT NULL,
	"mechanism" text,
	"management" text,
	"significance" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."drug" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"generic_name" text,
	"strength" text,
	"form" text,
	"unit" text DEFAULT 'tablet' NOT NULL,
	"category" text,
	"ndc" varchar(32),
	"controlled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"model" text,
	"serial" text NOT NULL,
	"location" text,
	"department_id" uuid,
	"last_calibration_at" timestamp with time zone,
	"next_due_at" timestamp with time zone,
	"maintenance_interval_days" integer DEFAULT 180 NOT NULL,
	"out_of_service" boolean DEFAULT false NOT NULL,
	"out_of_service_reason" text,
	"status_override" "hms"."equipment_status",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."icd10_code" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"description" text NOT NULL,
	"category" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."insurance_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"insurer_id" uuid NOT NULL,
	"name" text NOT NULL,
	"plan_type" text,
	"copay_minor" integer DEFAULT 0 NOT NULL,
	"deductible_minor" integer DEFAULT 0 NOT NULL,
	"oop_max_minor" integer DEFAULT 0 NOT NULL,
	"coverage_percent" integer DEFAULT 80 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."insurer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"phone" text,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."lab_test" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"department" text,
	"specimen_type" text DEFAULT 'Blood' NOT NULL,
	"turnaround_hours" integer DEFAULT 24 NOT NULL,
	"is_panel" boolean DEFAULT false NOT NULL,
	"price_minor" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."pharmacy" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"location" text,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."room" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"floor" text NOT NULL,
	"type" "hms"."room_type" DEFAULT 'STANDARD' NOT NULL,
	"department_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."specialty" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."supplier" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"contact_name" text,
	"email" text,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."emergency_contact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"name" text NOT NULL,
	"relationship_kind" "hms"."relationship_kind" NOT NULL,
	"phone" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."patient_allergy" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"allergen" text NOT NULL,
	"reaction" text,
	"severity" "hms"."allergy_severity" DEFAULT 'MODERATE' NOT NULL,
	"status" "hms"."allergy_status" DEFAULT 'ACTIVE' NOT NULL,
	"source" "hms"."allergen_source" DEFAULT 'CLINICIAN' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"onset_date" date,
	"notes" text,
	"verified_by" text,
	"verified_at" timestamp with time zone,
	"recorded_by" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."patient_allergy_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"allergy_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"action" text NOT NULL,
	"snapshot" jsonb,
	"actor_id" text,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."patient_consent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"granted" boolean NOT NULL,
	"recorded_by" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."patient_insurance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"insurer_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"policy_number" text NOT NULL,
	"group_number" text,
	"member_id" text,
	"is_primary" boolean DEFAULT true NOT NULL,
	"effective_from" date,
	"effective_to" date,
	"verification_status" text DEFAULT 'UNVERIFIED' NOT NULL,
	"last_verified_at" timestamp with time zone,
	"last_verification_detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."patient_merge" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_patient_id" uuid NOT NULL,
	"target_patient_id" uuid NOT NULL,
	"reason" text,
	"merged_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."patient_metric" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"type" "hms"."metric_type" NOT NULL,
	"value" numeric(10, 2) NOT NULL,
	"secondary_value" numeric(10, 2),
	"unit" text,
	"source" text DEFAULT 'MANUAL' NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recorded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."doctor_panel" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"doctor_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."patient_problem_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"problem_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"action" text NOT NULL,
	"snapshot" jsonb,
	"actor_id" text,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."patient_problem" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"icd10_id" uuid,
	"diagnosis" text NOT NULL,
	"onset_date" date,
	"status" "hms"."problem_status" DEFAULT 'ACTIVE' NOT NULL,
	"source" "hms"."problem_source" DEFAULT 'CLINICIAN' NOT NULL,
	"managed_by" text,
	"last_reviewed_at" timestamp with time zone,
	"verified_by" text,
	"verified_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"recorded_by" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."patient" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mrn" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"middle_name" text,
	"date_of_birth" date NOT NULL,
	"sex_at_birth" "hms"."sex_at_birth" DEFAULT 'UNKNOWN' NOT NULL,
	"blood_type" "hms"."blood_type" DEFAULT 'UNKNOWN' NOT NULL,
	"phone" text,
	"email" text,
	"address_line_1" text,
	"address_line_2" text,
	"city" text,
	"state" text,
	"postal_code" varchar(16),
	"country" text DEFAULT 'US',
	"height_cm" numeric(5, 1),
	"weight_kg" numeric(5, 1),
	"ssn_last4_enc" text,
	"primary_doctor_id" uuid,
	"status" "hms"."patient_status" DEFAULT 'ACTIVE' NOT NULL,
	"no_known_allergies" boolean DEFAULT false NOT NULL,
	"user_id" text,
	"merged_into_id" uuid,
	"notes" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."appointment_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appointment_id" uuid NOT NULL,
	"from_status" "hms"."appointment_status",
	"to_status" "hms"."appointment_status" NOT NULL,
	"changed_by" text,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."appointment_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"doctor_id" uuid NOT NULL,
	"requested_for" timestamp with time zone NOT NULL,
	"mode" "hms"."appointment_mode" DEFAULT 'IN_PERSON' NOT NULL,
	"reason" text,
	"status" "hms"."appointment_status" DEFAULT 'REQUESTED' NOT NULL,
	"appointment_id" uuid,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."appointment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"doctor_id" uuid NOT NULL,
	"department_id" uuid,
	"room_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"mode" "hms"."appointment_mode" DEFAULT 'IN_PERSON' NOT NULL,
	"type" text DEFAULT 'Consultation' NOT NULL,
	"status" "hms"."appointment_status" DEFAULT 'REQUESTED' NOT NULL,
	"priority" "hms"."priority" DEFAULT 'ROUTINE' NOT NULL,
	"reason" text,
	"symptoms" text,
	"meeting_url" text,
	"requested_by" text,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"cancelled_reason" text,
	"cancelled_at" timestamp with time zone,
	"rescheduled_from_id" uuid,
	"encounter_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."doctor_availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"doctor_id" uuid NOT NULL,
	"weekday" integer NOT NULL,
	"start_minute" integer NOT NULL,
	"end_minute" integer NOT NULL,
	"slot_minutes" integer DEFAULT 30 NOT NULL,
	"break_start_minute" integer,
	"break_end_minute" integer,
	"max_daily_patients" integer DEFAULT 16 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."doctor_rating" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"doctor_id" uuid NOT NULL,
	"patient_id" uuid,
	"rating" integer NOT NULL,
	"comment" text,
	"rated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."doctor_time_off" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"doctor_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."schedule_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"slot_minutes" integer DEFAULT 30 NOT NULL,
	"buffer_minutes" integer DEFAULT 0 NOT NULL,
	"horizon_days" integer DEFAULT 90 NOT NULL,
	"cancel_cutoff_hours" integer DEFAULT 4 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."admission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"encounter_id" uuid,
	"department_id" uuid,
	"attending_doctor_id" uuid,
	"admitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"discharged_at" timestamp with time zone,
	"acuity" "hms"."acuity" DEFAULT 'STABLE' NOT NULL,
	"status" "hms"."admission_status" DEFAULT 'ACTIVE' NOT NULL,
	"discharge_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."bed_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bed_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"admission_id" uuid,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"released_at" timestamp with time zone,
	"assigned_by" text
);
--> statement-breakpoint
CREATE TABLE "hms"."clinical_note" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"encounter_id" uuid,
	"author_id" text NOT NULL,
	"type" "hms"."note_type" DEFAULT 'SOAP' NOT NULL,
	"title" text,
	"content" text NOT NULL,
	"status" "hms"."note_status" DEFAULT 'DRAFT' NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"signed_at" timestamp with time zone,
	"signed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."encounter_diagnosis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"encounter_id" uuid NOT NULL,
	"icd10_id" uuid,
	"description" text NOT NULL,
	"primary" boolean DEFAULT false NOT NULL,
	"status" "hms"."problem_status" DEFAULT 'ACTIVE' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."encounter" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"doctor_id" uuid,
	"appointment_id" uuid,
	"type" "hms"."encounter_type" DEFAULT 'OUTPATIENT' NOT NULL,
	"status" "hms"."encounter_status" DEFAULT 'PLANNED' NOT NULL,
	"chief_complaint" text,
	"disposition" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."medication_administration" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prescription_item_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"status" "hms"."med_admin_status" DEFAULT 'DUE' NOT NULL,
	"administered_at" timestamp with time zone,
	"administered_by" text,
	"hold_reason" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."note_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"content" text NOT NULL,
	"signed_by" text NOT NULL,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"content_hash" text NOT NULL,
	"supersedes_id" uuid,
	"amendment_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."nursing_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nurse_id" text NOT NULL,
	"patient_id" uuid NOT NULL,
	"bed_id" uuid,
	"department_id" uuid,
	"shift_start" timestamp with time zone NOT NULL,
	"shift_end" timestamp with time zone NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"assigned_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."prescription_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prescription_id" uuid NOT NULL,
	"drug_id" uuid NOT NULL,
	"dose" text NOT NULL,
	"frequency" text NOT NULL,
	"route" "hms"."med_route" DEFAULT 'PO' NOT NULL,
	"duration_days" integer,
	"quantity" numeric(10, 2) NOT NULL,
	"unit" text DEFAULT 'tablet' NOT NULL,
	"refills_authorized" integer DEFAULT 0 NOT NULL,
	"refills_used" integer DEFAULT 0 NOT NULL,
	"instructions" text,
	"start_date" date,
	"end_date" date,
	"discontinued_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."prescription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"doctor_id" uuid NOT NULL,
	"encounter_id" uuid,
	"status" "hms"."prescription_status" DEFAULT 'DRAFT' NOT NULL,
	"notes" text,
	"signed_at" timestamp with time zone,
	"signed_by" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."queue_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_number" text NOT NULL,
	"patient_id" uuid NOT NULL,
	"encounter_id" uuid,
	"appointment_id" uuid,
	"department_id" uuid,
	"doctor_id" uuid,
	"room_id" uuid,
	"type" "hms"."queue_type" DEFAULT 'WALK_IN' NOT NULL,
	"priority" "hms"."priority" DEFAULT 'ROUTINE' NOT NULL,
	"status" "hms"."queue_status" DEFAULT 'WAITING' NOT NULL,
	"check_in_at" timestamp with time zone DEFAULT now() NOT NULL,
	"called_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"notes" text,
	"created_by" text,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."queue_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"queue_entry_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"from_status" "hms"."queue_status",
	"to_status" "hms"."queue_status",
	"actor_id" text,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."refill_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prescription_item_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"status" "hms"."refill_request_status" DEFAULT 'REQUESTED' NOT NULL,
	"reason" text,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."signature" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" uuid NOT NULL,
	"signer_id" text NOT NULL,
	"signer_role" text,
	"content_hash" text NOT NULL,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip" text
);
--> statement-breakpoint
CREATE TABLE "hms"."vital" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"encounter_id" uuid,
	"recorded_by" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"systolic" integer,
	"diastolic" integer,
	"heart_rate" integer,
	"temperature_c" numeric(4, 1),
	"respiratory_rate" integer,
	"spo2" integer,
	"weight_kg" numeric(5, 1),
	"height_cm" numeric(5, 1),
	"pain_score" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."dispense_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispense_id" uuid NOT NULL,
	"prescription_item_id" uuid NOT NULL,
	"drug_id" uuid NOT NULL,
	"batch_id" uuid,
	"quantity" integer NOT NULL,
	"unit" text DEFAULT 'tablet' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."dispense" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pharmacy_order_id" uuid NOT NULL,
	"prescription_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"pharmacist_id" text NOT NULL,
	"checklist" jsonb NOT NULL,
	"quantity_override" boolean DEFAULT false NOT NULL,
	"override_reason" text,
	"notes" text,
	"dispensed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."inventory_batch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"batch_number" text NOT NULL,
	"lot_number" text,
	"expiry_date" date NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"supplier_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."inventory_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"drug_id" uuid NOT NULL,
	"unit" text DEFAULT 'tablet' NOT NULL,
	"reorder_level" integer DEFAULT 50 NOT NULL,
	"location" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."pharmacy_order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prescription_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"status" "hms"."pharmacy_order_status" DEFAULT 'NEW' NOT NULL,
	"priority" "hms"."priority" DEFAULT 'ROUTINE' NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_by" text,
	"ready_at" timestamp with time zone,
	"dispensed_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."purchase_order_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"drug_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"unit_cost_minor" integer NOT NULL,
	"received_quantity" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"unit" text,
	"description" text,
	"amount" numeric(12, 2)
);
--> statement-breakpoint
CREATE TABLE "hms"."purchase_order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"po_number" text NOT NULL,
	"supplier_id" uuid NOT NULL,
	"status" "hms"."po_status" DEFAULT 'DRAFT' NOT NULL,
	"ordered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expected_delivery_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"total_minor" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"created_by" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."stock_movement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"batch_id" uuid,
	"delta" integer NOT NULL,
	"reason" "hms"."stock_movement_reason" NOT NULL,
	"reference_type" text,
	"reference_id" uuid,
	"actor_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."critical_value_notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"result_id" uuid NOT NULL,
	"notified_user_id" text NOT NULL,
	"notified_by" text NOT NULL,
	"notified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"method" text DEFAULT 'PHONE' NOT NULL,
	"note" text,
	"acknowledged_at" timestamp with time zone,
	"acknowledged_by" text,
	"acknowledgement_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."equipment_maintenance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"equipment_id" uuid NOT NULL,
	"type" text NOT NULL,
	"technician" text,
	"performed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"result" text,
	"next_due_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."lab_order_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lab_order_id" uuid NOT NULL,
	"test_id" uuid NOT NULL,
	"status" "hms"."lab_order_status" DEFAULT 'PENDING' NOT NULL,
	"assigned_technician_id" text,
	"specimen_id" uuid,
	"price_minor" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."lab_order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"ordering_doctor_id" uuid,
	"encounter_id" uuid,
	"priority" "hms"."priority" DEFAULT 'ROUTINE' NOT NULL,
	"status" "hms"."lab_order_status" DEFAULT 'PENDING' NOT NULL,
	"clinical_notes" text,
	"ordered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"collected_at" timestamp with time zone,
	"resulted_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"cancelled_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."lab_result_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"result_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"value_text" text NOT NULL,
	"value_numeric" numeric(14, 4),
	"flag" "hms"."lab_flag" NOT NULL,
	"content_hash" text NOT NULL,
	"signed_by" text NOT NULL,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reason" text
);
--> statement-breakpoint
CREATE TABLE "hms"."lab_result" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lab_order_item_id" uuid NOT NULL,
	"analyte_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"value_text" text NOT NULL,
	"value_numeric" numeric(14, 4),
	"unit" text,
	"flag" "hms"."lab_flag" DEFAULT 'NORMAL' NOT NULL,
	"critical" boolean DEFAULT false NOT NULL,
	"entered_by" text,
	"entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"released_at" timestamp with time zone,
	"released_by" text,
	"version" integer DEFAULT 1 NOT NULL,
	"amended_from_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."radiology_order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"ordering_doctor_id" uuid,
	"study_type" text NOT NULL,
	"body_part" text NOT NULL,
	"priority" "hms"."priority" DEFAULT 'ROUTINE' NOT NULL,
	"status" "hms"."radiology_status" DEFAULT 'ORDERED' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"performed_at" timestamp with time zone,
	"notes" text,
	"radiologist_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."radiology_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"body" text NOT NULL,
	"impression" text,
	"signed_by" text,
	"signed_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"amended_from_id" uuid,
	"images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."specimen_custody" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"specimen_id" uuid NOT NULL,
	"status" "hms"."specimen_status" NOT NULL,
	"location" text,
	"actor_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."specimen" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"barcode" text NOT NULL,
	"lab_order_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"specimen_type" text DEFAULT 'Blood' NOT NULL,
	"collected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"collected_by" text,
	"status" "hms"."specimen_status" DEFAULT 'COLLECTED' NOT NULL,
	"location" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."claim_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"detail" jsonb,
	"actor_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."insurance_claim" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_number" text NOT NULL,
	"invoice_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"insurer_id" uuid NOT NULL,
	"plan_id" uuid,
	"status" "hms"."claim_status" DEFAULT 'DRAFT' NOT NULL,
	"claimed_minor" integer NOT NULL,
	"approved_minor" integer DEFAULT 0 NOT NULL,
	"submitted_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"denial_reason" text,
	"appeal_deadline" date,
	"external_ref" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."invoice_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"description" text NOT NULL,
	"cpt_id" uuid,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price_minor" integer NOT NULL,
	"total_minor" integer NOT NULL,
	"service_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."invoice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" text NOT NULL,
	"patient_id" uuid NOT NULL,
	"encounter_id" uuid,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" "hms"."invoice_status" DEFAULT 'ISSUED' NOT NULL,
	"subtotal_minor" integer DEFAULT 0 NOT NULL,
	"tax_minor" integer DEFAULT 0 NOT NULL,
	"total_minor" integer DEFAULT 0 NOT NULL,
	"amount_paid_minor" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"void_reason" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."payment_allocation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount_minor" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."payment_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"actor_id" text,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."payment_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"invoice_id" uuid,
	"installment_count" integer NOT NULL,
	"amount_minor" integer NOT NULL,
	"status" "hms"."plan_status" DEFAULT 'ACTIVE' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_number" text NOT NULL,
	"patient_id" uuid NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"method" "hms"."payment_method" NOT NULL,
	"kind" "hms"."payment_kind" DEFAULT 'PAYMENT' NOT NULL,
	"status" "hms"."payment_status" DEFAULT 'CLEARED' NOT NULL,
	"provider" text DEFAULT 'MANUAL' NOT NULL,
	"provider_ref" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"received_by" text,
	"reference" text,
	"reverses_payment_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."plan_installment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"due_date" date NOT NULL,
	"amount_minor" integer NOT NULL,
	"paid_minor" integer DEFAULT 0 NOT NULL,
	"status" "hms"."installment_status" DEFAULT 'PENDING' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"running_balance_minor" numeric(14, 2)
);
--> statement-breakpoint
CREATE TABLE "hms"."conversation_participant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"last_read_at" timestamp with time zone,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."conversation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject" text,
	"type" "hms"."conversation_type" DEFAULT 'DIRECT' NOT NULL,
	"patient_id" uuid,
	"created_by" text,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."message_attachment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"file_id" text NOT NULL,
	"file_name" text,
	"content_type" text,
	"size_bytes" text
);
--> statement-breakpoint
CREATE TABLE "hms"."message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"type" text DEFAULT 'SYSTEM' NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_id" text,
	"actor_role" text,
	"action" text NOT NULL,
	"module" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"level" "hms"."audit_level" DEFAULT 'INFO' NOT NULL,
	"detail" jsonb,
	"ip" text,
	"request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."file" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_type" "hms"."file_owner_type" NOT NULL,
	"owner_id" text,
	"patient_id" uuid,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"provider" text DEFAULT 'CLOUDINARY' NOT NULL,
	"provider_key" text NOT NULL,
	"checksum_sha256" text,
	"url" text,
	"uploaded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "hms"."idempotency_key" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"request_hash" text NOT NULL,
	"response_status" integer,
	"response_body" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hms"."phi_access_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"actor_role" text,
	"patient_id" uuid NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"action" text NOT NULL,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hms"."account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "hms"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."email_token" ADD CONSTRAINT "email_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "hms"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."notification_preference" ADD CONSTRAINT "notification_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "hms"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "hms"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."staff_profile" ADD CONSTRAINT "staff_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "hms"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "hms"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."daily_verification_code" ADD CONSTRAINT "daily_verification_code_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "hms"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."staff_invitation" ADD CONSTRAINT "staff_invitation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "hms"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."staff_invitation" ADD CONSTRAINT "staff_invitation_invited_by_user_id_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "hms"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."analyte_range" ADD CONSTRAINT "analyte_range_analyte_id_analyte_id_fk" FOREIGN KEY ("analyte_id") REFERENCES "hms"."analyte"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."analyte" ADD CONSTRAINT "analyte_test_id_lab_test_id_fk" FOREIGN KEY ("test_id") REFERENCES "hms"."lab_test"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."bed" ADD CONSTRAINT "bed_room_id_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "hms"."room"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."doctor" ADD CONSTRAINT "doctor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "hms"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."doctor" ADD CONSTRAINT "doctor_department_id_department_id_fk" FOREIGN KEY ("department_id") REFERENCES "hms"."department"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."doctor" ADD CONSTRAINT "doctor_specialty_id_specialty_id_fk" FOREIGN KEY ("specialty_id") REFERENCES "hms"."specialty"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."drug_interaction" ADD CONSTRAINT "drug_interaction_drug_a_id_drug_id_fk" FOREIGN KEY ("drug_a_id") REFERENCES "hms"."drug"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."drug_interaction" ADD CONSTRAINT "drug_interaction_drug_b_id_drug_id_fk" FOREIGN KEY ("drug_b_id") REFERENCES "hms"."drug"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."equipment" ADD CONSTRAINT "equipment_department_id_department_id_fk" FOREIGN KEY ("department_id") REFERENCES "hms"."department"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."insurance_plan" ADD CONSTRAINT "insurance_plan_insurer_id_insurer_id_fk" FOREIGN KEY ("insurer_id") REFERENCES "hms"."insurer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."room" ADD CONSTRAINT "room_department_id_department_id_fk" FOREIGN KEY ("department_id") REFERENCES "hms"."department"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."emergency_contact" ADD CONSTRAINT "emergency_contact_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "hms"."patient"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."patient_allergy" ADD CONSTRAINT "patient_allergy_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "hms"."patient"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."patient_allergy_history" ADD CONSTRAINT "patient_allergy_history_allergy_id_patient_allergy_id_fk" FOREIGN KEY ("allergy_id") REFERENCES "hms"."patient_allergy"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."patient_allergy_history" ADD CONSTRAINT "patient_allergy_history_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "hms"."patient"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."patient_consent" ADD CONSTRAINT "patient_consent_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "hms"."patient"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."patient_insurance" ADD CONSTRAINT "patient_insurance_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "hms"."patient"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."patient_insurance" ADD CONSTRAINT "patient_insurance_insurer_id_insurer_id_fk" FOREIGN KEY ("insurer_id") REFERENCES "hms"."insurer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."patient_insurance" ADD CONSTRAINT "patient_insurance_plan_id_insurance_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "hms"."insurance_plan"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."patient_metric" ADD CONSTRAINT "patient_metric_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "hms"."patient"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."doctor_panel" ADD CONSTRAINT "doctor_panel_doctor_id_doctor_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "hms"."doctor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."doctor_panel" ADD CONSTRAINT "doctor_panel_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "hms"."patient"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."patient_problem_history" ADD CONSTRAINT "patient_problem_history_problem_id_patient_problem_id_fk" FOREIGN KEY ("problem_id") REFERENCES "hms"."patient_problem"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."patient_problem_history" ADD CONSTRAINT "patient_problem_history_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "hms"."patient"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."patient_problem" ADD CONSTRAINT "patient_problem_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "hms"."patient"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."patient_problem" ADD CONSTRAINT "patient_problem_icd10_id_icd10_code_id_fk" FOREIGN KEY ("icd10_id") REFERENCES "hms"."icd10_code"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."patient" ADD CONSTRAINT "patient_primary_doctor_id_doctor_id_fk" FOREIGN KEY ("primary_doctor_id") REFERENCES "hms"."doctor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."patient" ADD CONSTRAINT "patient_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "hms"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."appointment_history" ADD CONSTRAINT "appointment_history_appointment_id_appointment_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "hms"."appointment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."appointment_request" ADD CONSTRAINT "appointment_request_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "hms"."patient"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."appointment_request" ADD CONSTRAINT "appointment_request_doctor_id_doctor_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "hms"."doctor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."appointment_request" ADD CONSTRAINT "appointment_request_appointment_id_appointment_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "hms"."appointment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."appointment" ADD CONSTRAINT "appointment_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "hms"."patient"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."appointment" ADD CONSTRAINT "appointment_doctor_id_doctor_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "hms"."doctor"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."appointment" ADD CONSTRAINT "appointment_department_id_department_id_fk" FOREIGN KEY ("department_id") REFERENCES "hms"."department"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."appointment" ADD CONSTRAINT "appointment_room_id_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "hms"."room"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."doctor_availability" ADD CONSTRAINT "doctor_availability_doctor_id_doctor_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "hms"."doctor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."doctor_rating" ADD CONSTRAINT "doctor_rating_doctor_id_doctor_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "hms"."doctor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."doctor_rating" ADD CONSTRAINT "doctor_rating_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "hms"."patient"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."doctor_time_off" ADD CONSTRAINT "doctor_time_off_doctor_id_doctor_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "hms"."doctor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."admission" ADD CONSTRAINT "admission_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "hms"."patient"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."admission" ADD CONSTRAINT "admission_encounter_id_encounter_id_fk" FOREIGN KEY ("encounter_id") REFERENCES "hms"."encounter"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."admission" ADD CONSTRAINT "admission_department_id_department_id_fk" FOREIGN KEY ("department_id") REFERENCES "hms"."department"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."admission" ADD CONSTRAINT "admission_attending_doctor_id_doctor_id_fk" FOREIGN KEY ("attending_doctor_id") REFERENCES "hms"."doctor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."bed_assignment" ADD CONSTRAINT "bed_assignment_bed_id_bed_id_fk" FOREIGN KEY ("bed_id") REFERENCES "hms"."bed"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."bed_assignment" ADD CONSTRAINT "bed_assignment_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "hms"."patient"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."bed_assignment" ADD CONSTRAINT "bed_assignment_admission_id_admission_id_fk" FOREIGN KEY ("admission_id") REFERENCES "hms"."admission"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."clinical_note" ADD CONSTRAINT "clinical_note_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "hms"."patient"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."clinical_note" ADD CONSTRAINT "clinical_note_encounter_id_encounter_id_fk" FOREIGN KEY ("encounter_id") REFERENCES "hms"."encounter"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."clinical_note" ADD CONSTRAINT "clinical_note_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "hms"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."encounter_diagnosis" ADD CONSTRAINT "encounter_diagnosis_encounter_id_encounter_id_fk" FOREIGN KEY ("encounter_id") REFERENCES "hms"."encounter"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."encounter_diagnosis" ADD CONSTRAINT "encounter_diagnosis_icd10_id_icd10_code_id_fk" FOREIGN KEY ("icd10_id") REFERENCES "hms"."icd10_code"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."encounter" ADD CONSTRAINT "encounter_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "hms"."patient"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."encounter" ADD CONSTRAINT "encounter_doctor_id_doctor_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "hms"."doctor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."encounter" ADD CONSTRAINT "encounter_appointment_id_appointment_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "hms"."appointment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."medication_administration" ADD CONSTRAINT "medication_administration_prescription_item_id_prescription_item_id_fk" FOREIGN KEY ("prescription_item_id") REFERENCES "hms"."prescription_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."medication_administration" ADD CONSTRAINT "medication_administration_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "hms"."patient"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."note_version" ADD CONSTRAINT "note_version_note_id_clinical_note_id_fk" FOREIGN KEY ("note_id") REFERENCES "hms"."clinical_note"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."nursing_assignment" ADD CONSTRAINT "nursing_assignment_nurse_id_user_id_fk" FOREIGN KEY ("nurse_id") REFERENCES "hms"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."nursing_assignment" ADD CONSTRAINT "nursing_assignment_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "hms"."patient"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."nursing_assignment" ADD CONSTRAINT "nursing_assignment_bed_id_bed_id_fk" FOREIGN KEY ("bed_id") REFERENCES "hms"."bed"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."nursing_assignment" ADD CONSTRAINT "nursing_assignment_department_id_department_id_fk" FOREIGN KEY ("department_id") REFERENCES "hms"."department"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."prescription_item" ADD CONSTRAINT "prescription_item_prescription_id_prescription_id_fk" FOREIGN KEY ("prescription_id") REFERENCES "hms"."prescription"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."prescription_item" ADD CONSTRAINT "prescription_item_drug_id_drug_id_fk" FOREIGN KEY ("drug_id") REFERENCES "hms"."drug"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."prescription" ADD CONSTRAINT "prescription_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "hms"."patient"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."prescription" ADD CONSTRAINT "prescription_doctor_id_doctor_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "hms"."doctor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."prescription" ADD CONSTRAINT "prescription_encounter_id_encounter_id_fk" FOREIGN KEY ("encounter_id") REFERENCES "hms"."encounter"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."queue_entry" ADD CONSTRAINT "queue_entry_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "hms"."patient"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."queue_entry" ADD CONSTRAINT "queue_entry_encounter_id_encounter_id_fk" FOREIGN KEY ("encounter_id") REFERENCES "hms"."encounter"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."queue_entry" ADD CONSTRAINT "queue_entry_appointment_id_appointment_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "hms"."appointment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."queue_entry" ADD CONSTRAINT "queue_entry_department_id_department_id_fk" FOREIGN KEY ("department_id") REFERENCES "hms"."department"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."queue_entry" ADD CONSTRAINT "queue_entry_doctor_id_doctor_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "hms"."doctor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."queue_entry" ADD CONSTRAINT "queue_entry_room_id_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "hms"."room"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."queue_event" ADD CONSTRAINT "queue_event_queue_entry_id_queue_entry_id_fk" FOREIGN KEY ("queue_entry_id") REFERENCES "hms"."queue_entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."refill_request" ADD CONSTRAINT "refill_request_prescription_item_id_prescription_item_id_fk" FOREIGN KEY ("prescription_item_id") REFERENCES "hms"."prescription_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."refill_request" ADD CONSTRAINT "refill_request_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "hms"."patient"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."vital" ADD CONSTRAINT "vital_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "hms"."patient"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."vital" ADD CONSTRAINT "vital_encounter_id_encounter_id_fk" FOREIGN KEY ("encounter_id") REFERENCES "hms"."encounter"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."dispense_item" ADD CONSTRAINT "dispense_item_dispense_id_dispense_id_fk" FOREIGN KEY ("dispense_id") REFERENCES "hms"."dispense"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."dispense_item" ADD CONSTRAINT "dispense_item_prescription_item_id_prescription_item_id_fk" FOREIGN KEY ("prescription_item_id") REFERENCES "hms"."prescription_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."dispense_item" ADD CONSTRAINT "dispense_item_drug_id_drug_id_fk" FOREIGN KEY ("drug_id") REFERENCES "hms"."drug"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."dispense_item" ADD CONSTRAINT "dispense_item_batch_id_inventory_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "hms"."inventory_batch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."dispense" ADD CONSTRAINT "dispense_pharmacy_order_id_pharmacy_order_id_fk" FOREIGN KEY ("pharmacy_order_id") REFERENCES "hms"."pharmacy_order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."dispense" ADD CONSTRAINT "dispense_prescription_id_prescription_id_fk" FOREIGN KEY ("prescription_id") REFERENCES "hms"."prescription"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."dispense" ADD CONSTRAINT "dispense_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "hms"."patient"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."inventory_batch" ADD CONSTRAINT "inventory_batch_item_id_inventory_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "hms"."inventory_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."inventory_batch" ADD CONSTRAINT "inventory_batch_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "hms"."supplier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."inventory_item" ADD CONSTRAINT "inventory_item_drug_id_drug_id_fk" FOREIGN KEY ("drug_id") REFERENCES "hms"."drug"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."pharmacy_order" ADD CONSTRAINT "pharmacy_order_prescription_id_prescription_id_fk" FOREIGN KEY ("prescription_id") REFERENCES "hms"."prescription"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."pharmacy_order" ADD CONSTRAINT "pharmacy_order_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "hms"."patient"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."purchase_order_item" ADD CONSTRAINT "purchase_order_item_purchase_order_id_purchase_order_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "hms"."purchase_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."purchase_order_item" ADD CONSTRAINT "purchase_order_item_drug_id_drug_id_fk" FOREIGN KEY ("drug_id") REFERENCES "hms"."drug"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."purchase_order" ADD CONSTRAINT "purchase_order_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "hms"."supplier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."stock_movement" ADD CONSTRAINT "stock_movement_item_id_inventory_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "hms"."inventory_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."stock_movement" ADD CONSTRAINT "stock_movement_batch_id_inventory_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "hms"."inventory_batch"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."critical_value_notification" ADD CONSTRAINT "critical_value_notification_result_id_lab_result_id_fk" FOREIGN KEY ("result_id") REFERENCES "hms"."lab_result"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."critical_value_notification" ADD CONSTRAINT "critical_value_notification_notified_user_id_user_id_fk" FOREIGN KEY ("notified_user_id") REFERENCES "hms"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."equipment_maintenance" ADD CONSTRAINT "equipment_maintenance_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "hms"."equipment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."lab_order_item" ADD CONSTRAINT "lab_order_item_lab_order_id_lab_order_id_fk" FOREIGN KEY ("lab_order_id") REFERENCES "hms"."lab_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."lab_order_item" ADD CONSTRAINT "lab_order_item_test_id_lab_test_id_fk" FOREIGN KEY ("test_id") REFERENCES "hms"."lab_test"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."lab_order_item" ADD CONSTRAINT "lab_order_item_assigned_technician_id_user_id_fk" FOREIGN KEY ("assigned_technician_id") REFERENCES "hms"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."lab_order" ADD CONSTRAINT "lab_order_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "hms"."patient"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."lab_order" ADD CONSTRAINT "lab_order_ordering_doctor_id_doctor_id_fk" FOREIGN KEY ("ordering_doctor_id") REFERENCES "hms"."doctor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."lab_result_version" ADD CONSTRAINT "lab_result_version_result_id_lab_result_id_fk" FOREIGN KEY ("result_id") REFERENCES "hms"."lab_result"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."lab_result" ADD CONSTRAINT "lab_result_lab_order_item_id_lab_order_item_id_fk" FOREIGN KEY ("lab_order_item_id") REFERENCES "hms"."lab_order_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."lab_result" ADD CONSTRAINT "lab_result_analyte_id_analyte_id_fk" FOREIGN KEY ("analyte_id") REFERENCES "hms"."analyte"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."lab_result" ADD CONSTRAINT "lab_result_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "hms"."patient"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."radiology_order" ADD CONSTRAINT "radiology_order_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "hms"."patient"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."radiology_order" ADD CONSTRAINT "radiology_order_ordering_doctor_id_doctor_id_fk" FOREIGN KEY ("ordering_doctor_id") REFERENCES "hms"."doctor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."radiology_order" ADD CONSTRAINT "radiology_order_radiologist_id_doctor_id_fk" FOREIGN KEY ("radiologist_id") REFERENCES "hms"."doctor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."radiology_report" ADD CONSTRAINT "radiology_report_order_id_radiology_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "hms"."radiology_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."specimen_custody" ADD CONSTRAINT "specimen_custody_specimen_id_specimen_id_fk" FOREIGN KEY ("specimen_id") REFERENCES "hms"."specimen"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."specimen" ADD CONSTRAINT "specimen_lab_order_id_lab_order_id_fk" FOREIGN KEY ("lab_order_id") REFERENCES "hms"."lab_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."specimen" ADD CONSTRAINT "specimen_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "hms"."patient"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."claim_event" ADD CONSTRAINT "claim_event_claim_id_insurance_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "hms"."insurance_claim"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."insurance_claim" ADD CONSTRAINT "insurance_claim_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "hms"."invoice"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."insurance_claim" ADD CONSTRAINT "insurance_claim_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "hms"."patient"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."insurance_claim" ADD CONSTRAINT "insurance_claim_insurer_id_insurer_id_fk" FOREIGN KEY ("insurer_id") REFERENCES "hms"."insurer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."insurance_claim" ADD CONSTRAINT "insurance_claim_plan_id_insurance_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "hms"."insurance_plan"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."invoice_item" ADD CONSTRAINT "invoice_item_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "hms"."invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."invoice_item" ADD CONSTRAINT "invoice_item_cpt_id_cpt_code_id_fk" FOREIGN KEY ("cpt_id") REFERENCES "hms"."cpt_code"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."invoice" ADD CONSTRAINT "invoice_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "hms"."patient"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."payment_allocation" ADD CONSTRAINT "payment_allocation_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "hms"."payment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."payment_allocation" ADD CONSTRAINT "payment_allocation_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "hms"."invoice"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."payment_event" ADD CONSTRAINT "payment_event_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "hms"."payment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."payment_plan" ADD CONSTRAINT "payment_plan_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "hms"."patient"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."payment_plan" ADD CONSTRAINT "payment_plan_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "hms"."invoice"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."payment" ADD CONSTRAINT "payment_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "hms"."patient"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."plan_installment" ADD CONSTRAINT "plan_installment_plan_id_payment_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "hms"."payment_plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."conversation_participant" ADD CONSTRAINT "conversation_participant_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "hms"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."conversation_participant" ADD CONSTRAINT "conversation_participant_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "hms"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."conversation" ADD CONSTRAINT "conversation_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "hms"."patient"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."message_attachment" ADD CONSTRAINT "message_attachment_message_id_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "hms"."message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."message" ADD CONSTRAINT "message_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "hms"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."message" ADD CONSTRAINT "message_sender_id_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "hms"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "hms"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hms"."file" ADD CONSTRAINT "file_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "hms"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "hms"."account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "email_token_hash_uq" ON "hms"."email_token" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "email_token_email_idx" ON "hms"."email_token" USING btree ("email");--> statement-breakpoint
CREATE INDEX "login_attempt_email_idx" ON "hms"."login_attempt" USING btree ("email","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_pref_user_uq" ON "hms"."notification_preference" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_uq" ON "hms"."session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "hms"."session" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_profile_user_uq" ON "hms"."staff_profile" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_uq" ON "hms"."user" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "user_hospital_id_uq" ON "hms"."user" USING btree ("hospital_id");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_code_user_date_uq" ON "hms"."daily_verification_code" USING btree ("user_id","verification_date");--> statement-breakpoint
CREATE INDEX "daily_code_date_idx" ON "hms"."daily_verification_code" USING btree ("verification_date");--> statement-breakpoint
CREATE INDEX "email_outbox_to_idx" ON "hms"."email_outbox" USING btree ("to");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_invitation_token_uq" ON "hms"."staff_invitation" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "staff_invitation_email_idx" ON "hms"."staff_invitation" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "analyte_range_analyte_idx" ON "hms"."analyte_range" USING btree ("analyte_id");--> statement-breakpoint
CREATE UNIQUE INDEX "analyte_test_name_uq" ON "hms"."analyte" USING btree ("test_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "bed_room_label_uq" ON "hms"."bed" USING btree ("room_id","label");--> statement-breakpoint
CREATE UNIQUE INDEX "cpt_code_uq" ON "hms"."cpt_code" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "department_name_uq" ON "hms"."department" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "doctor_user_uq" ON "hms"."doctor" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "doctor_license_uq" ON "hms"."doctor" USING btree ("license_number");--> statement-breakpoint
CREATE INDEX "doctor_department_idx" ON "hms"."doctor" USING btree ("department_id");--> statement-breakpoint
CREATE UNIQUE INDEX "drug_interaction_pair_uq" ON "hms"."drug_interaction" USING btree ("drug_a_id","drug_b_id");--> statement-breakpoint
CREATE INDEX "drug_name_idx" ON "hms"."drug" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "drug_ndc_uq" ON "hms"."drug" USING btree ("ndc");--> statement-breakpoint
CREATE UNIQUE INDEX "equipment_serial_uq" ON "hms"."equipment" USING btree ("serial");--> statement-breakpoint
CREATE UNIQUE INDEX "icd10_code_uq" ON "hms"."icd10_code" USING btree ("code");--> statement-breakpoint
CREATE INDEX "icd10_desc_idx" ON "hms"."icd10_code" USING btree ("description");--> statement-breakpoint
CREATE INDEX "insurance_plan_insurer_idx" ON "hms"."insurance_plan" USING btree ("insurer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "insurer_name_uq" ON "hms"."insurer" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "lab_test_code_uq" ON "hms"."lab_test" USING btree ("code");--> statement-breakpoint
CREATE INDEX "lab_test_name_idx" ON "hms"."lab_test" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "room_number_uq" ON "hms"."room" USING btree ("number");--> statement-breakpoint
CREATE INDEX "room_floor_idx" ON "hms"."room" USING btree ("floor");--> statement-breakpoint
CREATE UNIQUE INDEX "specialty_name_uq" ON "hms"."specialty" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_name_uq" ON "hms"."supplier" USING btree ("name");--> statement-breakpoint
CREATE INDEX "allergy_patient_idx" ON "hms"."patient_allergy" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "allergy_patient_status_idx" ON "hms"."patient_allergy" USING btree ("patient_id","status");--> statement-breakpoint
CREATE INDEX "allergy_history_idx" ON "hms"."patient_allergy_history" USING btree ("allergy_id","created_at");--> statement-breakpoint
CREATE INDEX "patient_insurance_patient_idx" ON "hms"."patient_insurance" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "metric_patient_type_idx" ON "hms"."patient_metric" USING btree ("patient_id","type","recorded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "doctor_panel_uq" ON "hms"."doctor_panel" USING btree ("doctor_id","patient_id");--> statement-breakpoint
CREATE INDEX "problem_history_idx" ON "hms"."patient_problem_history" USING btree ("problem_id","created_at");--> statement-breakpoint
CREATE INDEX "problem_patient_idx" ON "hms"."patient_problem" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "problem_patient_status_idx" ON "hms"."patient_problem" USING btree ("patient_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "patient_mrn_uq" ON "hms"."patient" USING btree ("mrn");--> statement-breakpoint
CREATE INDEX "patient_name_idx" ON "hms"."patient" USING btree ("last_name","first_name");--> statement-breakpoint
CREATE INDEX "patient_dob_idx" ON "hms"."patient" USING btree ("date_of_birth");--> statement-breakpoint
CREATE INDEX "patient_phone_idx" ON "hms"."patient" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "patient_doctor_idx" ON "hms"."patient" USING btree ("primary_doctor_id");--> statement-breakpoint
CREATE INDEX "appointment_history_appt_idx" ON "hms"."appointment_history" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "appointment_request_doctor_idx" ON "hms"."appointment_request" USING btree ("doctor_id","status");--> statement-breakpoint
CREATE INDEX "appointment_doctor_time_idx" ON "hms"."appointment" USING btree ("doctor_id","starts_at");--> statement-breakpoint
CREATE INDEX "appointment_patient_idx" ON "hms"."appointment" USING btree ("patient_id","starts_at");--> statement-breakpoint
CREATE INDEX "appointment_status_idx" ON "hms"."appointment" USING btree ("status","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "doctor_availability_uq" ON "hms"."doctor_availability" USING btree ("doctor_id","weekday","start_minute");--> statement-breakpoint
CREATE INDEX "doctor_rating_doctor_idx" ON "hms"."doctor_rating" USING btree ("doctor_id");--> statement-breakpoint
CREATE INDEX "admission_patient_idx" ON "hms"."admission" USING btree ("patient_id","admitted_at");--> statement-breakpoint
CREATE INDEX "bed_assignment_bed_idx" ON "hms"."bed_assignment" USING btree ("bed_id","released_at");--> statement-breakpoint
CREATE INDEX "note_patient_idx" ON "hms"."clinical_note" USING btree ("patient_id","created_at");--> statement-breakpoint
CREATE INDEX "encounter_patient_idx" ON "hms"."encounter" USING btree ("patient_id","started_at");--> statement-breakpoint
CREATE INDEX "mar_patient_time_idx" ON "hms"."medication_administration" USING btree ("patient_id","scheduled_for");--> statement-breakpoint
CREATE UNIQUE INDEX "note_version_uq" ON "hms"."note_version" USING btree ("note_id","version");--> statement-breakpoint
CREATE INDEX "nursing_assignment_nurse_idx" ON "hms"."nursing_assignment" USING btree ("nurse_id","active");--> statement-breakpoint
CREATE INDEX "prescription_item_rx_idx" ON "hms"."prescription_item" USING btree ("prescription_id");--> statement-breakpoint
CREATE INDEX "prescription_patient_idx" ON "hms"."prescription" USING btree ("patient_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "queue_ticket_uq" ON "hms"."queue_entry" USING btree ("ticket_number");--> statement-breakpoint
CREATE INDEX "queue_status_idx" ON "hms"."queue_entry" USING btree ("status","priority","check_in_at");--> statement-breakpoint
CREATE INDEX "queue_event_entry_idx" ON "hms"."queue_event" USING btree ("queue_entry_id");--> statement-breakpoint
CREATE INDEX "refill_request_status_idx" ON "hms"."refill_request" USING btree ("status");--> statement-breakpoint
CREATE INDEX "signature_resource_idx" ON "hms"."signature" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "vitals_patient_time_idx" ON "hms"."vital" USING btree ("patient_id","recorded_at");--> statement-breakpoint
CREATE INDEX "dispense_item_dispense_idx" ON "hms"."dispense_item" USING btree ("dispense_id");--> statement-breakpoint
CREATE INDEX "dispense_patient_idx" ON "hms"."dispense" USING btree ("patient_id","dispensed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_batch_uq" ON "hms"."inventory_batch" USING btree ("item_id","batch_number","expiry_date");--> statement-breakpoint
CREATE INDEX "inventory_batch_expiry_idx" ON "hms"."inventory_batch" USING btree ("expiry_date");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_drug_uq" ON "hms"."inventory_item" USING btree ("drug_id");--> statement-breakpoint
CREATE INDEX "pharmacy_order_status_idx" ON "hms"."pharmacy_order" USING btree ("status","received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_order_number_uq" ON "hms"."purchase_order" USING btree ("po_number");--> statement-breakpoint
CREATE INDEX "stock_movement_item_idx" ON "hms"."stock_movement" USING btree ("item_id","created_at");--> statement-breakpoint
CREATE INDEX "critical_notification_result_idx" ON "hms"."critical_value_notification" USING btree ("result_id");--> statement-breakpoint
CREATE INDEX "equipment_maintenance_equipment_idx" ON "hms"."equipment_maintenance" USING btree ("equipment_id");--> statement-breakpoint
CREATE INDEX "lab_order_item_order_idx" ON "hms"."lab_order_item" USING btree ("lab_order_id");--> statement-breakpoint
CREATE INDEX "lab_order_patient_idx" ON "hms"."lab_order" USING btree ("patient_id","ordered_at");--> statement-breakpoint
CREATE INDEX "lab_order_status_idx" ON "hms"."lab_order" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "lab_result_version_uq" ON "hms"."lab_result_version" USING btree ("result_id","version");--> statement-breakpoint
CREATE INDEX "lab_result_item_idx" ON "hms"."lab_result" USING btree ("lab_order_item_id");--> statement-breakpoint
CREATE INDEX "lab_result_patient_idx" ON "hms"."lab_result" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "radiology_patient_idx" ON "hms"."radiology_order" USING btree ("patient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "radiology_report_order_version_uq" ON "hms"."radiology_report" USING btree ("order_id","version");--> statement-breakpoint
CREATE INDEX "specimen_custody_specimen_idx" ON "hms"."specimen_custody" USING btree ("specimen_id");--> statement-breakpoint
CREATE UNIQUE INDEX "specimen_barcode_uq" ON "hms"."specimen" USING btree ("barcode");--> statement-breakpoint
CREATE INDEX "claim_event_claim_idx" ON "hms"."claim_event" USING btree ("claim_id");--> statement-breakpoint
CREATE UNIQUE INDEX "claim_number_uq" ON "hms"."insurance_claim" USING btree ("claim_number");--> statement-breakpoint
CREATE INDEX "claim_status_idx" ON "hms"."insurance_claim" USING btree ("status","submitted_at");--> statement-breakpoint
CREATE INDEX "invoice_item_invoice_idx" ON "hms"."invoice_item" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_number_uq" ON "hms"."invoice" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "invoice_patient_idx" ON "hms"."invoice" USING btree ("patient_id","issued_at");--> statement-breakpoint
CREATE INDEX "invoice_status_idx" ON "hms"."invoice" USING btree ("status","due_at");--> statement-breakpoint
CREATE INDEX "payment_allocation_invoice_idx" ON "hms"."payment_allocation" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_allocation_uq" ON "hms"."payment_allocation" USING btree ("payment_id","invoice_id");--> statement-breakpoint
CREATE INDEX "payment_event_payment_idx" ON "hms"."payment_event" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "payment_plan_patient_idx" ON "hms"."payment_plan" USING btree ("patient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_number_uq" ON "hms"."payment" USING btree ("payment_number");--> statement-breakpoint
CREATE INDEX "payment_patient_idx" ON "hms"."payment" USING btree ("patient_id","received_at");--> statement-breakpoint
CREATE INDEX "plan_installment_plan_idx" ON "hms"."plan_installment" USING btree ("plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_participant_uq" ON "hms"."conversation_participant" USING btree ("conversation_id","user_id");--> statement-breakpoint
CREATE INDEX "conversation_last_message_idx" ON "hms"."conversation" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "message_conversation_idx" ON "hms"."message" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "notification_user_idx" ON "hms"."notification" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "hms"."audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_log_module_idx" ON "hms"."audit_log" USING btree ("module","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "hms"."audit_log" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "file_owner_idx" ON "hms"."file" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idempotency_key_uq" ON "hms"."idempotency_key" USING btree ("scope","key");--> statement-breakpoint
CREATE INDEX "phi_access_patient_idx" ON "hms"."phi_access_log" USING btree ("patient_id","created_at");