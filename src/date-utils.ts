/**
 * Pure calendar math for the date picker. No DOM, no Lit, so it can be unit tested on its own.
 * Months are 1-based (1 = January) everywhere in this module; the JS `Date` 0-based month
 * only appears inside these functions. See docs/pitfalls.md#zero-based-months.
 */

export interface CalendarDate {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

/**
 * Accepts 1 or 2 digit month/day, a 4-digit year, and one separator used consistently:
 * 4/3/2023, 04-03-2023, 4.3.2023, 4 3 2023. Output is always MM/DD/YYYY (see formatDate).
 * The \2 backreference rejects mixed separators like 4/3-2023.
 */
const DATE_PATTERN = /^(\d{1,2})([/.\- ])(\d{1,2})\2(\d{4})$/;

/** Same shape with a 2-digit year, caught separately so the error can say what's wrong. */
const TWO_DIGIT_YEAR_PATTERN = /^(\d{1,2})([/.\- ])(\d{1,2})\2(\d{2})$/;

export type DateProblem = 'format' | 'two-digit-year' | 'month' | 'day';

export type DateValidation =
  | { ok: true; date: CalendarDate }
  | { ok: false; problem: 'format' | 'two-digit-year' | 'month' }
  /** `year` and `month` are included so the message can say "February 2023 has 28 days" */
  | { ok: false; problem: 'day'; year: number; month: number };

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * `new Date(y, m, d)` maps years 0-99 to 1900-1999, so a typed 02/29/0004 would be checked
 * against 1904. setFullYear doesn't do that mapping. See docs/pitfalls.md#two-digit-years.
 */
function localDate(year: number, monthIndex: number, day: number): Date {
  const date = new Date(2000, 0, 1);
  date.setFullYear(year, monthIndex, day);
  return date;
}

/** Day 0 of the next month is the last day of this one, so `Date` handles leap years for us. */
export function daysInMonth(year: number, month: number): number {
  return localDate(year, month, 0).getDate();
}

/** Formats as MM/DD/YYYY, the same shape `parseDate` accepts, so output always round-trips. */
export function formatDate({ year, month, day }: CalendarDate): string {
  return `${pad2(month)}/${pad2(day)}/${String(year).padStart(4, '0')}`;
}

/**
 * Checks typed text and says what's wrong with it, so the error message can be specific
 * (WCAG 3.3.3). Rejects dates that don't exist: 13/01/2024, 02/30/2024, 02/29/2023. Never throws.
 */
export function validateDate(text: string): DateValidation {
  const trimmed = text.trim();
  const match = DATE_PATTERN.exec(trimmed);
  if (!match) {
    // A 2-digit year is ambiguous (1924 or 2024?), so ask instead of guessing
    return { ok: false, problem: TWO_DIGIT_YEAR_PATTERN.test(trimmed) ? 'two-digit-year' : 'format' };
  }

  const month = Number(match[1]);
  const day = Number(match[3]);
  const year = Number(match[4]);

  if (month < 1 || month > 12) return { ok: false, problem: 'month' };
  if (day < 1 || day > daysInMonth(year, month)) return { ok: false, problem: 'day', year, month };

  return { ok: true, date: { year, month, day } };
}

/** validateDate when you only need the date. Null for anything invalid. */
export function parseDate(text: string): CalendarDate | null {
  const result = validateDate(text);
  return result.ok ? result.date : null;
}

/**
 * One month laid out for a Sunday-first 7-column grid: `null` for the blank cells
 * before day 1 and after the last day, so the length is always a multiple of 7.
 */
export function buildMonthGrid(year: number, month: number): (number | null)[] {
  const total = daysInMonth(year, month);
  const leading = localDate(year, month - 1, 1).getDay();
  const cells: (number | null)[] = [];

  for (let i = 0; i < leading; i++) cells.push(null);
  for (let day = 1; day <= total; day++) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);

  return cells;
}

/** Inclusive list of years. Throws on a reversed range, since that is a caller bug. */
export function yearRange(min: number, max: number): number[] {
  if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
    throw new RangeError(`Invalid year range: ${min}..${max}`);
  }
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

/** Years `formatDate` can write as YYYY. Keyboard navigation stops at these edges. */
export const MIN_YEAR = 0;
export const MAX_YEAR = 9999;

function fromDate(date: Date): CalendarDate {
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}

export function today(): CalendarDate {
  return fromDate(new Date());
}

export function isSameDate(a: CalendarDate | null, b: CalendarDate | null): boolean {
  return !!a && !!b && a.year === b.year && a.month === b.month && a.day === b.day;
}

export function isInRange({ year }: CalendarDate): boolean {
  return year >= MIN_YEAR && year <= MAX_YEAR;
}

/** 0 = Sunday ... 6 = Saturday */
export function dayOfWeek({ year, month, day }: CalendarDate): number {
  return localDate(year, month - 1, day).getDay();
}

/** Calendar-day arithmetic. `Date` handles month and year rollover; no milliseconds, so no DST bugs. */
export function addDays({ year, month, day }: CalendarDate, n: number): CalendarDate {
  return fromDate(localDate(year, month - 1, day + n));
}

/**
 * Moves by whole months, clamping the day: Jan 31 + 1 month is Feb 28/29, not March 2/3.
 * That's what people expect from PageDown, and it's NOT what `Date` does on its own.
 */
export function addMonths({ year, month, day }: CalendarDate, n: number): CalendarDate {
  const index = year * 12 + (month - 1) + n;
  const nextYear = Math.floor(index / 12);
  const nextMonth = index - nextYear * 12 + 1;
  return { year: nextYear, month: nextMonth, day: Math.min(day, daysInMonth(nextYear, nextMonth)) };
}

// ---- locale names ----
// Intl formatters are slow to build, so each locale's names are built once and cached.

const monthNameCache = new Map<string, string[]>();
const weekdayNameCache = new Map<string, string[]>();

/** January..December in the given locale. Throws RangeError for an invalid locale tag. */
export function monthNames(locale: string): string[] {
  let names = monthNameCache.get(locale);
  if (!names) {
    const format = new Intl.DateTimeFormat(locale, { month: 'long' });
    names = Array.from({ length: 12 }, (_, i) => format.format(localDate(2000, i, 1)));
    monthNameCache.set(locale, names);
  }
  return names;
}

/** Sunday..Saturday in the given locale, `short` (Sun) or `long` (Sunday). */
export function weekdayNames(locale: string, width: 'short' | 'long'): string[] {
  const key = `${locale}|${width}`;
  let names = weekdayNameCache.get(key);
  if (!names) {
    const format = new Intl.DateTimeFormat(locale, { weekday: width });
    // Jan 2 2000 was a Sunday
    names = Array.from({ length: 7 }, (_, i) => format.format(localDate(2000, 0, 2 + i)));
    weekdayNameCache.set(key, names);
  }
  return names;
}

/** "November 3, 2026" in en-US. For screen-reader labels, not for the input's value. */
export function formatLongDate({ year, month, day }: CalendarDate, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(localDate(year, month - 1, day));
}

