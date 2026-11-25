/**
 * Pure calendar math: no DOM, no Lit. Months are 1-based (1 = January); the JS `Date`
 * 0-based month stays inside this file. See docs/pitfalls.md#zero-based-months.
 */

export interface CalendarDate {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

/** 4/3/2023, 04-03-2023, 4.3.2023, 4 3 2023. The \2 backreference rejects mixed separators. */
const DATE_PATTERN = /^(\d{1,2})([/.\- ])(\d{1,2})\2(\d{4})$/;

/** Caught separately so the error can say what's wrong. */
const TWO_DIGIT_YEAR_PATTERN = /^(\d{1,2})([/.\- ])(\d{1,2})\2(\d{2})$/;

/** Year 0 is 1 BC, which `Intl` writes as year 1, so the range starts at 1. */
export const MIN_YEAR = 1;
export const MAX_YEAR = 9999;

export type DateProblem = 'format' | 'two-digit-year' | 'year' | 'month' | 'day';

export type DateValidation =
  | { ok: true; date: CalendarDate }
  | { ok: false; problem: 'format' | 'two-digit-year' | 'year' | 'month' }
  | { ok: false; problem: 'day'; year: number; month: number };

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** `new Date(y, m, d)` maps years 0-99 to 1900-1999; setFullYear doesn't. See docs/pitfalls.md#two-digit-years. */
function localDate(year: number, monthIndex: number, day: number): Date {
  const date = new Date(2000, 0, 1);
  date.setFullYear(year, monthIndex, day);
  return date;
}

/** Day 0 of the next month is the last day of this one, so `Date` handles leap years. */
export function daysInMonth(year: number, month: number): number {
  return localDate(year, month, 0).getDate();
}

export function formatDate({ year, month, day }: CalendarDate): string {
  return `${pad2(month)}/${pad2(day)}/${String(year).padStart(4, '0')}`;
}

/** Says what's wrong, so the error can be specific (WCAG 3.3.3). Never throws. */
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

  if (year < MIN_YEAR || year > MAX_YEAR) return { ok: false, problem: 'year' };
  if (month < 1 || month > 12) return { ok: false, problem: 'month' };
  if (day < 1 || day > daysInMonth(year, month)) return { ok: false, problem: 'day', year, month };

  return { ok: true, date: { year, month, day } };
}

export function parseDate(text: string): CalendarDate | null {
  const result = validateDate(text);
  return result.ok ? result.date : null;
}

/** A Sunday-first 7-column month, padded with `null` to a multiple of 7. */
export function buildMonthGrid(year: number, month: number): (number | null)[] {
  const total = daysInMonth(year, month);
  const leading = localDate(year, month - 1, 1).getDay();
  const cells: (number | null)[] = [];

  for (let i = 0; i < leading; i++) cells.push(null);
  for (let day = 1; day <= total; day++) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);

  return cells;
}

/** Inclusive. Throws on a reversed range, since that's a caller bug. */
export function yearRange(min: number, max: number): number[] {
  if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
    throw new RangeError(`Invalid year range: ${min}..${max}`);
  }
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

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

/** Works in calendar days, not milliseconds, so DST can't shift the result. */
export function addDays({ year, month, day }: CalendarDate, n: number): CalendarDate {
  return fromDate(localDate(year, month - 1, day + n));
}

/** Clamps the day: Jan 31 + 1 month is Feb 28/29, not March 2/3 like `Date` gives. */
export function addMonths({ year, month, day }: CalendarDate, n: number): CalendarDate {
  const index = year * 12 + (month - 1) + n;
  const nextYear = Math.floor(index / 12);
  const nextMonth = index - nextYear * 12 + 1;
  return { year: nextYear, month: nextMonth, day: Math.min(day, daysInMonth(nextYear, nextMonth)) };
}

// Intl formatters are slow to build, so each locale's are built once and cached

const monthNameCache = new Map<string, string[]>();
const weekdayNameCache = new Map<string, string[]>();

/** Throws RangeError for an invalid locale tag. */
export function monthNames(locale: string): string[] {
  let names = monthNameCache.get(locale);
  if (!names) {
    const format = new Intl.DateTimeFormat(locale, { month: 'long' });
    names = Array.from({ length: 12 }, (_, i) => format.format(localDate(2000, i, 1)));
    monthNameCache.set(locale, names);
  }
  return names;
}

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

const longDateFormatCache = new Map<string, Intl.DateTimeFormat>();

/** "November 3, 2026" in en-US. For screen-reader labels, not the input. */
export function formatLongDate({ year, month, day }: CalendarDate, locale: string): string {
  let format = longDateFormatCache.get(locale);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, { dateStyle: 'long' });
    longDateFormatCache.set(locale, format);
  }
  return format.format(localDate(year, month - 1, day));
}

