/** All UI text, so a page can translate or reword it. Month and weekday names come from `Intl`. */
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
        year: string;
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
export declare const DEFAULT_STRINGS: DatePickerStrings;
/** `errors` merges one level deep, so one message can change alone. */
export declare function resolveStrings(overrides?: DatePickerStringOverrides): DatePickerStrings;
