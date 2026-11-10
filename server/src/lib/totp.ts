import * as OTPAuth from "otpauth";
import { env } from "../config/env.js";
import { decryptField } from "./crypto.js";

/**
 * TOTP (RFC 6238) helpers. The shared secret is stored encrypted with
 * FIELD_ENCRYPTION_KEY; only the enrollment response carries it in plaintext,
 * once, so the authenticator app can register it.
 */

export const createTotpSecret = (): string => new OTPAuth.Secret({ size: 20 }).base32;

const buildTotp = (secretBase32: string, label: string): OTPAuth.TOTP =>
  new OTPAuth.TOTP({
    issuer: env.auth.totp.issuer,
    label,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });

export const totpEnrollmentUri = (secretBase32: string, email: string): string =>
  buildTotp(secretBase32, email).toString();

export const verifyTotpToken = (
  encryptedSecret: string,
  email: string,
  token: string,
): boolean => {
  const secret = decryptField(encryptedSecret);
  if (!secret) return false;
  const digits = token.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(digits)) return false;
  try {
    return (
      buildTotp(secret, email).validate({ token: digits, window: env.auth.totp.window }) !== null
    );
  } catch {
    return false;
  }
};
