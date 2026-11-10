import { createTransport, type Transporter } from "nodemailer";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { emailOutbox } from "../db/schema/security.js";
import type { emailPurpose } from "../db/schema/enums.js";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

export type MailPurpose = (typeof emailPurpose.enumValues)[number];

export interface MailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  purpose: MailPurpose;
}

let transporter: Transporter | null = null;

const smtpTransport = (): Transporter => {
  if (!transporter) {
    transporter = createTransport({
      host: env.email.smtpHost,
      port: env.email.smtpPort,
      secure: env.email.smtpSecure,
      auth:
        env.email.smtpUser && env.email.smtpPass
          ? { user: env.email.smtpUser, pass: env.email.smtpPass }
          : undefined,
    });
  }
  return transporter;
};

const deliver = async (input: MailInput): Promise<void> => {
  switch (env.email.provider) {
    case "smtp": {
      if (!env.email.smtpHost) throw new Error("SMTP_HOST is not configured");
      await smtpTransport().sendMail({
        from: env.email.from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      });
      return;
    }
    case "resend": {
      if (!env.email.resendApiKey) throw new Error("RESEND_API_KEY is not configured");
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.email.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env.email.from,
          to: [input.to],
          subject: input.subject,
          text: input.text,
          html: input.html,
        }),
      });
      if (!response.ok) throw new Error(`Resend responded ${response.status}`);
      return;
    }
    default: {
      // Stub provider: the message is captured in hms.email_outbox only. The
      // body is deliberately not logged — it can carry a login secret.
      logger.info(
        { to: input.to, purpose: input.purpose, provider: "stub" },
        "mail captured by stub provider",
      );
    }
  }
};

/**
 * Sends mail and records delivery. Returns false instead of throwing so the
 * caller can persist a per-recipient delivery status and retry later.
 *
 * Verification-code bodies are redacted in the outbox: the plaintext code must
 * not be stored anywhere other than the recipient's inbox.
 */
const REDACTED_PURPOSES: ReadonlySet<MailPurpose> = new Set([
  "DAILY_CODE",
  "EMAIL_VERIFICATION",
  "PATIENT_LOGIN",
  "ADMIN_2FA",
]);

export const sendEmail = async (input: MailInput): Promise<boolean> => {
  const storedBody = REDACTED_PURPOSES.has(input.purpose)
    ? "[redacted: one-time verification code]"
    : input.purpose === "INVITE"
      ? "[redacted: single-use invitation link]"
      : input.text;
  const [row] = await db
    .insert(emailOutbox)
    .values({
      to: input.to,
      subject: input.subject,
      body: storedBody,
      purpose: input.purpose,
      provider: env.email.provider,
    })
    .returning({ id: emailOutbox.id });
  if (!row) throw new Error("Email outbox insert failed");

  try {
    await deliver(input);
    await db.update(emailOutbox).set({ sentAt: new Date() }).where(eq(emailOutbox.id, row.id));
    return true;
  } catch (error) {
    logger.error({ err: error, purpose: input.purpose }, "mail delivery failed");
    return false;
  }
};
