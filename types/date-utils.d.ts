/**
 * Pure calendar math: no DOM, no Lit. Months are 1-based (1 = January); the JS `Date`
 * 0-based month stays inside this file. See docs/pitfalls.md#zero-based-months.
 */
export interface CalendarDate {
    year: number;
    month: number;
    day: number;
}
/** Year 0 is 1 BC, which `Intl` writes as year 1, so the range starts at 1. */
export declare const MIN_YEAR = 1;
export declare const MAX_YEAR = 9999;
export type DateProblem = 'format' | 'two-digit-year' | 'year' | 'month' | 'day';
export type DateValidation = {
    ok: true;
    date: CalendarDate;
} | {
    ok: false;
    problem: 'format' | 'two-digit-year' | 'year' | 'month';
} | {
    ok: false;
    problem: 'day';
    year: number;
    month: number;
};
/** Day 0 of the next month is the last day of this one, so `Date` handles leap years. */
export declare function daysInMonth(year: number, month: number): number;
export declare function formatDate({ year, month, day }: CalendarDate): string;
/** Says what's wrong, so the error can be specific (WCAG 3.3.3). Never throws. */
export declare function validateDate(text: string): DateValidation;
export declare function parseDate(text: string): CalendarDate | null;
/** A Sunday-first 7-column month, padded with `null` to a multiple of 7. */
export declare function buildMonthGrid(year: number, month: number): (number | null)[];
/** Inclusive. Throws on a reversed range, since that's a caller bug. */
export declare function yearRange(min: number, max: number): number[];
export declare function today(): CalendarDate;
export declare function isSameDate(a: CalendarDate | null, b: CalendarDate | null): boolean;
export declare function isInRange({ year }: CalendarDate): boolean;
/** 0 = Sunday ... 6 = Saturday */
export declare function dayOfWeek({ year, month, day }: CalendarDate): number;
/** Works in calendar days, not milliseconds, so DST can't shift the result. */
export declare function addDays({ year, month, day }: CalendarDate, n: number): CalendarDate;
/** Clamps the day: Jan 31 + 1 month is Feb 28/29, not March 2/3 like `Date` gives. */
export declare function addMonths({ year, month, day }: CalendarDate, n: number): CalendarDate;
/** Throws RangeError for an invalid locale tag. */
export declare function monthNames(locale: string): string[];
export declare function weekdayNames(locale: string, width: 'short' | 'long'): string[];
/** "November 3, 2026" in en-US. For screen-reader labels, not the input. */
export declare function formatLongDate({ year, month, day }: CalendarDate, locale: string): string;
