// Type-level tests: `pnpm typecheck` fails if these stop holding. At runtime they do nothing
import { describe, expectTypeOf, it } from 'vitest';

import type { DatePicker, DatePickerChangeEvent } from './index.js';

describe('public types', () => {
  it('a change listener gets a typed event with detail.value', () => {
    const listen = (picker: DatePicker) =>
      picker.addEventListener('change', (event) => {
        expectTypeOf(event).toEqualTypeOf<DatePickerChangeEvent>();
        expectTypeOf(event.detail.value).toEqualTypeOf<string>();
      });
    expectTypeOf(listen).toBeFunction();
  });

  it('other events keep their usual types', () => {
    const listen = (picker: DatePicker) =>
      picker.addEventListener('focus', (event) => expectTypeOf(event).toEqualTypeOf<FocusEvent>());
    expectTypeOf(listen).toBeFunction();
  });

  it('the tag maps to the class, and isFieldValid is read-only', () => {
    expectTypeOf<HTMLElementTagNameMap['consistent-date-picker']>().toEqualTypeOf<DatePicker>();
    expectTypeOf<DatePicker['selectedDate']>().toEqualTypeOf<string>();
    // @ts-expect-error isFieldValid has no setter
    const write = (picker: DatePicker) => { picker.isFieldValid = true; };
    expectTypeOf(write).toBeFunction();
  });
});
