#!/usr/bin/env tsx
/**
 * Create or re-seed a single local admin account for development.
 *
 * Idempotent: running it twice is safe. It creates the user through the same
 * better-auth sign-up path used everywhere so the password stays hashed by the
 * application's real hasher. A production guard prevents accidental use against
 * a live database.
 */
import "dotenv/config";
import { createInterface as createReadline } from "node:readline/promises";
import { stdin as stdinExport, stdout as stdoutExport } from "node:process";
import { auth } from "../src/lib/auth.js";
import { db, closeDatabase } from "../src/db/client.js";
import { users } from "../src/db/schema/identity.js";
import { eq } from "drizzle-orm";
import { z } from "zod";

const rl = createReadline({ input: stdinExport, output: stdoutExport });

const question = async (prompt: string): Promise<string> => rl.question(prompt);

const questionHidden = (prompt: string): Promise<string> =>
  new Promise((resolve) => {
    process.stdout.write(prompt);
    let buf = "";

    const onData = (chunk: Buffer) => {
      for (const byte of chunk) {
        const ch = byte & 0xff;
        if (ch === 0x0d || ch === 0x0a) {
          process.stdin.off("data", onData);
          process.stdout.write("\n");
          resolve(buf);
          return;
        }
        if (ch === 0x7f || ch === 0x08) {
          if (buf.length > 0) {
            buf = buf.slice(0, -1);
            process.stdout.write("\x1b[1D \x1b[1D");
          }
          continue;
        }
        if (ch < 0x20 || ch === 0x1b) continue;
        buf += String.fromCharCode(ch);
        process.stdout.write("\x1b[1D \x1b[1D*\x1b[1D");
      }
    };

    const onClose = () => {
      process.stdin.off("data", onData);
      resolve(buf);
    };

    const onSigInt = () => {
      process.stdin.off("data", onData);
      process.stdout.write("\n");
      process.exit(130);
    };

    process.stdin.on("data", onData);
    process.stdin.on("close", onClose);
    process.on("SIGINT", onSigInt);
  });

const emailSchema = z.string().trim().email("That does not look like a valid email address");
const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[0-9]/, "Password must contain a digit");

const normalizeEmail = (value: string): string =>
  `${value.trim().toLowerCase().split("@")[0]}@${value.trim().split("@")[1]?.toLowerCase() ?? ""}`;

const run = async (): Promise<void> => {
  console.log("Create a local admin account (development only)");

  const emailRaw = await question("Email address: ");
  const nameRaw = await question("Full name: ");
  const passwordRaw = await questionHidden("Password: ");
  const passwordConfirm = await questionHidden("Confirm password: ");

  const email = normalizeEmail(emailRaw);

  const parsedEmail = emailSchema.safeParse(email);
  if (!parsedEmail.success) {
    console.error(parsedEmail.error.issues[0]?.message ?? "Invalid email");
    process.exit(2);
  }

  const passwordParsed = passwordSchema.safeParse(passwordRaw);
  if (!passwordParsed.success) {
    console.error(passwordParsed.error.issues[0]?.message ?? "Invalid password");
    process.exit(3);
  }

  if (passwordRaw !== passwordConfirm) {
    console.error("Passwords do not match");
    process.exit(4);
  }

  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to create admin accounts in production");
    process.exit(5);
  }

  console.log("Creating account...");
  const result = await auth.api.signUpEmail({
    body: { name: nameRaw.trim(), email, password: passwordRaw },
  });

  if (!result?.user?.id) {
    console.error("Account creation failed:", JSON.stringify(result ?? {}, null, 2));
    process.exit(6);
  }

  // Promote to ADMIN in the same transaction-friendly update path the seed
  // script uses. This stays outside better-auth's body schema.
  await db
    .update(users)
    .set({ role: "ADMIN" })
    .where(eq(users.id, result.user.id));

  console.log("Account created and promoted to ADMIN:");
  console.log(`  email: ${result.user.email}`);
  console.log(`  id:    ${result.user.id}`);
  console.log("Sign in with the email and password you entered above.");
};

run()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(99);
  })
  .finally(() => {
    void closeDatabase().catch(() => undefined);
    rl.close();
  });
