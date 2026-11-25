import { describe, expect, it, vi } from 'vitest';
import {
  addDays, addMonths, buildMonthGrid, dayOfWeek, daysInMonth, formatDate, formatLongDate, isInRange,
  isSameDate, monthNames, parseDate, validateDate, weekdayNames, yearRange,
} from './date-utils';

describe('daysInMonth', () => {
  it('handles leap years, including the century rules', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2023, 2)).toBe(28);
    expect(daysInMonth(1900, 2)).toBe(28); // divisible by 100, not 400
    expect(daysInMonth(2000, 2)).toBe(29); // divisible by 400
  });

  it('does not map years 0-99 to the 1900s', () => {
    // Year 0 is a leap year (divisible by 400). 1900 is not, so a 1900s mapping gives 28
    expect(daysInMonth(0, 2)).toBe(29);
  });

  it('knows 30 and 31 day months', () => {
    expect(daysInMonth(2024, 4)).toBe(30);
    expect(daysInMonth(2024, 12)).toBe(31);
  });
});

describe('formatDate', () => {
  it('zero-pads month, day, and year', () => {
    expect(formatDate({ year: 2023, month: 4, day: 3 })).toBe('04/03/2023');
    expect(formatDate({ year: 50, month: 1, day: 1 })).toBe('01/01/0050');
  });

  it('round-trips through parseDate', () => {
    const date = { year: 2024, month: 2, day: 29 };
    expect(parseDate(formatDate(date))).toEqual(date);
  });
});

describe('parseDate', () => {
  it('parses a valid date and trims whitespace', () => {
    expect(parseDate(' 11/24/2026 ')).toEqual({ year: 2026, month: 11, day: 24 });
  });

  it.each([
    ['', 'empty'],
    ['2023-04-03', 'ISO shape'],
    ['13/01/2024', 'month 13'],
    ['00/10/2024', 'month 0'],
    ['04/00/2024', 'day 0'],
    ['04/31/2024', 'April 31'],
    ['02/30/2024', 'Feb 30'],
    ['02/29/2023', 'Feb 29 off a leap year'],
    ['02/29/1900', 'Feb 29 on a century non-leap year'],
    ['04/03/2023x', 'trailing junk'],
    ['4/3-2023', 'mixed separators'],
    ['04/03/02023', 'five-digit year'],
  ])('rejects %s (%s)', (text) => {
    expect(parseDate(text)).toBeNull();
  });

  it.each(['4/3/2023', '04-03-2023', '4.3.2023', '4 3 2023', '04/3/2023'])(
    'accepts the looser format %j',
    (text) => {
      expect(parseDate(text)).toEqual({ year: 2023, month: 4, day: 3 });
    },
  );

  it('accepts Feb 29 on a leap year', () => {
    expect(parseDate('02/29/2000')).toEqual({ year: 2000, month: 2, day: 29 });
  });
});

describe('buildMonthGrid', () => {
  it('pads to whole weeks with nulls', () => {
    // November 2026 starts on a Sunday and has 30 days
    const grid = buildMonthGrid(2026, 11);
    expect(grid.length % 7).toBe(0);
    expect(grid[0]).toBe(1);
    expect(grid.filter((c) => c !== null)).toHaveLength(30);
    expect(grid.slice(30)).toEqual([null, null, null, null, null]);
  });

  it('adds leading blanks before day 1', () => {
    // April 2023 starts on a Saturday
    const grid = buildMonthGrid(2023, 4);
    expect(grid.slice(0, 7)).toEqual([null, null, null, null, null, null, 1]);
    expect(grid.length).toBe(42); // six rows
  });

  it('handles a February that fills exactly four rows', () => {
    // Feb 2026: starts Sunday, 28 days
    expect(buildMonthGrid(2026, 2)).toEqual(Array.from({ length: 28 }, (_, i) => i + 1));
  });
});

describe('yearRange', () => {
  it('is inclusive', () => {
    expect(yearRange(2020, 2023)).toEqual([2020, 2021, 2022, 2023]);
    expect(yearRange(2024, 2024)).toEqual([2024]);
  });

  it('throws on a reversed or non-integer range', () => {
    expect(() => yearRange(2025, 2024)).toThrow(RangeError);
    expect(() => yearRange(2024.5, 2025)).toThrow(RangeError);
  });
});

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays({ year: 2024, month: 1, day: 31 }, 1)).toEqual({ year: 2024, month: 2, day: 1 });
    expect(addDays({ year: 2024, month: 1, day: 1 }, -1)).toEqual({ year: 2023, month: 12, day: 31 });
    expect(addDays({ year: 2024, month: 2, day: 26 }, 7)).toEqual({ year: 2024, month: 3, day: 4 });
  });

  it('works across a DST change where midnight does not exist', () => {
    // TZ is America/Sao_Paulo (vitest.config.ts). 2018-11-04 00:00 was skipped straight to 01:00
    expect(new Date(2018, 10, 4).getHours()).toBe(1); // proves the TZ is really in effect
    expect(addDays({ year: 2018, month: 11, day: 3 }, 1)).toEqual({ year: 2018, month: 11, day: 4 });
    expect(addDays({ year: 2018, month: 11, day: 4 }, 1)).toEqual({ year: 2018, month: 11, day: 5 });
    expect(buildMonthGrid(2018, 11).filter((d) => d !== null)).toHaveLength(30);
  });

  it('does not map years 0-99 to the 1900s', () => {
    expect(addDays({ year: 50, month: 6, day: 1 }, 1)).toEqual({ year: 50, month: 6, day: 2 });
  });
});

