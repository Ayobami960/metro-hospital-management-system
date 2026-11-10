import pino from "pino";
import { env } from "../config/env.js";

/** PHI must never reach logs in plain text (decision 14). */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  "*.password",
  "*.passwordHash",
  "*.token",
  "*.ssn",
  "*.ssnLast4",
  "*.ssnLast4Enc",
  "*.cardNumber",
  "*.cvv",
  "*.totpSecret",
  "*.secret",
  "*.dateOfBirth",
  "*.firstName",
  "*.lastName",
  "*.email",
  "*.phone",
  "*.address",
  "*.notes",
  "*.content",
  "*.result",
];

export const logger = pino({
  // The test runner sets LOG_LEVEL=silent; allowing an override makes a failing
  // integration test debuggable without changing code.
  level: env.logLevel,
  redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
  base: { service: "hms-api", env: env.nodeEnv },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export type Logger = typeof logger;
