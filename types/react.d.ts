import { type EventName } from '@lit/react';
import { DatePicker as DatePickerElement, type DatePickerChangeEvent } from './date-picker.js';
/**
 * `<consistent-date-picker>` as a React component, for React 18 and up. Importing this registers
 * the tag. Props are set as properties, and `onDateChange` gets the real event, with
 * `event.detail.value`. React 19 apps can use the bare tag instead; see docs/usage.md.
 */
export declare const DatePicker: import("@lit/react").ReactWebComponent<DatePickerElement, {
    onDateChange: EventName<DatePickerChangeEvent>;
}>;
