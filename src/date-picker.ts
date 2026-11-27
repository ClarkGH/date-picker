import { LitElement, PropertyValues, css, html, nothing } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { guard } from 'lit/directives/guard.js';
import { live } from 'lit/directives/live.js';
import { createPopper, Instance } from '@popperjs/core';
import {
  CalendarDate,
  DateValidation,
  addDays,
  addMonths,
  buildMonthGrid,
  dayOfWeek,
  daysInMonth,
  formatDate,
  formatLongDate,
  isInRange,
  isSameDate,
  monthNames,
  parseDate,
  today,
  validateDate,
  weekdayNames,
  yearRange,
} from './date-utils.js';
import { DatePickerStringOverrides, resolveStrings } from './strings.js';

/** Years either side of today in the dropdown. Wider lists are slow for screen readers ("1 of 1001"). */
const YEAR_SPAN = 100;

const FALLBACK_LOCALE = 'en-US';

type FieldProblem = Exclude<DateValidation, { ok: true }> | { ok: false; problem: 'required' };

export type DatePickerChangeEvent = CustomEvent<{ value: string }>;

/**
 * A text input plus a calendar popup (WAI-ARIA APG date picker combobox).
 * Value is MM/DD/YYYY or ''. Fires `change` with `detail.value` when the value changes.
 * Form-associated: give it a `name` and it submits with its <form>.
 * Registered by define.ts. How it works and why: docs/date-picker.md
 */
export class DatePicker extends LitElement {
  static formAssociated = true;

