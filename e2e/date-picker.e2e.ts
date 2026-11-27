import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** Frozen "today", the same as the Vitest specs. */
async function freezeToday(page: Page) {
  await page.clock.setFixedTime(new Date(2026, 10, 24, 12));
}

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  // Print the details when it fails, not just a count
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
}

const picker = (page: Page, id = 'plain') => page.locator(`#${id}`);

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`axe, ${colorScheme} mode`, () => {
    test.use({ colorScheme });

    test('demo page, calendar closed', async ({ page }) => {
      await page.goto('/');
      await axe(page);
    });

    test('demo page, calendar open on a selected date', async ({ page }) => {
      await freezeToday(page);
      await page.goto('/');
      const input = page.locator('consistent-date-picker input');
      await input.fill('11/03/2026');
      await input.press('ArrowDown');
      await expect(page.locator('consistent-date-picker [role="grid"]')).toBeVisible();
      await axe(page);
    });

    test('demo page, error showing', async ({ page }) => {
      await page.goto('/');
      const input = page.locator('consistent-date-picker input');
      await input.fill('02/30/2024');
      await input.blur();
      await expect(page.locator('consistent-date-picker .error')).toHaveText('February 2024 has 29 days.');
      await axe(page);
    });

    test('the focus ring stands out on the selected day', async ({ page }) => {
      await freezeToday(page);
      await page.goto('/');
      const input = page.locator('consistent-date-picker input');
      await input.fill('11/03/2026');
      await input.press('ArrowDown');
      const cell = page.locator('consistent-date-picker td[aria-selected="true"]');
      await expect(cell).toBeFocused();

      const style = await cell.evaluate((el) => {
        const s = getComputedStyle(el);
        return { outline: s.outlineColor, outlineStyle: s.outlineStyle, background: s.backgroundColor, shadow: s.boxShadow };
      });
      expect(style.outlineStyle).toBe('solid');
      expect(style.outline).not.toBe(style.background);
      expect(style.shadow).not.toBe('none');
    });
  });
}

test.describe('styling', () => {
  /** Opens a picker and reads the calendar's and the selected day's computed styles. */
  async function openAndRead(root: ReturnType<typeof picker>) {
    await root.locator('input').press('ArrowDown');
    const cell = root.locator('td[aria-selected="true"]');
    await expect(cell).toBeFocused();
    const calendar = await root.locator('.date-picker').evaluate((el) => {
      const s = getComputedStyle(el);
      return { fontSize: s.fontSize, background: s.backgroundColor, color: s.color, border: s.borderTopColor, radius: s.borderTopLeftRadius };
    });
    const day = await cell.evaluate((el) => {
      const s = getComputedStyle(el);
      return { background: s.backgroundColor, color: s.color, border: s.borderTopColor };
    });
    return { calendar, day };
  }

  /** What a system color like `Highlight` resolves to on this page. */
  const systemColor = (page: Page, keyword: string) =>
    page.evaluate((k) => {
      const probe = document.body.appendChild(document.createElement('div'));
      probe.style.color = k;
      const value = getComputedStyle(probe).color;
      probe.remove();
      return value;
    }, keyword);

  test('with no custom properties set, it looks the same as before', async ({ page }) => {
    await page.goto('/');
    await page.locator('consistent-date-picker input').fill('11/03/2026');
    const { calendar, day } = await openAndRead(page.locator('consistent-date-picker'));

    expect(calendar.fontSize).toBe('16px');
    expect(calendar.background).toBe(await systemColor(page, 'Canvas'));
    expect(calendar.color).toBe(await systemColor(page, 'CanvasText'));
    expect(calendar.border).toBe(calendar.color); // currentColor
    expect(calendar.radius).toBe('0px');
    expect(day.background).toBe(await systemColor(page, 'Highlight'));
    expect(day.color).toBe(await systemColor(page, 'HighlightText'));
  });

  test('the calendar follows the root font size (rem, not px)', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => (document.documentElement.style.fontSize = '24px'));
    await page.locator('consistent-date-picker input').press('ArrowDown');
    await expect(page.locator('consistent-date-picker .date-picker')).toHaveCSS('font-size', '24px');
  });

  test('the text field uses the font set on the element', async ({ page }) => {
    await page.goto('/');
    const host = page.locator('consistent-date-picker');
    await host.evaluate((el: HTMLElement) => {
      el.style.fontFamily = 'monospace';
      el.style.fontSize = '22px';
    });
    const input = host.locator('input');
    await expect(input).toHaveCSS('font-size', '22px');
    await expect(input).toHaveCSS('font-family', 'monospace');
  });

  test('every custom property reaches the calendar', async ({ page }) => {
    await page.goto('/e2e/fixture.html');
    const { calendar, day } = await openAndRead(picker(page, 'themed'));

    expect(calendar).toEqual({
      fontSize: '20px',
      background: 'rgb(255, 250, 240)',
      color: 'rgb(20, 20, 20)',
      border: 'rgb(120, 120, 120)',
      radius: '12px',
    });
    expect(day).toEqual({ background: 'rgb(98, 0, 238)', color: 'rgb(255, 255, 255)', border: 'rgb(120, 120, 120)' });
    await expect(picker(page, 'themed').locator('select#month')).toHaveCSS('font-size', '20px');
    await expect(picker(page, 'themed').locator('select#year')).toHaveCSS('font-size', '20px');
  });

  test('the focus ring ignores the theme', async ({ page }) => {
    await page.goto('/e2e/fixture.html');
    await picker(page, 'themed').locator('input').press('ArrowDown');
    const cell = picker(page, 'themed').locator('td[aria-selected="true"]');
    await expect(cell).toBeFocused();
    expect(await cell.evaluate((el) => getComputedStyle(el).outlineColor)).toBe(await systemColor(page, 'CanvasText'));
  });
});

