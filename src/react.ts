import * as React from 'react';
import { createComponent, type EventName } from '@lit/react';

import { DatePicker as DatePickerElement, type DatePickerChangeEvent } from './date-picker.js';
import { TAG_NAME } from './define.js';

/**
 * `<consistent-date-picker>` as a React component, for React 18 and up. Importing this registers
 * the tag. Props are set as properties, and `onDateChange` gets the real event, with
 * `event.detail.value`. React 19 apps can use the bare tag instead; see docs/usage.md.
 */
export const DatePicker = createComponent({
  react: React,
  tagName: TAG_NAME,
  elementClass: DatePickerElement,
  events: {
    onDateChange: 'change' as EventName<DatePickerChangeEvent>,
  },
  displayName: 'DatePicker',
});
