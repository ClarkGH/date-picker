import type { DefineComponent, HTMLAttributes } from 'vue';
import type { DatePicker, DatePickerChangeEvent } from './date-picker.js';
/** The element's settable properties, plus its event as an `on` prop, which is what `@change` checks against. */
export type DatePickerVueProps = Partial<Pick<DatePicker, 'selectedDate' | 'label' | 'name' | 'required' | 'disabled' | 'locale' | 'strings'>> & Omit<HTMLAttributes, 'onChange'> & {
    onChange?: (event: DatePickerChangeEvent) => void;
};
declare module 'vue' {
    interface GlobalComponents {
        'consistent-date-picker': DefineComponent<DatePickerVueProps>;
    }
}
