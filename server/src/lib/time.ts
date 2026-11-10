import { env } from "../config/env.js";

export const now = (): Date => new Date();

/** Age in whole years from a DOB, evaluated at `at`. */
export const ageFromDob = (dob: Date | string, at: Date = new Date()): number => {
  const d = typeof dob === "string" ? new Date(dob) : dob;
  let age = at.getUTCFullYear() - d.getUTCFullYear();
  const m = at.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && at.getUTCDate() < d.getUTCDate())) age -= 1;
  return Math.max(0, age);
};

export const bmi = (weightKg: number | null, heightCm: number | null): number | null => {
  if (!weightKg || !heightCm) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
};

/** Wall-clock offset (ms) of `timeZone` at instant `at`. */
const tzOffsetMs = (timeZone: string, at: Date): number => {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(at).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour === "24" ? "00" : parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - at.getTime();
};

/** UTC instant for local midnight of `date` in the clinic timezone. */
export const startOfClinicDay = (date: Date, timeZone = env.clinicTimezone): Date => {
  const offset = tzOffsetMs(timeZone, date);
  const shifted = new Date(date.getTime() + offset);
  const wall = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  return new Date(wall - offset);
};

export const addDays = (date: Date, days: number): Date =>
  new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

export const clinicDayRange = (date: Date = new Date(), timeZone = env.clinicTimezone) => {
  const start = startOfClinicDay(date, timeZone);
  return { start, end: addDays(start, 1) };
};

export const minutesBetween = (from: Date, to: Date = new Date()): number =>
  Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000));

export const daysBetween = (from: Date, to: Date = new Date()): number =>
  Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000));

/** "Today" as YYYY-MM-DD in the clinic timezone. */
export const clinicDateString = (date: Date = new Date(), timeZone = env.clinicTimezone): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