describe('addMonths', () => {
  it('clamps the day to the target month', () => {
    expect(addMonths({ year: 2024, month: 1, day: 31 }, 1)).toEqual({ year: 2024, month: 2, day: 29 });
    expect(addMonths({ year: 2023, month: 1, day: 31 }, 1)).toEqual({ year: 2023, month: 2, day: 28 });
    expect(addMonths({ year: 2024, month: 2, day: 29 }, 12)).toEqual({ year: 2025, month: 2, day: 28 });
  });

  it('crosses years in both directions', () => {
    expect(addMonths({ year: 2024, month: 12, day: 15 }, 1)).toEqual({ year: 2025, month: 1, day: 15 });
    expect(addMonths({ year: 2024, month: 1, day: 15 }, -1)).toEqual({ year: 2023, month: 12, day: 15 });
    expect(addMonths({ year: 2024, month: 3, day: 15 }, -12)).toEqual({ year: 2023, month: 3, day: 15 });
  });
});

describe('dayOfWeek / isSameDate / isInRange', () => {
  it('knows the weekday', () => {
    expect(dayOfWeek({ year: 2026, month: 11, day: 24 })).toBe(2); // Tuesday
  });

  it('compares dates and handles null', () => {
    const d = { year: 2024, month: 2, day: 29 };
    expect(isSameDate(d, { ...d })).toBe(true);
    expect(isSameDate(d, { ...d, day: 28 })).toBe(false);
    expect(isSameDate(d, null)).toBe(false);
  });

  it('stays inside four-digit years', () => {
    expect(isInRange({ year: 1, month: 1, day: 1 })).toBe(true);
    expect(isInRange({ year: 0, month: 12, day: 31 })).toBe(false);
    expect(isInRange({ year: 10000, month: 1, day: 1 })).toBe(false);
  });
});

describe('validateDate', () => {
  it.each([
    ['nope', 'format'],
    ['2023-04-03', 'format'],
    ['4/3/23', 'two-digit-year'],
    ['04-03-23', 'two-digit-year'],
    ['13/01/2024', 'month'],
    ['00/01/2024', 'month'],
    ['01/01/0000', 'year'],
  ])('%j is a %s problem', (text, problem) => {
    expect(validateDate(text)).toEqual({ ok: false, problem });
  });

  it('a day problem carries the month and year for the message', () => {
    expect(validateDate('02/30/2023')).toEqual({ ok: false, problem: 'day', year: 2023, month: 2 });
  });

  it('a valid date carries the date', () => {
    expect(validateDate('2/29/2024')).toEqual({ ok: true, date: { year: 2024, month: 2, day: 29 } });
  });
});

describe('locale names', () => {
  it('names months and weekdays in en-US', () => {
    expect(monthNames('en-US')[10]).toBe('November');
    expect(weekdayNames('en-US', 'short')).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
    expect(weekdayNames('en-US', 'long')[0]).toBe('Sunday');
  });

  it('names them in other locales', () => {
    expect(monthNames('fr-FR')[0]).toBe('janvier');
    expect(weekdayNames('de-DE', 'long')[0]).toBe('Sonntag');
  });

  it('returns the cached array on repeat calls', () => {
    expect(monthNames('en-US')).toBe(monthNames('en-US'));
  });

  it('throws on an invalid locale tag', () => {
    expect(() => monthNames('not a locale')).toThrow(RangeError);
  });

  it('writes a long date, including years below 100', () => {
    expect(formatLongDate({ year: 2026, month: 11, day: 3 }, 'en-US')).toBe('November 3, 2026');
    expect(formatLongDate({ year: 50, month: 1, day: 1 }, 'en-US')).toContain('50');
  });

  it('builds the long-date formatter once per locale', () => {
    const spy = vi.spyOn(Intl, 'DateTimeFormat');
    try {
      // A locale no other test uses, so the cache starts empty for it
      expect(formatLongDate({ year: 2026, month: 11, day: 3 }, 'en-GB')).toBe('3 November 2026');
      expect(formatLongDate({ year: 2026, month: 11, day: 4 }, 'en-GB')).toBe('4 November 2026');
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });
});

