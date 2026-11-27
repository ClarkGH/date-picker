import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';

import type { DatePicker } from './date-picker.js';
import { formatDate } from './date-utils.js';
import './define.js';

// Spy on Popper so the lifecycle (one create per open, one destroy per close) is observable.
// vi.mock is hoisted above the imports, so the spies it uses must be hoisted too
const { createPopper, destroy, forceUpdate } = vi.hoisted(() => {
  const destroySpy = vi.fn();
  const forceUpdateSpy = vi.fn();
  return {
    destroy: destroySpy,
    forceUpdate: forceUpdateSpy,
    createPopper: vi.fn(() => ({ destroy: destroySpy, forceUpdate: forceUpdateSpy })),
  };
});
vi.mock('@popperjs/core', () => ({ createPopper }));

type Picker = DatePicker;

async function mount(attrs: Partial<Pick<Picker, 'selectedDate'>> = {}): Promise<Picker> {
  const el = document.createElement('consistent-date-picker') as Picker;
  Object.assign(el, attrs);
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

function q<T extends Element>(el: Picker, selector: string): T {
  const found = el.shadowRoot!.querySelector<T>(selector);
  if (!found) throw new Error(`No ${selector} in shadow root`);
  return found;
}

async function typeAndBlur(el: Picker, text: string) {
  const input = q<HTMLInputElement>(el, 'input');
  input.value = text;
  input.dispatchEvent(new FocusEvent('blur'));
  await el.updateComplete;
}

async function typeWithoutBlur(el: Picker, text: string) {
  const input = q<HTMLInputElement>(el, 'input');
  input.value = text;
  input.dispatchEvent(new Event('input'));
  await el.updateComplete;
}

function selects(el: Picker): HTMLSelectElement[] {
  return Array.from(el.shadowRoot!.querySelectorAll('select'));
}

function highlightedDays(el: Picker): string[] {
  return Array.from(el.shadowRoot!.querySelectorAll('.day[aria-selected="true"]')).map((c) => c.textContent ?? '');
}

/** Opening awaits a render before Popper runs, so give it a turn after the click. */
async function openCalendar(el: Picker) {
  q<HTMLButtonElement>(el, 'button').click();
  await el.updateComplete;
  await Promise.resolve();
}

function dayCell(el: Picker, day: number): HTMLElement {
  const cell = Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('.day'))
    .find((c) => c.textContent === String(day));
  if (!cell) throw new Error(`No day ${day}`);
  return cell;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 24)); // Nov 24 2026
});

afterEach(() => {
  document.body.innerHTML = '';
  createPopper.mockClear();
  destroy.mockClear();
  forceUpdate.mockReset();
  vi.useRealTimers();
});

describe('typing a date', () => {
  it('commits a valid date and fires change once', async () => {
    const el = await mount();
    const onChange = vi.fn();
    el.addEventListener('change', onChange);

    await typeAndBlur(el, '04/03/2023');
    await typeAndBlur(el, '04/03/2023'); // same value again: no second event

    expect(el.selectedDate).toBe('04/03/2023');
    expect(el.isFieldValid).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect((onChange.mock.calls[0][0] as CustomEvent).detail).toEqual({ value: '04/03/2023' });
  });

  it('keeps invalid text, shows an error, and leaves the value alone', async () => {
    const el = await mount({ selectedDate: '01/01/2024' });

    await typeAndBlur(el, '02/30/2024');

    expect(q<HTMLInputElement>(el, 'input').value).toBe('02/30/2024');
    expect(q<HTMLInputElement>(el, 'input').getAttribute('aria-invalid')).toBe('true');
    expect(q(el, '.error').textContent).toBe('February 2024 has 29 days.');
    expect(el.selectedDate).toBe('01/01/2024');
    expect(el.isFieldValid).toBe(false);
  });

  it('recovers when the same valid date is retyped after an error', async () => {
    const el = await mount({ selectedDate: '01/01/2024' });
    await typeAndBlur(el, 'nope');
    await typeAndBlur(el, '01/01/2024');

    expect(el.isFieldValid).toBe(true);
    expect(q(el, '.error').textContent).toBe('');
  });

  it('isFieldValid is read-only and follows the text as you type', async () => {
    const el = await mount();
    expect(() => {
      (el as unknown as { isFieldValid: boolean }).isFieldValid = true;
    }).toThrow(TypeError);
    expect(el.isFieldValid).toBe(false);

    await typeWithoutBlur(el, '04/03/2023');
    expect(el.isFieldValid).toBe(true);
    await typeWithoutBlur(el, '04/03/20');
    expect(el.isFieldValid).toBe(false);
  });

  it('clearing the field clears the value without an error', async () => {
    const el = await mount({ selectedDate: '01/01/2024' });
    await typeAndBlur(el, '   ');

    expect(el.selectedDate).toBe('');
    expect(el.isFieldValid).toBe(false);
    expect(q(el, '.error').textContent).toBe('');
  });
});

