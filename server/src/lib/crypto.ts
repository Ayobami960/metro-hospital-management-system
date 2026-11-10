import crypto from "node:crypto";
import { env } from "../config/env.js";

const DEV_KEY = Buffer.alloc(32, 7);

const key = (): Buffer => {
  if (!env.fieldEncryptionKey) {
    if (env.isProduction) throw new Error("FIELD_ENCRYPTION_KEY missing");
    return DEV_KEY;
  }
  const buf = Buffer.from(env.fieldEncryptionKey, "base64");
  if (buf.length !== 32) throw new Error("FIELD_ENCRYPTION_KEY must be 32 bytes (base64)");
  return buf;
};

/** AES-256-GCM: `iv.tag.ciphertext`, base64url. Used for SSN last-4 and similar fields. */
export const encryptField = (plain: string): string => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
};

export const decryptField = (payload: string | null): string | null => {
  if (!payload) return null;
  const [ivPart, tagPart, dataPart] = payload.split(".");
  if (!ivPart || !tagPart || !dataPart) return null;
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(ivPart, "base64url"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(dataPart, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
};

export const maskSsn = (last4: string | null): string | null => (last4 ? `***-**-${last4}` : null);

export const sha256 = (value: string): string =>
  crypto.createHash("sha256").update(value).digest("hex");

export const randomToken = (bytes = 32): string => crypto.randomBytes(bytes).toString("base64url");

export const timingSafeEqual = (a: string, b: string): boolean => {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
};

export const initials = (name: string): string =>
  name
    .replace(/^(Dr|Mr|Mrs|Ms|Prof)\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