  /** delegatesFocus: `picker.focus()` and label clicks reach the inner input. */
  static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true };

  /** The committed value: always a valid MM/DD/YYYY string, or '' when empty. */
  @property({ type: String })
  selectedDate = '';

  /** True when the input holds a real date. False when empty or invalid. Read-only. */
  get isFieldValid(): boolean {
    return this._text.trim() !== '' && this._currentProblem() === null;
  }

  /** Visible label, and the input's accessible name. */
  @property({ type: String })
  label = 'Date';

  /** Form field name. The form submits `selectedDate` under it. */
  @property({ type: String, reflect: true })
  name?: string;

  @property({ type: Boolean, reflect: true })
  required = false;

  @property({ type: Boolean, reflect: true })
  disabled = false;

  /**
   * BCP 47 tag for month and weekday names, and the button's spoken date. The typed format
   * stays MM/DD/YYYY. An invalid tag falls back to en-US with a warning.
   */
  @property({ type: String })
  locale = FALLBACK_LOCALE;

  /** Replacement UI text. Any subset, including a subset of `errors`. */
  @property({ attribute: false })
  strings: DatePickerStringOverrides = {};

  @state() private _viewYear = new Date().getFullYear();
  @state() private _viewMonth = new Date().getMonth() + 1;
  /** The grid's single tab stop (roving tabindex). */
  @state() private _focusDay = 1;
  /** What the input shows. Differs from selectedDate while the text is invalid. */
  @state() private _text = '';
  /** Set on blur and Enter, not on every keystroke. */
  @state() private _shownProblem: FieldProblem | null = null;
  @state() private _isOpen = false;
  /** From a disabled <fieldset> or form, separate from `disabled`. */
  @state() private _formDisabled = false;

  @query('.input-container') private _anchor!: HTMLElement | null;
  @query('input') private _input!: HTMLInputElement | null;
  @query('.toggle') private _button!: HTMLButtonElement | null;
  @query('.date-picker') private _calendar!: HTMLElement | null;
  @query('td[tabindex="0"]') private _activeCell!: HTMLElement | null;

  private _popper: Instance | null = null;

  /** Null where form association isn't supported (Safari before 16.4, jsdom). */
  private _internals: ElementInternals | null;

  /** Cached because render reads `_locale` several times. */
  private _checkedLocale: { tag: string; resolved: string } | null = null;

  constructor() {
    super();
    this.addEventListener('focusout', this._onFocusOut);
    const internals = typeof this.attachInternals === 'function' ? this.attachInternals() : null;
    this._internals = internals && typeof internals.setFormValue === 'function' ? internals : null;
  }

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has('selectedDate')) this._syncFromValue(this.selectedDate);
    if (this._isDisabled && this._isOpen) this._close();
  }

  protected updated() {
    this._syncForm();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._close();
  }

  /** Rule 1: a loose date is stored as MM/DD/YYYY; a non-date is shown but never kept. */
  private _syncFromValue(value: string) {
    const parsed = parseDate(value);
    if (parsed) {
      this._text = formatDate(parsed);
      this._showDate(parsed);
      this._shownProblem = null;
      this.selectedDate = this._text;
    } else {
      this._text = value;
      this.selectedDate = '';
    }
  }

  private get _isDisabled() {
    return this.disabled || this._formDisabled;
  }

  private _currentProblem(): FieldProblem | null {
    const text = this._text.trim();
    if (text === '') return this.required ? { ok: false, problem: 'required' } : null;
    const result = validateDate(text);
    return result.ok ? null : result;
  }

  private _syncForm() {
    const internals = this._internals;
    if (!internals) return;

    const problem = this._currentProblem();
    // Text that isn't a date submits '', like a native date input, not the last valid date
    internals.setFormValue(problem ? '' : this.selectedDate);
    if (this._isDisabled || !problem || !this._input) {
      internals.setValidity({});
    } else {
      const flags = problem.problem === 'required' ? { valueMissing: true } : { badInput: true };
      internals.setValidity(flags, this._message(problem), this._input);
    }
  }

  /** The `selecteddate` attribute is the default value, like `value` on a native input. */
  formResetCallback() {
    this.selectedDate = this.getAttribute('selecteddate') ?? '';
    // Also runs when the value didn't change, to clear any typed text
    this._syncFromValue(this.selectedDate);
    this._shownProblem = null;
  }

  formDisabledCallback(disabled: boolean) {
    this._formDisabled = disabled;
  }

  formStateRestoreCallback(state: string | File | FormData | null) {
    if (typeof state === 'string') this.selectedDate = state;
  }

  /** Falls back instead of letting a bad tag make Intl throw mid-render. */
  private get _locale(): string {
    const tag = this.locale;
    if (this._checkedLocale?.tag !== tag) {
      let resolved = tag;
      try {
        Intl.DateTimeFormat.supportedLocalesOf(tag);
      } catch {
        console.warn(`consistent-date-picker: invalid locale "${tag}", using ${FALLBACK_LOCALE}`);
        resolved = FALLBACK_LOCALE;
      }
      this._checkedLocale = { tag, resolved };
    }
    return this._checkedLocale.resolved;
  }

  private _message(problem: FieldProblem): string {
    const { errors } = resolveStrings(this.strings);
    switch (problem.problem) {
      case 'required': return errors.required;
      case 'two-digit-year': return errors.twoDigitYear;
      case 'year': return errors.year;
      case 'month': return errors.month;
      case 'day': return errors.day(
        monthNames(this._locale)[problem.month - 1],
        problem.year,
        daysInMonth(problem.year, problem.month),
      );
      default: return errors.format;
    }
  }

  private _toggle() {
    if (this._isOpen) {
      this._close();
    } else {
      void this._open();
    }
  }

  private async _open() {
    if (this._isOpen || this._isDisabled) return;

    this._showDate(parseDate(this._text) ?? today());
    this._isOpen = true;
    document.addEventListener('pointerdown', this._onDocumentPointerDown);

    await this.updateComplete;

    // Closed, or opened twice, while waiting for the render
    if (!this._isOpen || this._popper || !this._anchor || !this._calendar) return;

    try {
      // The top layer escapes overflow clipping and z-index. Without the popover API it's in normal flow
      if (typeof this._calendar.showPopover === 'function') this._calendar.showPopover();
      this._popper = createPopper(this._anchor, this._calendar, {
        placement: 'bottom',
        modifiers: [{ name: 'offset', options: { offset: [0, 8] } }],
      });
      // Popper positions async. Focusing first would scroll the page to the calendar's temporary spot
      this._popper.forceUpdate();
    } catch (err) {
      // Unpositioned, the calendar still works in normal flow below the input
      console.error('consistent-date-picker: could not position calendar', err);
    }

    this._activeCell?.focus();
  }

  private _close({ returnFocus = false } = {}) {
    this._popper?.destroy();
    this._popper = null;
    document.removeEventListener('pointerdown', this._onDocumentPointerDown);
    this._isOpen = false;
    if (returnFocus) this._button?.focus();
  }

  private _onDocumentPointerDown = (e: Event) => {
    // e.target is retargeted to the host; composedPath sees the real element
    if (!e.composedPath().includes(this)) this._close();
  };

  /**
   * Closes when focus leaves the component. Moves inside the shadow root arrive with
   * relatedTarget retargeted to the host. A null relatedTarget (switching windows) keeps it open.
   */
  private _onFocusOut = (e: FocusEvent) => {
    if (!this._isOpen) return;
    const next = e.relatedTarget as Node | null;
    if (!next || next === this || this.contains(next) || this.shadowRoot?.contains(next)) return;
    this._close();
  };

  private _showDate(date: CalendarDate) {
    this._viewYear = date.year;
    this._viewMonth = date.month;
    this._focusDay = date.day;
  }

  private _setView(year: number, month: number) {
    this._viewYear = year;
    this._viewMonth = month;
    this._focusDay = Math.min(this._focusDay, daysInMonth(year, month));
  }

  private async _moveFocus(date: CalendarDate) {
    this._showDate(date);
    await this.updateComplete;
    this._activeCell?.focus();
  }

  /** Rule 2: the only place the value changes, so `change` fires once per real change. */
  private _commit(value: string) {
    if (value === this.selectedDate) return;
    this.selectedDate = value;
    this.dispatchEvent(
      new CustomEvent('change', { detail: { value }, bubbles: true, composed: true }),
    );
  }

  /** The calendar follows the typing. Nothing commits until blur or Enter. */
  private _onInput(e: Event) {
    this._text = (e.target as HTMLInputElement).value;
    const parsed = parseDate(this._text);
    if (parsed) this._showDate(parsed);
  }

  private _onInputBlur(e: FocusEvent) {
    this._commitText((e.target as HTMLInputElement).value);
  }

  private _commitText(text: string) {
    const raw = text.trim();
    this._text = raw;

    if (raw === '') {
      this._shownProblem = this.required ? { ok: false, problem: 'required' } : null;
      this._commit('');
      return;
    }

    const result = validateDate(raw);
    if (!result.ok) {
      this._shownProblem = result;
      return;
    }

    const value = formatDate(result.date);
    this._text = value;
    this._shownProblem = null;
    this._showDate(result.date);
    this._commit(value);
  }

  private _selectDay(day: number) {
    const value = formatDate({ year: this._viewYear, month: this._viewMonth, day });
    this._text = value;
    this._shownProblem = null;
    this._commit(value);
    this._close({ returnFocus: true });
  }

  private _onMonthChange(e: Event) {
    const month = Number((e.target as HTMLSelectElement).value);
    if (Number.isInteger(month) && month >= 1 && month <= 12) this._setView(this._viewYear, month);
  }

  private _onYearChange(e: Event) {
    const year = Number((e.target as HTMLSelectElement).value);
    if (Number.isInteger(year)) this._setView(year, this._viewMonth);
  }

  private _onTriggerKeydown(e: KeyboardEvent) {
    const input = this._input;
    if (e.key === 'Enter' && input && e.target === input) {
      // An input inside a shadow root doesn't submit the outer form on Enter, so do it by hand
      this._commitText(input.value);
      this._syncForm();
      this._internals?.form?.requestSubmit();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (this._isOpen) {
        this._activeCell?.focus();
      } else {
        void this._open();
      }
    } else if (e.key === 'Escape' && this._isOpen) {
      e.preventDefault();
      this._close();
    }
  }

  private _onCalendarKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      this._close({ returnFocus: true });
    }
  }

  private _onGridKeydown(e: KeyboardEvent) {
    const from: CalendarDate = { year: this._viewYear, month: this._viewMonth, day: this._focusDay };
    let to: CalendarDate;

    switch (e.key) {
      case 'ArrowLeft': to = addDays(from, -1); break;
      case 'ArrowRight': to = addDays(from, 1); break;
      case 'ArrowUp': to = addDays(from, -7); break;
      case 'ArrowDown': to = addDays(from, 7); break;
      case 'Home': to = addDays(from, -dayOfWeek(from)); break;
      case 'End': to = addDays(from, 6 - dayOfWeek(from)); break;
      case 'PageUp': to = addMonths(from, e.shiftKey ? -12 : -1); break;
      case 'PageDown': to = addMonths(from, e.shiftKey ? 12 : 1); break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        this._selectDay(from.day);
        return;
      default:
        return; // Escape bubbles up to _onCalendarKeydown
    }

    e.preventDefault();
    if (isInRange(to)) void this._moveFocus(to);
  }

  /** Stretches past ±YEAR_SPAN to include a typed year outside it. */
  private _renderYearOptions() {
    const thisYear = new Date().getFullYear();
    const years = yearRange(
      Math.min(thisYear - YEAR_SPAN, this._viewYear),
      Math.max(thisYear + YEAR_SPAN, this._viewYear),
    );
    return years.map(
      (year) => html`<option value=${year} .selected=${year === this._viewYear}>${year}</option>`,
    );
  }

  private _renderDay(day: number, selected: CalendarDate | null, now: CalendarDate) {
    const date = { year: this._viewYear, month: this._viewMonth, day };
    return html`
      <td
        class="day"
        tabindex=${day === this._focusDay ? 0 : -1}
        aria-selected=${isSameDate(date, selected) ? 'true' : nothing}
        aria-current=${isSameDate(date, now) ? 'date' : nothing}
        @click=${() => this._selectDay(day)}
      >${day}</td>
    `;
  }

  private _renderCalendar() {
    const strings = resolveStrings(this.strings);
    const locale = this._locale;
    const months = monthNames(locale);
    const shortDays = weekdayNames(locale, 'short');
    const longDays = weekdayNames(locale, 'long');
    const cells = buildMonthGrid(this._viewYear, this._viewMonth);
    const weeks: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

    // Rule 4: highlight the field's text, not selectedDate
    const selected = parseDate(this._text);
    const now = today();

    return html`
      <div
        id="calendar"
        class="date-picker"
        popover="manual"
        role="dialog"
        aria-label=${strings.dialog}
        @keydown=${this._onCalendarKeydown}
      >
        <div class="month-year__picker">
          <select id="month" aria-label=${strings.month} @change=${this._onMonthChange}>
            ${months.map(
              (name, i) => html`<option value=${i + 1} .selected=${i + 1 === this._viewMonth}>${name}</option>`,
            )}
          </select>
          <select id="year" aria-label=${strings.year} @change=${this._onYearChange}>
            ${guard([this._viewYear], () => this._renderYearOptions())}
          </select>
        </div>
        <div id="calendar-heading" class="sr-only" aria-live="polite">
          ${months[this._viewMonth - 1]} ${this._viewYear}
        </div>
        <table role="grid" aria-labelledby="calendar-heading" @keydown=${this._onGridKeydown}>
          <thead>
            <tr>
              ${shortDays.map((name, i) => html`<th scope="col" abbr=${longDays[i]}>${name}</th>`)}
            </tr>
          </thead>
          <tbody>
            ${weeks.map((week) => html`
              <tr>
                ${week.map((day) => (day === null ? html`<td></td>` : this._renderDay(day, selected, now)))}
              </tr>
            `)}
          </tbody>
        </table>
      </div>
    `;
  }

  render() {
    const strings = resolveStrings(this.strings);
    const selected = parseDate(this.selectedDate);
    const buttonLabel = selected
      ? strings.changeDate(formatLongDate(selected, this._locale))
      : strings.chooseDate;
    const disabled = this._isDisabled;

    return html`
      <label class="label" for="input">${this.label}</label>
      <div class="input-container">
        <input
          id="input"
          type="text"
          role="combobox"
          placeholder="MM/DD/YYYY"
          ?disabled=${disabled}
          ?required=${this.required}
          aria-haspopup="dialog"
          aria-expanded=${this._isOpen ? 'true' : 'false'}
          aria-controls="calendar"
          .value=${live(this._text)}
          aria-invalid=${this._shownProblem ? 'true' : 'false'}
          aria-describedby="hint error"
          @input=${this._onInput}
          @blur=${this._onInputBlur}
          @keydown=${this._onTriggerKeydown}
        />
        <button
          class="toggle"
          type="button"
          ?disabled=${disabled}
          aria-label=${buttonLabel}
          aria-haspopup="dialog"
          aria-expanded=${this._isOpen ? 'true' : 'false'}
          @click=${this._toggle}
          @keydown=${this._onTriggerKeydown}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19,3H17V1h-2v2H9V1H7v2H5C3.9,3,3,3.9,3,5v14c0,1.1,0.9,2,2,2h14c1.1,0,2-0.9,2-2V5C21,3.9,20.1,3,19,3z M5,8h14v2H5V8z M5,12h14v2H5V12z M5,16h9v2H5V16z"/>
          </svg>
        </button>
      </div>
      <p id="hint" class="hint">${strings.hint}</p>
      <p id="error" class="error" role="alert">${this._shownProblem ? this._message(this._shownProblem) : ''}</p>
      ${this._isOpen ? this._renderCalendar() : nothing}
    `;
  }

  static styles = css`
    /* Error colors: 6.5:1 on white, 9.1:1 on #242424 (WCAG 1.4.3 needs 4.5:1) */
    :host {
      --_error: var(--consistent-date-picker-error-color, #b3261e);
      display: flex;
      flex-direction: column;
      width: 100%;
      max-width: 280px;
    }

    @media (prefers-color-scheme: dark) {
      :host {
        --_error: var(--consistent-date-picker-error-color, #f2b8b5);
      }
    }

    .label {
      margin-bottom: 4px;
    }

    .input-container {
      position: relative;
      display: flex;
      align-items: center;
    }

    /* Form controls don't inherit the page font. min-height keeps the button 24x24 (WCAG 2.5.8) */
    input {
      font: inherit;
      flex: 1;
      min-width: 0;
      min-height: 2rem;
      box-sizing: border-box;
      padding-right: 32px;
    }

    input[aria-invalid='true'] {
      outline: 2px solid var(--_error);
    }

    .toggle {
      background: transparent;
      border: none;
      padding: 4px;
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      width: 32px;
      color: inherit;
      cursor: pointer;
    }

    .toggle:disabled {
      cursor: default;
      opacity: 0.5;
    }

    /* Absolute positioning ignores the button's padding, so inset by it */
    svg {
      position: absolute;
      inset: 4px;
      width: calc(100% - 8px);
      height: calc(100% - 8px);
      pointer-events: none;
      fill: currentColor;
    }

    .hint {
      margin: 4px 0 0;
    }

    .error {
      margin: 4px 0 0;
      color: var(--_error);
    }

    .error:empty {
      display: none;
    }

    /*
     * rem, min() and max-height keep it usable at large text and 400% zoom (WCAG 1.4.4, 1.4.10).
     * inset and margin undo the popover's centering so Popper's position applies.
     */
    .date-picker {
      inset: auto;
      margin: 0;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      font-size: var(--consistent-date-picker-font-size, 1rem);
      width: min(400px, calc(100vw - 16px));
      max-height: calc(100vh - 16px);
      overflow-y: auto;
      padding: 8px;
      border: 1px solid var(--consistent-date-picker-border-color, currentColor);
      border-radius: var(--consistent-date-picker-radius, 0);
      background: var(--consistent-date-picker-background, Canvas);
      color: var(--consistent-date-picker-text-color, CanvasText);
    }

    .month-year__picker {
      display: flex;
      justify-content: space-between;
    }

    select {
      font: inherit;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    th,
    td {
      border: 1px solid var(--consistent-date-picker-border-color, currentColor);
      padding: clamp(2px, 1vw, 10px);
      text-align: left;
      vertical-align: top;
    }

    th {
      font-weight: normal;
    }

    tbody td {
      height: clamp(2.75rem, 12vw, 100px);
      box-sizing: border-box;
    }

    .day {
      cursor: pointer;
    }

    /*
     * Two tones so one always contrasts with the cell, selected or not. Deliberately not
     * themeable: a themed ring can match the cell and vanish.
     */
    .day:focus-visible {
      outline: 2px solid CanvasText;
      outline-offset: -2px;
      box-shadow: inset 0 0 0 4px Canvas;
    }

    .day[aria-selected='true'] {
      background: var(--consistent-date-picker-accent, Highlight);
      color: var(--consistent-date-picker-accent-text, HighlightText);
    }

    .day[aria-current='date'] {
      font-weight: bold;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: -1px;
      padding: 0;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
      border: 0;
    }
  `;
}
