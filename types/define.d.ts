import { DatePicker } from './date-picker.js';
export declare const TAG_NAME = "consistent-date-picker";
/**
 * Registers `<consistent-date-picker>`. Safe to run twice, so two copies of the package don't crash the page.
 * To use another tag, import `DatePicker` from the main entry and register a subclass instead.
 */
export declare function defineDatePicker(): void;
declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: DatePicker;
    }
}
