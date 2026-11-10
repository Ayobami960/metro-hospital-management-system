import crypto from "node:crypto";
import { argon2id, argon2Verify } from "hash-wasm";

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
  iterations: 2,
  memorySize: 19_456,
  parallelism: 1,
  hashLength: 32,
  outputType: "encoded",
} as const;

export const hashSecret = (plain: string): Promise<string> =>
  argon2id({ ...ARGON_OPTIONS, password: plain, salt: crypto.randomBytes(16) });

export const verifySecret = async (hash: string, plain: string): Promise<boolean> => {
  try {
    return await argon2Verify({ hash, password: plain });
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
