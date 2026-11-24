import { LitElement, PropertyValues, css, html, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
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
} from './date-utils';
import { DatePickerStringOverrides, resolveStrings } from './strings';

/**
 * How far the year dropdown reaches either side of today. 201 options: enough for birthdays
 * and planning, without a 1,001-option list ("1 of 1001" to a screen reader).
 */
const YEAR_SPAN = 100;

const FALLBACK_LOCALE = 'en-US';

/** Why the field is invalid, or null. 'required' only comes from an empty required field. */
type FieldProblem = Exclude<DateValidation, { ok: true }> | { ok: false; problem: 'required' };

export type DatePickerChangeEvent = CustomEvent<{ value: string }>;

/**
 * `<date-picker>`: a text input plus a calendar popup.
 * Value is MM/DD/YYYY or ''. Fires `change` with `detail.value` when the committed value changes.
 * Follows the WAI-ARIA APG date picker combobox pattern: the input is a combobox that opens a
 * non-modal calendar dialog, so typing in the field keeps working while the calendar is open.
 * Form-associated: give it a `name` and it submits with its <form> like a native input.
 * How it works and why: docs/date-picker.md
 */
@customElement('date-picker')
export class DatePicker extends LitElement {
  /** Lets the element join <form>s through ElementInternals. */
  static formAssociated = true;

