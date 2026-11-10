import crypto from "node:crypto";
import argon2 from "argon2";

/**
 * Secret-code primitives shared by the daily email code and TOTP recovery
 * codes. Plaintext never leaves memory: only Argon2id digests are stored.
 */

/** Alphabet without visually ambiguous characters (no I/O/0/1). */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const generateDailyCode = (length: number): string => {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  }
  return out;
};

/** CSPRNG numeric code with a fixed length (leading zeroes preserved). */
export const generateNumericCode = (length: number): string => {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += String(crypto.randomInt(10));
  }
  return out;
};

/** Uppercases and strips separators so "abcd-efgh" matches "ABCDEFGH". */
export const normalizeSecretCode = (value: string): string =>
  value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

const ARGON_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
} as const;

export const hashSecret = (plain: string): Promise<string> => argon2.hash(plain, ARGON_OPTIONS);

export const verifySecret = async (hash: string, plain: string): Promise<boolean> => {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
};

/** Human-readable single-use recovery codes, e.g. `K7QM-3XPZ`. */
export const generateRecoveryCodes = (count: number): string[] =>
  Array.from({ length: count }, () => {
    const raw = generateDailyCode(8);
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  });

export const hashRecoveryCodes = (codes: string[]): Promise<string[]> =>
  Promise.all(codes.map((code) => hashSecret(normalizeSecretCode(code))));

export const parseRecoveryHashes = (raw: string): string[] => {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
};
