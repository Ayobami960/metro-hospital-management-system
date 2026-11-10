import "dotenv/config";
import { z } from "zod";
import { normalizeDatabaseSsl } from "./database-ssl.js";

const bool = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === "boolean" ? v : ["1", "true", "yes"].includes(v.toLowerCase())));

const int = z.coerce.number().int();

const isPostgresDatabaseUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "postgres:" || url.protocol === "postgresql:") &&
      url.hostname.length > 0 &&
      url.pathname.length > 1
    );
  } catch {
    return false;
  }
};

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  PORT: int.positive().default(3000),
  APP_NAME: z.string().min(1),
  HOSPITAL_NAME: z.string().min(1),
  DATABASE_URL: z
    .string()
    .url("DATABASE_URL must be a valid PostgreSQL URL")
    .refine(isPostgresDatabaseUrl, "DATABASE_URL must include a PostgreSQL host and database name"),

  BETTER_AUTH_SECRET: z.string().min(16),
  BETTER_AUTH_URL: z.string().url(),
  FRONTEND_ORIGIN: z.string().min(1),

  CLINIC_TIMEZONE: z.string().min(1),
  DEFAULT_CURRENCY: z.string().length(3),

  FIELD_ENCRYPTION_KEY: z.string().optional(),

  EMAIL_PROVIDER: z.enum(["resend", "smtp", "stub"]),
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: int.positive(),
  SMTP_SECURE: bool,
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().min(1),

  /* Legacy daily batch settings (accepted so existing deployments keep booting). */
  DAILY_CODE_LENGTH: int.min(12).max(16).default(14),
  DAILY_CODE_TTL_MINUTES: int.positive().default(1440),
  DAILY_CODE_MAX_ATTEMPTS: int.min(3).max(10).default(5),
  DAILY_CODE_SEND_HOUR: int.min(0).max(23).default(6),
  DAILY_CODE_RESEND_MAX: int.positive().default(3),
  AUTH_SCHEDULER_ENABLED: bool.default(false),
  AUTH_SCHEDULER_INTERVAL_MS: int.min(10_000).default(60_000),
  AUTH_JOB_LOCK_SECONDS: int.min(30).default(120),
  INVITATION_TTL_HOURS: int.positive().default(24),

  /* Purpose-scoped OTPs (email verification, Room Access, patient login). */
  OTP_TTL_MINUTES: int.positive().default(15),
  OTP_MAX_ATTEMPTS: int.min(3).max(10).default(5),
  OTP_RESEND_COOLDOWN_SECONDS: int.min(15).default(45),
  EMAIL_VERIFICATION_TTL_MINUTES: int.positive().default(60),
  PATIENT_LOGIN_TTL_MINUTES: int.positive().default(10),
  ROOM_ACCESS_SESSION_TTL_MINUTES: int.positive().default(10),

  /* Optional TOTP second factor. */
  TOTP_ISSUER: z.string().optional(),
  TOTP_WINDOW: int.min(0).max(3),
  TOTP_MAX_ATTEMPTS: int.positive(),
  TOTP_LOCK_MINUTES: int.positive(),
  TOTP_RECOVERY_CODE_COUNT: int.min(5).max(20),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_FOLDER: z.string().min(1),
  CLOUDINARY_URL_EXPIRES_SECONDS: int.positive(),

  PAYMENT_PROVIDER: z.enum(["stub", "stripe"]),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  LOG_LEVEL: z.string().min(1),
  TRUST_PROXY: int.min(0),
  RATE_LIMIT_WINDOW_MS: int.positive(),
  RATE_LIMIT_MAX: int.positive(),
  AUTH_RATE_LIMIT_MAX: int.positive(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

const raw = parsed.data;

if (raw.NODE_ENV === "production") {
  if (!raw.FIELD_ENCRYPTION_KEY) throw new Error("FIELD_ENCRYPTION_KEY is required in production");
  if (!raw.CLOUDINARY_CLOUD_NAME || !raw.CLOUDINARY_API_KEY || !raw.CLOUDINARY_API_SECRET) {
    throw new Error("CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET are required in production");
  }
}

/*
 * `sslmode=require` is only a deprecated alias for `verify-full` in
 * pg-connection-string 2.x and becomes weaker in v3/pg9. Normalize it to the
 * explicit spelling in memory so TLS keeps full certificate + hostname
 * verification after the upgrade. The `.env` file is never modified.
 */
const runtimeDatabase = normalizeDatabaseSsl(raw.DATABASE_URL);

export const env = {
  nodeEnv: raw.NODE_ENV,
  isProduction: raw.NODE_ENV === "production",
  isTest: raw.NODE_ENV === "test",
  port: raw.PORT,
  appName: raw.APP_NAME,
  hospitalName: raw.HOSPITAL_NAME,
  databaseUrl: runtimeDatabase.url,
  databaseSsl: {
    runtime: runtimeDatabase.info,
  },
  betterAuthSecret: raw.BETTER_AUTH_SECRET,
  betterAuthUrl: raw.BETTER_AUTH_URL,
  frontendOrigin: raw.FRONTEND_ORIGIN,
  clinicTimezone: raw.CLINIC_TIMEZONE,
  currency: raw.DEFAULT_CURRENCY,
  fieldEncryptionKey: raw.FIELD_ENCRYPTION_KEY,
  email: {
    provider: raw.EMAIL_PROVIDER,
    resendApiKey: raw.RESEND_API_KEY,
    smtpHost: raw.SMTP_HOST,
    smtpPort: raw.SMTP_PORT,
    smtpSecure: raw.SMTP_SECURE,
    smtpUser: raw.SMTP_USER,
    smtpPass: raw.SMTP_PASS,
    from: raw.MAIL_FROM,
  },
  cloudinary: {
    cloudName: raw.CLOUDINARY_CLOUD_NAME,
    apiKey: raw.CLOUDINARY_API_KEY,
    apiSecret: raw.CLOUDINARY_API_SECRET,
    folder: raw.CLOUDINARY_FOLDER,
    urlExpiresSeconds: raw.CLOUDINARY_URL_EXPIRES_SECONDS,
  },
  payments: {
    provider: raw.PAYMENT_PROVIDER,
    stripeSecretKey: raw.STRIPE_SECRET_KEY,
    stripeWebhookSecret: raw.STRIPE_WEBHOOK_SECRET,
  },
  logLevel: raw.LOG_LEVEL,
  trustProxy: raw.TRUST_PROXY,
  rateLimit: {
    windowMs: raw.RATE_LIMIT_WINDOW_MS,
    max: raw.RATE_LIMIT_MAX,
    authMax: raw.AUTH_RATE_LIMIT_MAX,
  },
  auth: {
    dailyCode: {
      length: raw.DAILY_CODE_LENGTH,
      ttlMinutes: raw.DAILY_CODE_TTL_MINUTES,
      maxAttempts: raw.DAILY_CODE_MAX_ATTEMPTS,
      sendHour: raw.DAILY_CODE_SEND_HOUR,
      resendMax: raw.DAILY_CODE_RESEND_MAX,
    },
    scheduler: {
      enabled: raw.AUTH_SCHEDULER_ENABLED,
      intervalMs: raw.AUTH_SCHEDULER_INTERVAL_MS,
      lockSeconds: raw.AUTH_JOB_LOCK_SECONDS,
    },
    invitationTtlHours: raw.INVITATION_TTL_HOURS,
    otp: {
      ttlMinutes: raw.OTP_TTL_MINUTES,
      maxAttempts: raw.OTP_MAX_ATTEMPTS,
      resendCooldownSeconds: raw.OTP_RESEND_COOLDOWN_SECONDS,
      emailVerificationTtlMinutes: raw.EMAIL_VERIFICATION_TTL_MINUTES,
      patientLoginTtlMinutes: raw.PATIENT_LOGIN_TTL_MINUTES,
      roomAccessSessionTtlMinutes: raw.ROOM_ACCESS_SESSION_TTL_MINUTES,
    },
    totp: {
      issuer: raw.TOTP_ISSUER ?? raw.HOSPITAL_NAME,
      window: raw.TOTP_WINDOW,
      maxAttempts: raw.TOTP_MAX_ATTEMPTS,
      lockMinutes: raw.TOTP_LOCK_MINUTES,
      recoveryCodeCount: raw.TOTP_RECOVERY_CODE_COUNT,
    },
  },
} as const;

export type Env = typeof env;