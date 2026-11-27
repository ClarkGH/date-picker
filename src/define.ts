import { DatePicker } from './date-picker.js';

export const TAG_NAME = 'consistent-date-picker';

/**
 * Registers `<consistent-date-picker>`. Safe to run twice, so two copies of the package don't crash the page.
 * To use another tag, import `DatePicker` from the main entry and register a subclass instead.
 */
export function defineDatePicker(): void {
  const existing = customElements.get(TAG_NAME);
  if (!existing) {
    customElements.define(TAG_NAME, DatePicker);
  } else if (existing !== DatePicker) {
    console.warn(`consistent-date-picker: <${TAG_NAME}> is already defined by something else, so this copy wasn't registered`);
  }
}

defineDatePicker();

declare global {
  interface HTMLElementTagNameMap {
    [TAG_NAME]: DatePicker;
  }
}