test.describe('layout', () => {
  test('fits a 320px viewport (400% zoom) without sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/');
    await page.locator('consistent-date-picker input').press('ArrowDown');
    await expect(page.locator('consistent-date-picker [role="grid"]')).toBeVisible();

    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth);

    const box = await page.locator('consistent-date-picker .date-picker').boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  });

  test('the calendar escapes an overflow: hidden parent and stacks above a z-index: 100 sibling', async ({ page }) => {
    await page.goto('/e2e/fixture.html');
    const input = picker(page, 'clipped').locator('input');
    await input.scrollIntoViewIfNeeded();
    await input.press('ArrowDown');
    await expect(picker(page, 'clipped').locator('td[tabindex="0"]')).toBeFocused();

    const calendar = (await picker(page, 'clipped').locator('.date-picker').boundingBox())!;
    const clipper = (await page.locator('#clipper').boundingBox())!;
    // A point in the calendar, below the clipping parent and over the cover
    const x = calendar.x + calendar.width / 2;
    const y = Math.min(clipper.y + clipper.height + 40, calendar.y + calendar.height - 10);
    expect(y).toBeGreaterThan(clipper.y + clipper.height);
    const hit = await page.evaluate(([px, py]) => document.elementFromPoint(px, py)?.id, [x, y]);
    expect(hit).toBe('clipped'); // the host, since shadow DOM retargets
  });

  test('the calendar button is at least 24x24 (WCAG 2.5.8)', async ({ page }) => {
    await page.goto('/');
    const box = await page.locator('consistent-date-picker .toggle').boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(24);
    expect(box!.height).toBeGreaterThanOrEqual(24);
  });

  test('the field is centered on the demo page', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    const box = await page.locator('consistent-date-picker input').boundingBox();
    const fieldCenter = box!.x + box!.width / 2;
    expect(Math.abs(fieldCenter - 640)).toBeLessThan(2);
  });

  test('opening positions the calendar before focusing it (no jump toward the page top)', async ({ page }) => {
    // Focusing before Popper positions it scrolled the page up to a temporary spot.
    // Scrolling down to the focused day is fine (the calendar is taller than the viewport)
    await page.goto('/e2e/fixture.html');
    const input = picker(page, 'far').locator('input');
    await input.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => window.scrollY);

    await input.press('ArrowDown');
    const cell = picker(page, 'far').locator('td[tabindex="0"]');
    await expect(cell).toBeFocused();

    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThanOrEqual(before);
    const field = (await picker(page, 'far').locator('.input-container').boundingBox())!;
    const calendar = (await picker(page, 'far').locator('.date-picker').boundingBox())!;
    // Popper placed it directly below the field, 8px offset
    expect(Math.abs(calendar.y - (field.y + field.height) - 8)).toBeLessThan(2);
    await expect(cell).toBeInViewport();
  });
});

