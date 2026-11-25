import { LitElement, PropertyValues } from 'lit';
import { DatePickerStringOverrides } from './strings';
export type DatePickerChangeEvent = CustomEvent<{
    value: string;
}>;
/**
 * `<date-picker>`: a text input plus a calendar popup (WAI-ARIA APG date picker combobox).
 * Value is MM/DD/YYYY or ''. Fires `change` with `detail.value` when the value changes.
 * Form-associated: give it a `name` and it submits with its <form>.
 * How it works and why: docs/date-picker.md
 */
export declare class DatePicker extends LitElement {
    static formAssociated: boolean;
    /** delegatesFocus: `picker.focus()` and label clicks reach the inner input. */
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
    /** The `selecteddate` attribute is the default value, like `value` on a native input. */
    formResetCallback(): void;
    formDisabledCallback(disabled: boolean): void;
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
declare global {
    interface HTMLElementTagNameMap {
        'date-picker': DatePicker;
    }
}
