/**
 * Every piece of UI text in the picker, so a page can translate or reword it.
 * Month and weekday names aren't here: they come from `Intl` using the `locale` property.
 */
export interface DatePickerStrings {
  /** Visible format hint under the field. */
  hint: string;
  /** Calendar button name when the field is empty. */
  chooseDate: string;
  /** Calendar button name when a date is set, e.g. "Change date, November 3, 2026". */
  changeDate: (longDate: string) => string;
  /** Accessible name of the calendar dialog. */
  dialog: string;
  month: string;
  year: string;
  errors: {
    format: string;
    twoDigitYear: string;
    month: string;
    /** e.g. "February 2023 has 28 days." */
    day: (monthName: string, year: number, days: number) => string;
    required: string;
  };
}

/** What a page passes in: any subset, including a subset of `errors`. */
export type DatePickerStringOverrides = Partial<Omit<DatePickerStrings, 'errors'>> & {
  errors?: Partial<DatePickerStrings['errors']>;
};

export const DEFAULT_STRINGS: DatePickerStrings = {
  hint: 'Format: MM/DD/YYYY',
  chooseDate: 'Choose date',
  changeDate: (longDate) => `Change date, ${longDate}`,
  dialog: 'Choose date',
  month: 'Month',
  year: 'Year',
  errors: {
    format: 'Enter the date as MM/DD/YYYY, like 04/03/2023.',
    twoDigitYear: 'Use a four-digit year, like 2023.',
    month: 'The month must be from 1 to 12.',
    day: (monthName, year, days) => `${monthName} ${year} has ${days} days.`,
    required: 'Enter a date.',
  },
};

/** Overrides on top of the defaults. `errors` merges one level deep so one message can change alone. */
export function resolveStrings(overrides: DatePickerStringOverrides = {}): DatePickerStrings {
  return {
    ...DEFAULT_STRINGS,
    ...overrides,
    errors: { ...DEFAULT_STRINGS.errors, ...overrides.errors },
  };
}