test.describe('focus', () => {
  test('picker.focus() focuses the input (delegatesFocus)', async ({ page }) => {
    await page.goto('/e2e/fixture.html');
    await picker(page).evaluate((el) => (el as HTMLElement).focus());
    await expect(picker(page).locator('input')).toBeFocused();
  });

  test('clicking the label focuses the input', async ({ page }) => {
    await page.goto('/e2e/fixture.html');
    await picker(page).locator('label').click();
    await expect(picker(page).locator('input')).toBeFocused();
  });

  test('keyboard only: Tab in, open, move, pick', async ({ page }) => {
    await freezeToday(page);
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.locator('consistent-date-picker input')).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('PageDown');
    await page.keyboard.press('Enter');

    await expect(page.locator('consistent-date-picker input')).toHaveValue('12/25/2026');
    await expect(page.locator('consistent-date-picker .toggle')).toBeFocused();
  });
});

test.describe('forms', () => {
  test('Enter commits looser input and submits the form with the normalized value', async ({ page }) => {
    await page.goto('/e2e/fixture.html');
    await picker(page, 'required').locator('input').fill('01/02/2030');
    const input = picker(page).locator('input');
    await input.fill('4/3/2023');

    await input.press('Enter');

    await expect.poll(() => page.evaluate(() => (window as any).submitted)).toMatchObject({
      when: '04/03/2023',
      due: '01/02/2030',
      start: '07/04/1999',
    });
  });

  test('an empty required field blocks submission', async ({ page }) => {
    await page.goto('/e2e/fixture.html');
    await page.locator('button[type="submit"]').click();

    expect(await page.evaluate(() => (document.getElementById('form') as HTMLFormElement).checkValidity())).toBe(false);
    expect(await page.evaluate(() => (window as any).submitted)).toBeNull();
  });

  test('typed-but-invalid text blocks submission', async ({ page }) => {
    await page.goto('/e2e/fixture.html');
    await picker(page, 'required').locator('input').fill('01/02/2030');
    await picker(page).locator('input').fill('02/30/2024');
    await page.locator('button[type="submit"]').click();

    expect(await page.evaluate(() => (window as any).submitted)).toBeNull();
  });

  test('invalid text submits nothing, not the last valid date', async ({ page }) => {
    // What novalidate, form.submit(), or reading FormData would send
    await page.goto('/e2e/fixture.html');
    const input = picker(page).locator('input');
    await input.fill('04/03/2023');
    await input.blur();
    await input.fill('02/30/2024');
    await input.blur();

    expect(await page.evaluate(() => new FormData(document.getElementById('form') as HTMLFormElement).get('when'))).toBe('');
  });

  test('a value set from outside submits as MM/DD/YYYY, and a non-date submits nothing', async ({ page }) => {
    await page.goto('/e2e/fixture.html');
    const formValue = (value: string) =>
      page.evaluate(async (v) => {
        const el = document.getElementById('plain') as any;
        el.selectedDate = v;
        await el.updateComplete;
        return new FormData(document.getElementById('form') as HTMLFormElement).get('when');
      }, value);

    expect(await formValue('4/3/2023')).toBe('04/03/2023');
    expect(await formValue('not a date')).toBe('');
  });

  test('form.reset() restores the default value', async ({ page }) => {
    await page.goto('/e2e/fixture.html');
    const input = picker(page, 'defaulted').locator('input');
    await input.fill('01/01/2020');
    await input.blur();

    await page.evaluate(() => (document.getElementById('form') as HTMLFormElement).reset());

    await expect(input).toHaveValue('07/04/1999');
  });

  test('a disabled fieldset disables the picker', async ({ page }) => {
    await page.goto('/e2e/fixture.html');
    await page.evaluate(() => { (document.getElementById('fieldset') as HTMLFieldSetElement).disabled = true; });

    await expect(picker(page, 'grouped').locator('input')).toBeDisabled();
    await expect(picker(page, 'grouped').locator('.toggle')).toBeDisabled();
  });
});