describe('a value set from outside', () => {
  it('stores a loose date as MM/DD/YYYY, without a change event', async () => {
    const el = await mount();
    const onChange = vi.fn();
    el.addEventListener('change', onChange);

    el.selectedDate = '4/3/2023';
    await el.updateComplete;

    expect(el.selectedDate).toBe('04/03/2023');
    expect(q<HTMLInputElement>(el, 'input').value).toBe('04/03/2023');
    expect(el.isFieldValid).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('never keeps a value that is not a date, but shows it so it can be fixed', async () => {
    const el = await mount({ selectedDate: '01/01/2024' });
    const onChange = vi.fn();
    el.addEventListener('change', onChange);

    el.selectedDate = 'not a date';
    await el.updateComplete;

    expect(el.selectedDate).toBe('');
    expect(q<HTMLInputElement>(el, 'input').value).toBe('not a date');
    expect(el.isFieldValid).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('applies the same rules to the selecteddate attribute', async () => {
    const el = await mount();
    el.setAttribute('selecteddate', '02/30/2024');
    await el.updateComplete;
    expect(el.selectedDate).toBe('');

    el.setAttribute('selecteddate', '2.29.2024');
    await el.updateComplete;
    expect(el.selectedDate).toBe('02/29/2024');
  });
});

describe('the calendar', () => {
  it('opens on the current month with both dropdowns matching', async () => {
    const el = await mount();
    await openCalendar(el);

    const [month, year] = Array.from(el.shadowRoot!.querySelectorAll('select'));
    expect(month.value).toBe('11');
    expect(year.value).toBe('2026');
  });

  it('opens on the selected date, not today', async () => {
    const el = await mount({ selectedDate: '07/04/1999' });
    await openCalendar(el);

    const [month, year] = Array.from(el.shadowRoot!.querySelectorAll('select'));
    expect(month.value).toBe('7');
    expect(year.value).toBe('1999');
  });

  it('picking a day commits a padded date that survives a blur, then closes', async () => {
    const el = await mount();
    await openCalendar(el);

    dayCell(el, 3).click();
    await el.updateComplete;

    expect(el.selectedDate).toBe('11/03/2026');
    expect(el.shadowRoot!.querySelector('.date-picker')).toBeNull();

    // The original bug: the calendar wrote 11/3/2026, then blur rejected it and wiped the field
    q<HTMLInputElement>(el, 'input').dispatchEvent(new FocusEvent('blur'));
    await el.updateComplete;
    expect(el.selectedDate).toBe('11/03/2026');
    expect(q<HTMLInputElement>(el, 'input').value).toBe('11/03/2026');
  });

  it('picking a day overwrites half-typed text in the input', async () => {
    const el = await mount({ selectedDate: '11/03/2026' });
    await openCalendar(el);
    q<HTMLInputElement>(el, 'input').value = 'junk';

    dayCell(el, 3).click();
    await el.updateComplete;

    expect(q<HTMLInputElement>(el, 'input').value).toBe('11/03/2026');
  });

  it('changing month and year redraws the grid', async () => {
    const el = await mount();
    await openCalendar(el);
    const [month, year] = Array.from(el.shadowRoot!.querySelectorAll('select'));

    month.value = '2';
    month.dispatchEvent(new Event('change'));
    year.value = '2024';
    year.dispatchEvent(new Event('change'));
    await el.updateComplete;

    expect(el.shadowRoot!.querySelectorAll('.day')).toHaveLength(29);
  });

  it('stretches the year list to include a typed year outside the range', async () => {
    const el = await mount({ selectedDate: '01/01/0050' });
    await openCalendar(el);

    const year = el.shadowRoot!.querySelectorAll('select')[1];
    expect(year.value).toBe('50');
  });
});

describe('popper lifecycle', () => {
  it('creates one instance per open against the rendered calendar', async () => {
    const el = await mount();
    await openCalendar(el);

    expect(createPopper).toHaveBeenCalledTimes(1);
    const [, popperEl] = createPopper.mock.calls[0] as unknown as [Element, Element];
    expect(popperEl).toBe(el.shadowRoot!.querySelector('.date-picker'));
  });

  it('destroys on close, and does not create a new instance when closing', async () => {
    const el = await mount();
    await openCalendar(el);
    await openCalendar(el); // second click closes

    expect(createPopper).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('a rapid open-close-open makes only one instance', async () => {
    const el = await mount();
    const button = q<HTMLButtonElement>(el, 'button');
    button.click();
    button.click();
    button.click();
    await el.updateComplete;
    await Promise.resolve();

    expect(createPopper).toHaveBeenCalledTimes(1);
  });

  it('destroys when the element is removed from the page', async () => {
    const el = await mount();
    await openCalendar(el);
    el.remove();

    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('still opens if Popper throws', async () => {
    createPopper.mockImplementationOnce(() => { throw new Error('boom'); });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const el = await mount();
    await openCalendar(el);

    expect(el.shadowRoot!.querySelector('.date-picker')).not.toBeNull();
    expect(error).toHaveBeenCalled();
  });
});

describe('typing while the calendar is open', () => {
  it('moves the view to a complete date without committing it', async () => {
    const el = await mount();
    const onChange = vi.fn();
    el.addEventListener('change', onChange);
    await openCalendar(el);

    await typeWithoutBlur(el, '07/04/1999');

    const [month, year] = selects(el);
    expect(month.value).toBe('7');
    expect(year.value).toBe('1999');
    expect(highlightedDays(el)).toEqual(['4']);
    expect(el.selectedDate).toBe('');
    expect(onChange).not.toHaveBeenCalled();
    expect(q(el, '.error').textContent).toBe('');
  });

  it('ignores partial and impossible dates', async () => {
    const el = await mount();
    await openCalendar(el);

    await typeWithoutBlur(el, '07/04/19');
    await typeWithoutBlur(el, '02/30/2024');

    expect(selects(el)[0].value).toBe('11');
    expect(highlightedDays(el)).toEqual([]);
  });

  it('keeps the month dropdown in sync after the user has picked months by hand', async () => {
    // Once an <option> is picked by hand, the browser ignores its `selected` attribute.
    // The `selected` property still works, so we bind that
    const el = await mount();
    await openCalendar(el);
    const month = selects(el)[0];

    month.value = '7';
    month.dispatchEvent(new Event('change'));
    await el.updateComplete;
    month.value = '8';
    month.dispatchEvent(new Event('change'));
    await el.updateComplete;

    await typeWithoutBlur(el, '07/15/2026');

    expect(month.value).toBe('7');
    expect(el.shadowRoot!.querySelectorAll('.day')).toHaveLength(31);
  });
});

describe('the selected day', () => {
  it('is highlighted when the calendar opens', async () => {
    const el = await mount({ selectedDate: '11/03/2026' });
    await openCalendar(el);

    expect(highlightedDays(el)).toEqual(['3']);
  });

  it('is not highlighted in other months', async () => {
    const el = await mount({ selectedDate: '11/03/2026' });
    await openCalendar(el);
    const month = selects(el)[0];

    month.value = '10';
    month.dispatchEvent(new Event('change'));
    await el.updateComplete;

    expect(highlightedDays(el)).toEqual([]);
  });
});

function focused(el: Picker): Element | null {
  return el.shadowRoot!.activeElement;
}

/** Sends a key to whatever has focus inside the component, then lets focus moves settle. */
async function press(el: Picker, key: string, init: KeyboardEventInit = {}) {
  const target = focused(el);
  if (!target) throw new Error('Nothing focused inside the component');
  target.dispatchEvent(new KeyboardEvent('keydown', {
    key, bubbles: true, composed: true, cancelable: true, ...init,
  }));
  await el.updateComplete;
  await Promise.resolve();
}

/** "11/24/2026" style read of the focused cell, using the dropdowns for month and year. */
function focusedDate(el: Picker): string {
  const [month, year] = selects(el);
  const cell = focused(el);
  if (!cell || !cell.classList.contains('day')) return `not a day: ${cell?.tagName}`;
  return formatDate({ year: Number(year.value), month: Number(month.value), day: Number(cell.textContent) });
}

describe('keyboard: opening and closing', () => {
  it('opening focuses today when the field is empty', async () => {
    const el = await mount();
    await openCalendar(el);

    expect(focusedDate(el)).toBe('11/24/2026');
  });

  it('opening focuses the selected date', async () => {
    const el = await mount({ selectedDate: '07/04/1999' });
    await openCalendar(el);

    expect(focusedDate(el)).toBe('07/04/1999');
  });

  it('has exactly one tab stop in the grid', async () => {
    const el = await mount();
    await openCalendar(el);

    expect(el.shadowRoot!.querySelectorAll('td[tabindex="0"]')).toHaveLength(1);
  });

  it('Escape closes without committing and returns focus to the button', async () => {
    const el = await mount({ selectedDate: '11/03/2026' });
    await openCalendar(el);
    await press(el, 'ArrowRight');

    await press(el, 'Escape');

    expect(el.shadowRoot!.querySelector('.date-picker')).toBeNull();
    expect(focused(el)).toBe(q(el, '.toggle'));
    expect(el.selectedDate).toBe('11/03/2026');
  });

  it('Escape in the text field closes and leaves focus in the field', async () => {
    const el = await mount();
    await openCalendar(el);
    q<HTMLInputElement>(el, 'input').focus();

    await press(el, 'Escape');

    expect(el.shadowRoot!.querySelector('.date-picker')).toBeNull();
    expect(focused(el)).toBe(q(el, 'input'));
  });

  it('a pointerdown outside closes; one inside does not', async () => {
    const el = await mount();
    await openCalendar(el);

    q(el, '.date-picker').dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.date-picker')).not.toBeNull();

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.date-picker')).toBeNull();
  });

  it('stops listening to the document once closed', async () => {
    const remove = vi.spyOn(document, 'removeEventListener');
    const el = await mount();
    await openCalendar(el);
    await press(el, 'Escape');

    expect(remove).toHaveBeenCalledWith('pointerdown', expect.any(Function));
  });

  it('the button reports whether the calendar is open', async () => {
    const el = await mount();
    const button = q(el, '.toggle');
    expect(button.getAttribute('aria-expanded')).toBe('false');

    await openCalendar(el);
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });
});

describe('keyboard: moving in the grid', () => {
  it.each([
    ['ArrowRight', {}, '11/25/2026'],
    ['ArrowLeft', {}, '11/23/2026'],
    ['ArrowDown', {}, '12/01/2026'], // crosses into December
    ['ArrowUp', {}, '11/17/2026'],
    ['Home', {}, '11/22/2026'], // Sunday of that week
    ['End', {}, '11/28/2026'], // Saturday of that week
    ['PageDown', {}, '12/24/2026'],
    ['PageUp', {}, '10/24/2026'],
    ['PageDown', { shiftKey: true }, '11/24/2027'],
    ['PageUp', { shiftKey: true }, '11/24/2025'],
  ])('%s %o from 11/24/2026 goes to %s', async (key, init, expected) => {
    const el = await mount();
    await openCalendar(el);

    await press(el, key, init);

    expect(focusedDate(el)).toBe(expected);
  });

  it('PageDown from Jan 31 clamps to the end of February', async () => {
    const el = await mount({ selectedDate: '01/31/2024' });
    await openCalendar(el);

    await press(el, 'PageDown');

    expect(focusedDate(el)).toBe('02/29/2024');
  });

  it('ArrowLeft from Jan 1 goes back a year', async () => {
    const el = await mount({ selectedDate: '01/01/2025' });
    await openCalendar(el);

    await press(el, 'ArrowLeft');

    expect(focusedDate(el)).toBe('12/31/2024');
  });

  it('stops at year 1, since year 0 is 1 BC', async () => {
    const el = await mount({ selectedDate: '01/01/0001' });
    await openCalendar(el);

    await press(el, 'ArrowLeft');

    expect(focusedDate(el)).toBe('01/01/0001');
  });

  it('rejects typed year 0 with its own message', async () => {
    const el = await mount();
    await typeAndBlur(el, '01/01/0000');

    expect(el.selectedDate).toBe('');
    expect(q(el, '.error').textContent).toBe('The year must be from 1 to 9999.');
  });

  it('names the year it shows: year 1, not year 0', async () => {
    const el = await mount({ selectedDate: '01/01/0001' });
    expect(q(el, '.toggle').getAttribute('aria-label')).toBe('Change date, January 1, 1');
  });

  it('moving focus does not change the value', async () => {
    const el = await mount({ selectedDate: '11/03/2026' });
    await openCalendar(el);

    await press(el, 'ArrowRight');

    expect(el.selectedDate).toBe('11/03/2026');
    expect(highlightedDays(el)).toEqual(['3']);
  });

  it('changing month with the dropdown keeps the focus day inside the month', async () => {
    const el = await mount({ selectedDate: '01/31/2024' });
    await openCalendar(el);
    const month = selects(el)[0];

    month.value = '2';
    month.dispatchEvent(new Event('change'));
    await el.updateComplete;

    const stop = el.shadowRoot!.querySelector('td[tabindex="0"]');
    expect(stop?.textContent).toBe('29');
  });
});

describe('keyboard: choosing a day', () => {
  it.each(['Enter', ' '])('%j picks the focused day, closes, and returns focus', async (key) => {
    const el = await mount();
    const onChange = vi.fn();
    el.addEventListener('change', onChange);
    await openCalendar(el);
    await press(el, 'ArrowRight');

    await press(el, key);

    expect(el.selectedDate).toBe('11/25/2026');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(el.shadowRoot!.querySelector('.date-picker')).toBeNull();
    expect(focused(el)).toBe(q(el, '.toggle'));
  });

  it('Enter and arrows are not left to the browser (no page scroll)', async () => {
    const el = await mount();
    await openCalendar(el);
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowDown', bubbles: true, composed: true, cancelable: true,
    });

    focused(el)!.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });
});

describe('non-modal: focus can leave the calendar', () => {
  /** What the browser sends when focus moves from `from` to `to`. */
  function moveFocusOut(from: Element, to: Element | null) {
    from.dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true, relatedTarget: to }));
  }

  it('closes when focus moves to something outside the component', async () => {
    const after = document.createElement('button');
    document.body.appendChild(after);
    const el = await mount();
    await openCalendar(el);

    moveFocusOut(focused(el)!, after);
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('.date-picker')).toBeNull();
  });

  it('stays open when focus moves between its own parts', async () => {
    const el = await mount();
    await openCalendar(el);

    // Inside one shadow root, the browser retargets relatedTarget to the host
    moveFocusOut(focused(el)!, el);
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('.date-picker')).not.toBeNull();
  });

  it('stays open when the window loses focus (relatedTarget is null)', async () => {
    const el = await mount();
    await openCalendar(el);

    moveFocusOut(focused(el)!, null);
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('.date-picker')).not.toBeNull();
  });

  it('Tab is left to the browser instead of being trapped', async () => {
    const el = await mount();
    await openCalendar(el);
    const event = new KeyboardEvent('keydown', {
      key: 'Tab', bubbles: true, composed: true, cancelable: true,
    });

    focused(el)!.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it('typing in the field while open keeps the calendar open and following', async () => {
    const el = await mount();
    await openCalendar(el);
    q<HTMLInputElement>(el, 'input').focus();

    await typeWithoutBlur(el, '07/04/1999');

    expect(el.shadowRoot!.querySelector('.date-picker')).not.toBeNull();
    expect(highlightedDays(el)).toEqual(['4']);
  });
});

describe('combobox keys on the input', () => {
  it.each([{}, { altKey: true }])('ArrowDown %o opens the calendar and focuses the grid', async (init) => {
    const el = await mount({ selectedDate: '11/03/2026' });
    q<HTMLInputElement>(el, 'input').focus();

    await press(el, 'ArrowDown', init);
    await el.updateComplete;
    await Promise.resolve();

    expect(focusedDate(el)).toBe('11/03/2026');
  });

  it('ArrowDown while open moves focus into the grid without reopening', async () => {
    const el = await mount();
    await openCalendar(el);
    q<HTMLInputElement>(el, 'input').focus();

    await press(el, 'ArrowDown');

    expect(focusedDate(el)).toBe('11/24/2026');
    expect(createPopper).toHaveBeenCalledTimes(1);
  });

  it('Escape on the button closes and keeps focus on the button', async () => {
    const el = await mount();
    await openCalendar(el);
    q<HTMLButtonElement>(el, '.toggle').focus();

    await press(el, 'Escape');

    expect(el.shadowRoot!.querySelector('.date-picker')).toBeNull();
    expect(focused(el)).toBe(q(el, '.toggle'));
  });
});

describe('opening does not jump the page', () => {
  it('positions the calendar before moving focus into it', async () => {
    const el = await mount();
    let focusedWhenPositioned: Element | null | undefined;
    forceUpdate.mockImplementation(() => { focusedWhenPositioned = focused(el); });

    await openCalendar(el);

    expect(forceUpdate).toHaveBeenCalledTimes(1);
    expect(focusedWhenPositioned?.classList.contains('day')).not.toBe(true);
    expect(focused(el)?.classList.contains('day')).toBe(true);
  });
});

describe('accessible names and states', () => {
  it('labels the input, button, dropdowns, dialog, and grid', async () => {
    const el = await mount();
    el.label = 'Start date';
    await openCalendar(el);

    // A visible <label> names the input, so the visible text and the spoken name always match
    const label = q<HTMLLabelElement>(el, 'label');
    expect(label.textContent).toBe('Start date');
    expect(label.htmlFor).toBe(q(el, 'input').id);
    expect(q(el, 'input').hasAttribute('aria-label')).toBe(false);
    expect(q(el, '.toggle').getAttribute('aria-label')).toBe('Choose date');
    expect(q(el, '.toggle').getAttribute('aria-haspopup')).toBe('dialog');
    expect(selects(el).map((s) => s.getAttribute('aria-label'))).toEqual(['Month', 'Year']);
    expect(q(el, '[role="dialog"]').hasAttribute('aria-modal')).toBe(false);
    expect(q(el, '#calendar-heading').tagName).toBe('DIV'); // not a heading in the page outline
    expect(q(el, '#calendar-heading').textContent?.trim()).toBe('November 2026');
  });

  it('the input is a combobox wired to the calendar and the hint', async () => {
    const el = await mount();
    const input = q(el, 'input');
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-haspopup')).toBe('dialog');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.getAttribute('aria-describedby')).toBe('hint error');
    expect(q(el, '#hint').textContent).toContain('MM/DD/YYYY');

    await openCalendar(el);
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(el.shadowRoot!.getElementById(input.getAttribute('aria-controls')!)?.getAttribute('role'))
      .toBe('dialog');
  });

  it('marks today with aria-current and the selected day with aria-selected', async () => {
    const el = await mount({ selectedDate: '11/03/2026' });
    await openCalendar(el);

    expect(q(el, '[aria-current="date"]').textContent).toBe('24');
    expect(q(el, '[aria-selected="true"]').textContent).toBe('3');
    expect(el.shadowRoot!.querySelectorAll('[aria-selected]')).toHaveLength(1);
  });

  it('gives weekday headers their full names', async () => {
    const el = await mount();
    await openCalendar(el);

    expect(q(el, 'th').getAttribute('abbr')).toBe('Sunday');
  });
});

describe('looser typing', () => {
  it.each(['4/3/2023', '4-3-2023', '4.3.2023'])('%j commits as 04/03/2023', async (text) => {
    const el = await mount();
    await typeAndBlur(el, text);

    expect(el.selectedDate).toBe('04/03/2023');
    expect(q<HTMLInputElement>(el, 'input').value).toBe('04/03/2023');
  });

  it.each([
    ['4/3/23', 'Use a four-digit year, like 2023.'],
    ['13/01/2024', 'The month must be from 1 to 12.'],
    ['02/29/2023', 'February 2023 has 28 days.'],
    ['soon', 'Enter the date as MM/DD/YYYY, like 04/03/2023.'],
  ])('%j explains what is wrong', async (text, message) => {
    const el = await mount();
    await typeAndBlur(el, text);

    expect(q(el, '.error').textContent).toBe(message);
  });
});

describe('required and disabled', () => {
  it('a required field left empty says so on blur', async () => {
    const el = await mount();
    el.required = true;
    await el.updateComplete;

    await typeAndBlur(el, '');

    expect(q(el, '.error').textContent).toBe('Enter a date.');
    expect(q(el, 'input').getAttribute('aria-invalid')).toBe('true');
    expect(q<HTMLInputElement>(el, 'input').required).toBe(true);
  });

  it('disabled disables the field and button and will not open', async () => {
    const el = await mount();
    el.disabled = true;
    await el.updateComplete;

    expect(q<HTMLInputElement>(el, 'input').disabled).toBe(true);
    expect(q<HTMLButtonElement>(el, '.toggle').disabled).toBe(true);
    q<HTMLInputElement>(el, 'input').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.date-picker')).toBeNull();
  });

  it('becoming disabled while open closes the calendar', async () => {
    const el = await mount();
    await openCalendar(el);

    el.disabled = true;
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('.date-picker')).toBeNull();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('a disabled fieldset disables it too (formDisabledCallback)', async () => {
    const el = await mount();
    el.formDisabledCallback(true);
    await el.updateComplete;

    expect(q<HTMLInputElement>(el, 'input').disabled).toBe(true);
  });

  it('form reset goes back to the selecteddate attribute, without a change event', async () => {
    const el = document.createElement('consistent-date-picker');
    el.setAttribute('selecteddate', '07/04/1999');
    document.body.appendChild(el);
    await el.updateComplete;
    const onChange = vi.fn();
    el.addEventListener('change', onChange);
    await typeAndBlur(el, '01/01/2020');
    await typeAndBlur(el, 'junk');

    el.formResetCallback();
    await el.updateComplete;

    expect(el.selectedDate).toBe('07/04/1999');
    expect(q<HTMLInputElement>(el, 'input').value).toBe('07/04/1999');
    expect(q(el, '.error').textContent).toBe('');
    expect(onChange).toHaveBeenCalledTimes(1); // only the 01/01/2020 commit
  });
});

describe('the calendar button', () => {
  it('names the current date once one is set', async () => {
    const el = await mount();
    const button = q(el, '.toggle');
    expect(button.getAttribute('aria-label')).toBe('Choose date');

    await typeAndBlur(el, '11/03/2026');

    expect(button.getAttribute('aria-label')).toBe('Change date, November 3, 2026');
  });
});

describe('locale and strings', () => {
  it('names months and weekdays in the given locale', async () => {
    const el = await mount();
    el.locale = 'fr-FR';
    await openCalendar(el);

    expect(selects(el)[0].selectedOptions[0].textContent).toBe('novembre');
    expect(q(el, 'th').getAttribute('abbr')).toBe('dimanche');
    expect(q(el, '#calendar-heading').textContent?.trim()).toBe('novembre 2026');
  });

  it('falls back to en-US for an invalid locale and warns once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = await mount();
    el.locale = 'not a locale';
    await openCalendar(el);
    await press(el, 'ArrowRight');

    expect(selects(el)[0].selectedOptions[0].textContent).toBe('November');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('checks the locale once per change, not on every render', async () => {
    const check = vi.spyOn(Intl.DateTimeFormat, 'supportedLocalesOf');
    try {
      const el = await mount();
      el.locale = 'fr-FR';
      await openCalendar(el);
      await press(el, 'ArrowRight');
      await typeWithoutBlur(el, '11/05/2026');
      // An empty, closed picker never reads the locale, so en-US was never checked
      expect(check.mock.calls.map(([tag]) => tag)).toEqual(['fr-FR']);

      el.locale = 'de-DE';
      await el.updateComplete;
      expect(check.mock.calls.map(([tag]) => tag)).toEqual(['fr-FR', 'de-DE']);
    } finally {
      check.mockRestore();
    }
  });

  it('uses overridden strings, including a single error', async () => {
    const el = await mount();
    el.strings = {
      hint: 'Format : MM/JJ/AAAA',
      chooseDate: 'Choisir une date',
      errors: { twoDigitYear: 'Année à quatre chiffres.' },
    };
    await el.updateComplete;

    expect(q(el, '#hint').textContent).toBe('Format : MM/JJ/AAAA');
    expect(q(el, '.toggle').getAttribute('aria-label')).toBe('Choisir une date');
    await typeAndBlur(el, '4/3/23');
    expect(q(el, '.error').textContent).toBe('Année à quatre chiffres.');
    await typeAndBlur(el, '13/01/2024');
    expect(q(el, '.error').textContent).toBe('The month must be from 1 to 12.'); // default kept
  });
});

describe('year list', () => {
  it('spans 100 years either side of today', async () => {
    const el = await mount();
    await openCalendar(el);
    const years = Array.from(selects(el)[1].options).map((o) => Number(o.value));

    expect(years[0]).toBe(1926);
    expect(years[years.length - 1]).toBe(2126);
  });
});


describe('styling parts', () => {
  const partsOf = (el: Picker, name: string) => Array.from(el.shadowRoot!.querySelectorAll(`[part~="${name}"]`));

  it('names every styleable piece of the field', async () => {
    const el = await mount();
    for (const name of ['label', 'input', 'button', 'hint', 'error']) expect(partsOf(el, name), name).toHaveLength(1);
  });

  it('names the calendar pieces, and marks the selected day, today and blank cells', async () => {
    const el = await mount({ selectedDate: '11/03/2026' }); // today is frozen at 11/24/2026
    await openCalendar(el);

    for (const name of ['calendar', 'header', 'month', 'year', 'grid']) expect(partsOf(el, name), name).toHaveLength(1);
    expect(partsOf(el, 'weekday')).toHaveLength(7);
    expect(partsOf(el, 'day')).toHaveLength(30);
    expect(partsOf(el, 'empty')).toHaveLength(5); // November 2026 starts on a Sunday: 30 days in 35 cells
    expect(partsOf(el, 'selected').map((c) => c.textContent)).toEqual(['3']);
    expect(partsOf(el, 'today').map((c) => c.textContent)).toEqual(['24']);
    expect(partsOf(el, 'selected')[0].getAttribute('part')).toBe('day selected');
  });

  it('moves the selected part with the typed date', async () => {
    const el = await mount({ selectedDate: '11/03/2026' });
    await openCalendar(el);
    await typeWithoutBlur(el, '11/24/2026');

    expect(partsOf(el, 'selected')[0].getAttribute('part')).toBe('day selected today');
  });
});
