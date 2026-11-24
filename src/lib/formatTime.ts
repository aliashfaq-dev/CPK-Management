/**
 * Shared timestamp formatting for the CPK dashboard.
 * Keep UTC explicit so server-rendered records are consistent across browsers
 * and deployment regions. All clock output uses a 12-hour AM/PM cycle.
 */
const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: "UTC",
});

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: "UTC",
});

const timeWithSecondsFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
  timeZone: "UTC",
});

const navbarFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

function asDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatDateTime(value: string | Date): string {
  const date = asDate(value);
  return Number.isNaN(date.getTime()) ? "—" : dateTimeFormatter.format(date).replace(/\b(am|pm)\b/i, (period) => period.toUpperCase());
}

export function formatTime(value: string | Date): string {
  const date = asDate(value);
  return Number.isNaN(date.getTime()) ? "—" : timeFormatter.format(date).replace(/\b(am|pm)\b/i, (period) => period.toUpperCase());
}

export function formatTimeWithSeconds(value: string | Date): string {
  const date = asDate(value);
  return Number.isNaN(date.getTime()) ? "—" : timeWithSecondsFormatter.format(date).replace(/\b(am|pm)\b/i, (period) => period.toUpperCase());
}

export function formatNavbarDateTime(value: string | Date): string {
  const date = asDate(value);
  return Number.isNaN(date.getTime()) ? "—" : navbarFormatter.format(date).replace(/\b(am|pm)\b/i, (period) => period.toUpperCase());
}
