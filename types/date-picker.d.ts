import { LitElement, PropertyValues } from 'lit';
import { DatePickerStringOverrides } from './strings.js';
export type DatePickerChangeEvent = CustomEvent<{
    value: string;
}>;
/**
 * A text input plus a calendar popup (WAI-ARIA APG date picker combobox).
 * Value is MM/DD/YYYY or ''. Form-associated: give it a `name` and it submits with its <form>.
 * Registered by define.ts. How it works and why: docs/date-picker.md
 *
 * @tagname consistent-date-picker
 * @fires {DatePickerChangeEvent} change - The user changed the date. `event.detail.value` is the new value
 * @cssprop [--consistent-date-picker-font-size=1rem] - Calendar text, including the month and year dropdowns
 * @cssprop [--consistent-date-picker-background=Canvas] - Calendar background
 * @cssprop [--consistent-date-picker-text-color=CanvasText] - Calendar text color
 * @cssprop [--consistent-date-picker-border-color=currentColor] - Calendar and cell borders
 * @cssprop [--consistent-date-picker-radius=0] - Calendar corners
 * @cssprop [--consistent-date-picker-accent=Highlight] - Selected day background
 * @cssprop [--consistent-date-picker-accent-text=HighlightText] - Selected day text
 * @cssprop [--consistent-date-picker-error-color=#b3261e] - Error text and invalid outline. #f2b8b5 in dark mode
 * @csspart label - The text above the field
 * @csspart input - The text field
 * @csspart button - The calendar button
 * @csspart hint - The format hint under the field
 * @csspart error - The error message under the field
 * @csspart calendar - The calendar popup
 * @csspart header - The row holding the month and year dropdowns
 * @csspart month - The month dropdown
 * @csspart year - The year dropdown
 * @csspart grid - The table of days
 * @csspart weekday - A day-name column header
 * @csspart day - A day. Also `selected` on the selected day, and `today` on today
 * @csspart selected - The selected day, alongside `day`
 * @csspart today - Today, alongside `day`
 * @csspart empty - A blank cell before the 1st or after the last day
 */
export declare class DatePicker extends LitElement {
    /** @internal */
    static formAssociated: boolean;
    /** @internal delegatesFocus: `picker.focus()` and label clicks reach the inner input. */
    static shadowRootOptions: ShadowRootInit;
    /** The committed value: always a valid MM/DD/YYYY string, or '' when empty. */
    selectedDate: string;
    /** True when the input holds a real date. False when empty or invalid. Read-only. */
    get isFieldValid(): boolean;
    /** Visible label, and the input's accessible name. */
    label: string;
    /** Form field name. The form submits `selectedDate` under it. */
    name?: string;
    required: boolean;
    disabled: boolean;
    /**
     * BCP 47 tag for month and weekday names, and the button's spoken date. The typed format
     * stays MM/DD/YYYY. An invalid tag falls back to en-US with a warning.
     */
    locale: string;
    /** Replacement UI text. Any subset, including a subset of `errors`. */
    strings: DatePickerStringOverrides;
    private _viewYear;
    private _viewMonth;
    /** The grid's single tab stop (roving tabindex). */
    private _focusDay;
    /** What the input shows. Differs from selectedDate while the text is invalid. */
    private _text;
    /** Set on blur and Enter, not on every keystroke. */
    private _shownProblem;
    private _isOpen;
    /** From a disabled <fieldset> or form, separate from `disabled`. */
    private _formDisabled;
    private _anchor;
    private _input;
    private _button;
    private _calendar;
    private _activeCell;
    private _popper;
    /** Null where form association isn't supported (Safari before 16.4, jsdom). */
    private _internals;
    /** Cached because render reads `_locale` several times. */
    private _checkedLocale;
    constructor();
    protected willUpdate(changed: PropertyValues<this>): void;
    protected updated(): void;
    disconnectedCallback(): void;
    /** Rule 1: a loose date is stored as MM/DD/YYYY; a non-date is shown but never kept. */
    private _syncFromValue;
    private get _isDisabled();
    private _currentProblem;
    private _syncForm;
    /** @internal The `selecteddate` attribute is the default value, like `value` on a native input. */
    formResetCallback(): void;
    /** @internal */
    formDisabledCallback(disabled: boolean): void;
    /** @internal */
    formStateRestoreCallback(state: string | File | FormData | null): void;
    /** Falls back instead of letting a bad tag make Intl throw mid-render. */
    private get _locale();
    private _message;
    private _toggle;
    private _open;
    private _close;
    private _onDocumentPointerDown;
    /**
     * Closes when focus leaves the component. Moves inside the shadow root arrive with
     * relatedTarget retargeted to the host. A null relatedTarget (switching windows) keeps it open.
     */
    private _onFocusOut;
    private _showDate;
    private _setView;
    private _moveFocus;
    /** Rule 2: the only place the value changes, so `change` fires once per real change. */
    private _commit;
    /** The calendar follows the typing. Nothing commits until blur or Enter. */
    private _onInput;
    private _onInputBlur;
    private _commitText;
    private _selectDay;
    private _onMonthChange;
    private _onYearChange;
    private _onTriggerKeydown;
    private _onCalendarKeydown;
    private _onGridKeydown;
    /** Stretches past ±YEAR_SPAN to include a typed year outside it. */
    private _renderYearOptions;
    private _renderDay;
    private _renderCalendar;
    render(): import("lit").TemplateResult<1>;
    static styles: import("lit").CSSResult;
}
/** The events the picker fires, so `addEventListener('change', ...)` knows `event.detail`. */
export interface DatePickerEventMap extends HTMLElementEventMap {
    change: DatePickerChangeEvent;
}
export interface DatePicker {
    addEventListener<K extends keyof DatePickerEventMap>(type: K, listener: (this: DatePicker, event: DatePickerEventMap[K]) => unknown, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof DatePickerEventMap>(type: K, listener: (this: DatePicker, event: DatePickerEventMap[K]) => unknown, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}
