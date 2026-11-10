/**
 * Presentation formatters shared by every screen.
 *
 * The API sends money in integer minor units, timestamps as ISO strings and
 * enums in SCREAMING_SNAKE_CASE; these helpers turn them into the labels the
 * existing UI already renders.
 */

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const currencyFormatterCents = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

/** API money is integer minor units; the UI renders dollars. */
export const money = (minor: number | null | undefined, cents = false): string => {
  if (minor === null || minor === undefined) return "—";
  const value = minor / 100;
  return cents ? currencyFormatterCents.format(value) : currencyFormatter.format(value);
};

export const compactMoney = (minor: number | null | undefined): string => {
  if (minor === null || minor === undefined) return "—";
  const value = minor / 100;
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return currencyFormatter.format(value);
};

export const pct = (value: number | null | undefined, digits = 0): string =>
  value === null || value === undefined ? "—" : `${value.toFixed(digits)}%`;

export const number = (value: number | null | undefined): string =>
  value === null || value === undefined ? "—" : value.toLocaleString("en-US");

export const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

/** API timestamps are ISO strings or Date objects depending on the encoder. */
export const formatDate = (value: string | Date | null | undefined): string => {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export const formatTime = (value: string | Date | null | undefined): string => {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};

export const formatDateTime = (value: string | Date | null | undefined): string =>
  value ? `${formatDate(value)} · ${formatTime(value)}` : "—";

export const isoDate = (value: Date = new Date()): string => value.toISOString().slice(0, 10);

/** "3d ago" / "2h ago" relative labels used by feeds and messages. */
export const relativeTime = (value: string | Date | null | undefined): string => {
  if (!value) return "";
  const then = typeof value === "string" ? new Date(value).getTime() : value.getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.round((Date.now() - then) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

/** Map a snake/caps enum from the API to a Title Case label. */
export const label = (value: string | null | undefined): string => {
  if (!value) return "—";
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

/** Age from a date of birth, for rows where the API does not send `age`. */
export const ageFrom = (dateOfBirth: string | null | undefined): string => {
  if (!dateOfBirth) return "—";
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return "—";
  const diff = Date.now() - dob.getTime();
  return String(Math.max(0, Math.floor(diff / (365.25 * 24 * 3600 * 1000))));
};
