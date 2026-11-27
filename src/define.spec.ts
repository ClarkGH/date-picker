import { describe, expect, it, vi } from 'vitest';

import { DatePicker } from './index.js';
import { TAG_NAME, defineDatePicker } from './define.js';

describe('registering the tag', () => {
  it('importing /define registers <consistent-date-picker> as DatePicker', () => {
    expect(customElements.get(TAG_NAME)).toBe(DatePicker);
    expect(document.createElement(TAG_NAME)).toBeInstanceOf(DatePicker);
  });

  it('running it again does nothing, without throwing or warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => defineDatePicker()).not.toThrow();
    expect(warn).not.toHaveBeenCalled();
  });

  it('a second copy of the package warns instead of crashing the page', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.resetModules(); // the next import loads fresh modules, like a second copy would
    await expect(import('./define.js')).resolves.toBeDefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('already defined by something else'));
    expect(customElements.get(TAG_NAME)).toBe(DatePicker); // the first copy keeps the tag
  });

  it('the main entry registers nothing on its own', async () => {
    vi.resetModules();
    const define = vi.spyOn(customElements, 'define');
    await import('./index.js');
    expect(define).not.toHaveBeenCalled();
  });

  it('a subclass can be registered under another tag, and still works', async () => {
    customElements.define('my-date-field', class extends DatePicker {});
    const el = document.createElement('my-date-field') as DatePicker;
    document.body.appendChild(el);
    el.selectedDate = '4/3/2023';
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('input')!.value).toBe('04/03/2023');
    el.remove();
  });
});
