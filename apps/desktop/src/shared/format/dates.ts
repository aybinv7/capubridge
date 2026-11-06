const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Android stamps files and apps that came in the system image with 2009-01-01 or earlier. */
const FACTORY_STAMP = Date.UTC(2009, 0, 2);

/** Times before this are an unset clock (the epoch), not a real date. */
const EARLIEST_REAL = Date.UTC(1980, 0, 1);

const dayFormat = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });
const yearFormat = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/**
 * Reads a date the phone printed: `YYYY-MM-DD HH:MM[:SS]` (toybox `ls`, `dumpsys package`) or
 * `Mon DD HH:MM` (busybox, this year). Returns local milliseconds, or `null` when it is missing,
 * unreadable or the epoch.
 */
export function parseDeviceDate(raw: string | null | undefined, now = Date.now()): number | null {
  const text = raw?.trim();
  if (!text) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(text);
  if (iso) {
    const [, y = "", mo = "", d = "", h = "0", mi = "0", s = "0"] = iso;
    const time = new Date(+y, +mo - 1, +d, +h, +mi, +s).getTime();
    return Number.isFinite(time) && time >= EARLIEST_REAL ? time : null;
  }
  const short = /^([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{1,2}):(\d{2})$/.exec(text);
  if (short) {
    const [, name = "", day = "", hour = "", minute = ""] = short;
    const month = MONTHS.indexOf(name);
    if (month < 0) return null;
    const year = new Date(now).getFullYear();
    return new Date(year, month, +day, +hour, +minute).getTime();
  }
  return null;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** A date in words: "Today at 13:46", "Yesterday at 09:10", "3 Nov", or "3 Nov 2024". */
export function formatDateWords(time: number, now = Date.now()): string {
  const date = new Date(time);
  const today = new Date(now);
  const yesterday = new Date(now - 86_400_000);
  if (sameDay(date, today)) return `Today at ${timeFormat.format(date)}`;
  if (sameDay(date, yesterday)) return `Yesterday at ${timeFormat.format(date)}`;
  return date.getFullYear() === today.getFullYear()
    ? dayFormat.format(date)
    : yearFormat.format(date);
}

/** Whether the phone stamped this with its factory date rather than a real one. */
export function isFactoryDate(time: number): boolean {
  return time < FACTORY_STAMP;
}

/** When an app arrived, in words; apps from the system image "came with the phone". */
export function installDateWords(raw: string | null | undefined, now = Date.now()): string | null {
  const time = parseDeviceDate(raw, now);
  if (time === null) return null;
  return isFactoryDate(time) ? "Came with the phone" : formatDateWords(time, now);
}

/** When the app was last updated, or `null` when that is not after it was installed. */
export function updateDateWords(
  installed: string | null | undefined,
  updated: string | null | undefined,
  now = Date.now(),
): string | null {
  const updatedAt = parseDeviceDate(updated, now);
  if (updatedAt === null) return null;
  const installedAt = parseDeviceDate(installed, now);
  if (installedAt !== null && updatedAt <= installedAt) return null;
  return isFactoryDate(updatedAt) ? null : formatDateWords(updatedAt, now);
}

const exactFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/**
 * A file's time, with the time of day always kept: "Today at 14:05", "Yesterday at 09:12",
 * "3 Nov at 14:05", "3 Nov 2025 at 14:05".
 */
export function formatStampWords(time: number, now = Date.now()): string {
  const date = new Date(time);
  const today = new Date(now);
  const clock = timeFormat.format(date);
  if (sameDay(date, today)) return `Today at ${clock}`;
  if (sameDay(date, new Date(now - 86_400_000))) return `Yesterday at ${clock}`;
  const day = date.getFullYear() === today.getFullYear() ? dayFormat : yearFormat;
  return `${day.format(date)} at ${clock}`;
}

/** The exact time, to the second, for a tooltip. */
export function formatExactTime(time: number): string {
  return exactFormat.format(new Date(time));
}