  /** `picker.focus()` (and clicking the label) focuses the input inside the shadow root. */
  static shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true };

  /** The committed value: always a valid MM/DD/YYYY string, or '' when empty. */
  @property({ type: String })
  selectedDate = '';

  /** True when the input holds a real date. False when empty or invalid. */
  @property({ type: Boolean })
  isFieldValid = false;

  /**
   * The visible label, which is also the input's accessible name. Rendered inside the
   * component because a page's `<label for>` can't reach an input inside a shadow root.
   */
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
   * stays MM/DD/YYYY whatever the locale. An invalid tag falls back to en-US with a warning.
   */
  @property({ type: String })
  locale = FALLBACK_LOCALE;

  /** Replacement UI text. Any subset, including a subset of `errors`. */
  @property({ attribute: false })
  strings: DatePickerStringOverrides = {};

  /** The month/year the calendar is showing, which is not necessarily the selected one. */
  @state() private _viewYear = new Date().getFullYear();
  @state() private _viewMonth = new Date().getMonth() + 1;

  /** The day in the view month that holds the grid's single tab stop (roving tabindex). */
  @state() private _focusDay = 1;

  /** What the input shows. Differs from selectedDate while the typed text is invalid. */
  @state() private _text = '';
  /** The problem shown under the field. Set on blur/commit, not on every keystroke. */
  @state() private _shownProblem: FieldProblem | null = null;
  @state() private _isOpen = false;
  /** Set by a disabled <fieldset> or form, separately from our own `disabled`. */
  @state() private _formDisabled = false;

  @query('.input-container') private _anchor!: HTMLElement;
  @query('input') private _input!: HTMLInputElement | null;
  @query('.toggle') private _button!: HTMLButtonElement;
  @query('.date-picker') private _calendar!: HTMLElement | null;
  @query('td[tabindex="0"]') private _activeCell!: HTMLElement | null;

  /** One Popper instance per open calendar. Created after render, destroyed on close. */
  private _popper: Instance | null = null;

  /**
   * Null where form association isn't supported (Safari before 16.4, jsdom). The picker
   * still works there; it just doesn't take part in forms.
   */
  private _internals: ElementInternals | null;

  private _warnedLocale: string | null = null;

  // ---- lifecycle ----

  constructor() {
    super();
    this.addEventListener('focusout', this._onFocusOut);
    const internals = typeof this.attachInternals === 'function' ? this.attachInternals() : null;
    this._internals = internals && typeof internals.setFormValue === 'function' ? internals : null;
  }

  protected willUpdate(changed: PropertyValues<this>) {
    // A page setting `selectedDate` from outside: sync the field and the calendar to it
    if (changed.has('selectedDate')) this._syncFromValue(this.selectedDate);
    if (this._isDisabled && this._isOpen) this._close();
  }

  /** Form value and validity follow every render, so they can't drift from what's on screen. */
  protected updated() {
    this._syncForm();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._close();
  }

  private _syncFromValue(value: string) {
    const parsed = parseDate(value);
    if (parsed) {
      this._text = formatDate(parsed);
      this._showDate(parsed);
      this._shownProblem = null;
      this.isFieldValid = true;
    } else {
      // '' clears the field; any other unparseable string is shown as-is and marked invalid
      this._text = value;
      this.isFieldValid = false;
    }
  }

  // ---- forms ----

  private get _isDisabled() {
    return this.disabled || this._formDisabled;
  }

  /** Validity of what's in the field right now, typed or committed. */
  private _currentProblem(): FieldProblem | null {
    const text = this._text.trim();
    if (text === '') return this.required ? { ok: false, problem: 'required' } : null;
    const result = validateDate(text);
    return result.ok ? null : result;
  }

  private _syncForm() {
    const internals = this._internals;
    if (!internals) return;

    internals.setFormValue(this.selectedDate);
    const problem = this._currentProblem();
    if (this._isDisabled || !problem || !this._input) {
      internals.setValidity({});
    } else {
      const flags = problem.problem === 'required' ? { valueMissing: true } : { badInput: true };
      // The input is the anchor, so the browser's validation bubble points at it
      internals.setValidity(flags, this._message(problem), this._input);
    }
  }

  /** The `selecteddate` attribute is the default value, like `value` on a native input. */
  formResetCallback() {
    this.selectedDate = this.getAttribute('selecteddate') ?? '';
    this._syncFromValue(this.selectedDate);
    this._shownProblem = null;
  }

  formDisabledCallback(disabled: boolean) {
    this._formDisabled = disabled;
  }

  /** Back/forward navigation and autofill restore the value the form last had. */
  formStateRestoreCallback(state: string | File | FormData | null) {
    if (typeof state === 'string') this.selectedDate = state;
  }

  // ---- strings and locale ----

  /** The locale to use. An invalid tag would make Intl throw mid-render, so fall back instead. */
  private get _locale(): string {
    try {
      Intl.DateTimeFormat.supportedLocalesOf(this.locale); // throws RangeError on a bad tag
      return this.locale;
    } catch {
      if (this._warnedLocale !== this.locale) {
        this._warnedLocale = this.locale;
        console.warn(`date-picker: invalid locale "${this.locale}", using ${FALLBACK_LOCALE}`);
      }
      return FALLBACK_LOCALE;
    }
  }

  private _message(problem: FieldProblem): string {
    const { errors } = resolveStrings(this.strings);
    switch (problem.problem) {
      case 'required': return errors.required;
      case 'two-digit-year': return errors.twoDigitYear;
      case 'month': return errors.month;
      case 'day': return errors.day(
        monthNames(this._locale)[problem.month - 1],
        problem.year,
        daysInMonth(problem.year, problem.month),
      );
      default: return errors.format;
    }
  }

  // ---- open / close ----

  private _toggle() {
    if (this._isOpen) {
      this._close();
    } else {
      void this._open();
    }
  }

  private async _open() {
    if (this._isOpen || this._isDisabled) return;

    // Always start on the field's date, or today when the field is empty or invalid
    this._showDate(parseDate(this._text) ?? today());
    this._isOpen = true;
    document.addEventListener('pointerdown', this._onDocumentPointerDown);

    // Lit renders async: the calendar element doesn't exist until this resolves
    await this.updateComplete;

    // Closed, or opened twice, while we were waiting
    if (!this._isOpen || this._popper || !this._calendar) return;

    try {
      this._popper = createPopper(this._anchor, this._calendar, {
        placement: 'bottom',
        modifiers: [{ name: 'offset', options: { offset: [0, 8] } }],
      });
      // Popper's first positioning is async. Focusing before it lands scrolls the page to the
      // calendar's temporary spot, then Popper moves it. forceUpdate positions it right now
      this._popper.forceUpdate();
    } catch (err) {
      // The calendar still works unpositioned, in normal flow below the input
      console.error('date-picker: could not position calendar', err);
    }

    this._activeCell?.focus();
  }

  /** `returnFocus` sends focus back to the button, for closes that happen inside the calendar. */
  private _close({ returnFocus = false } = {}) {
    this._popper?.destroy();
    this._popper = null;
    document.removeEventListener('pointerdown', this._onDocumentPointerDown);
    this._isOpen = false;
    if (returnFocus) this._button.focus();
  }

  /** Arrow function so add/removeEventListener get the same reference. */
  private _onDocumentPointerDown = (e: Event) => {
    // composedPath sees through shadow roots; e.target would be retargeted to the host
    if (!e.composedPath().includes(this)) this._close();
  };

  /**
   * Non-modal dialog: when focus leaves the component (Tab past the grid, Shift+Tab past the
   * input), close. Focus moving between our own elements arrives with relatedTarget retargeted
   * to the host. A null relatedTarget (switching windows) leaves it open.
   */
  private _onFocusOut = (e: FocusEvent) => {
    if (!this._isOpen) return;
    const next = e.relatedTarget as Node | null;
    if (!next || next === this || this.contains(next) || this.shadowRoot?.contains(next)) return;
    this._close();
  };

  // ---- view and focus ----

  private _showDate(date: CalendarDate) {
    this._viewYear = date.year;
    this._viewMonth = date.month;
    this._focusDay = date.day;
  }

  /** Change month/year from the dropdowns, keeping the focus day inside the new month. */
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

  // ---- value ----

  /** Single exit point for value changes, so `change` fires once and only on a real change. */
  private _commit(value: string) {
    if (value === this.selectedDate) return;
    this.selectedDate = value;
    this.dispatchEvent(
      new CustomEvent('change', { detail: { value }, bubbles: true, composed: true }),
    );
  }

  /**
   * While typing, the calendar follows the field: once the text is a complete date, the view
   * jumps to it. Nothing is committed and no error shows until blur.
   */
  private _onInput(e: Event) {
    this._text = (e.target as HTMLInputElement).value;
    const parsed = parseDate(this._text);
    if (parsed) this._showDate(parsed);
  }

  private _onInputBlur(e: FocusEvent) {
    this._commitText((e.target as HTMLInputElement).value);
  }

  /** Blur and Enter both end up here: commit valid text, or show what's wrong with it. */
  private _commitText(text: string) {
    const raw = text.trim();
    this._text = raw;

    if (raw === '') {
      this._shownProblem = this.required ? { ok: false, problem: 'required' } : null;
      this.isFieldValid = false;
      this._commit('');
      return;
    }

    const result = validateDate(raw);
    if (!result.ok) {
      // Keep their text so they can fix it, rather than wiping it
      this._shownProblem = result;
      this.isFieldValid = false;
      return;
    }

    // Looser input (4/3/2023, 4-3-2023) is written back in the one format we output
    const value = formatDate(result.date);
    this._text = value;
    this._shownProblem = null;
    this.isFieldValid = true;
    this._showDate(result.date);
    this._commit(value);
  }

  private _selectDay(day: number) {
    const value = formatDate({ year: this._viewYear, month: this._viewMonth, day });
    this._text = value;
    this._shownProblem = null;
    this.isFieldValid = true;
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

  // ---- keyboard ----

  /**
   * Combobox keys on the input and the button. Down (or Alt+Down) opens the calendar, or moves
   * into it if it's already open. Escape closes it and leaves focus where the user is.
   */
  private _onTriggerKeydown(e: KeyboardEvent) {
    const input = this._input;
    if (e.key === 'Enter' && input && e.target === input) {
      // A text input inside a shadow root doesn't submit the outer form on Enter, so do both
      // jobs by hand: commit what's typed, then submit (which runs validation, like native)
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

  /** Escape anywhere in the calendar closes it and returns focus to the button. */
  private _onCalendarKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      this._close({ returnFocus: true });
    }
  }

  /** Grid keys from the APG date picker pattern. Moves can cross into other months and years. */
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
        e.preventDefault(); // Space would otherwise scroll the page
        this._selectDay(from.day);
        return;
      default:
        return; // Escape bubbles up to _onCalendarKeydown; Tab is left to the browser
    }

    e.preventDefault(); // arrows and PageUp/Down would otherwise scroll the page
    if (isInRange(to)) void this._moveFocus(to);
  }

  // ---- render ----

  /** Today ± YEAR_SPAN, stretched to include the shown year if a typed date falls outside it. */
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

    // Highlight what the field says, so the calendar and the text never disagree
    const selected = parseDate(this._text);
    const now = today();

    return html`
      <div
        id="calendar"
        class="date-picker"
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
    // With a date set, the button says which one, for users who tab past the field (APG)
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
      <!-- The placeholder vanishes once you type, so the format also lives here, always visible -->
      <p id="hint" class="hint">${strings.hint}</p>
      <p id="error" class="error" role="alert">${this._shownProblem ? this._message(this._shownProblem) : ''}</p>
      ${this._isOpen ? this._renderCalendar() : nothing}
    `;
  }

  static styles = css`
    /*
     * Error color: 6.5:1 on white, 9.1:1 on #242424 (WCAG 1.4.3 needs 4.5:1). Follows the OS
     * theme; a page whose background doesn't match can set --date-picker-error-color.
     */
    /*
     * The host is as wide as the field (280px), not the calendar. The calendar floats via
     * Popper, centered under the field, so pages can center the host like any input.
     */
    :host {
      --_error: var(--date-picker-error-color, #b3261e);
      display: flex;
      flex-direction: column;
      width: 100%;
      max-width: 280px;
    }

    .label {
      margin-bottom: 4px;
    }

    @media (prefers-color-scheme: dark) {
      :host {
        --_error: var(--date-picker-error-color, #f2b8b5);
      }
    }

    .input-container {
      position: relative;
      display: flex;
      align-items: center;
    }

    /* min-height keeps the calendar button at least 24x24 (WCAG 2.5.8) */
    input {
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

    /* Inset by the button's 4px padding, which absolute positioning would otherwise ignore */
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
     * Popper floats this over the page, so it needs its own background. Canvas follows color-scheme.
     * Shrinks to fit narrow screens and 400% zoom (WCAG 1.4.10) instead of scrolling sideways.
     * Popper's preventOverflow keeps it on screen; max-height + overflow covers short viewports.
     */
    .date-picker {
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      font-size: 16px;
      width: min(400px, calc(100vw - 16px));
      max-height: calc(100vh - 16px);
      overflow-y: auto;
      padding: 8px;
      border: 1px solid currentColor;
      background: Canvas;
      color: CanvasText;
      z-index: 1;
    }

    .month-year__picker {
      display: flex;
      justify-content: space-between;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    th,
    td {
      border: 1px solid currentColor;
      padding: clamp(2px, 1vw, 10px);
      text-align: left;
      vertical-align: top;
    }

    th {
      font-weight: normal;
    }

    /* 100px on wide screens, never below 2.75rem (a comfortable touch target) */
    tbody td {
      height: clamp(2.75rem, 12vw, 100px);
      box-sizing: border-box;
    }

    .day {
      cursor: pointer;
    }

    /*
     * Two-tone ring: a CanvasText outline with a Canvas band inside it. Whatever the cell's
     * background (plain, or Highlight when selected), one of the two tones contrasts with it.
     * A single Highlight outline vanished on the selected day. Forced-colors mode drops the
     * box-shadow and keeps the outline
     */
    .day:focus-visible {
      outline: 2px solid CanvasText;
      outline-offset: -2px;
      box-shadow: inset 0 0 0 4px Canvas;
    }

    /* System colors, like Canvas above: they follow light/dark without a palette */
    .day[aria-selected='true'] {
      background: Highlight;
      color: HighlightText;
    }

    .day[aria-current='date'] {
      font-weight: bold;
    }

    /* Read by screen readers, invisible on screen */
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

declare global {
  interface HTMLElementTagNameMap {
    'date-picker': DatePicker;
  }
}
