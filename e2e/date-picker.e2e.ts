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
      const input = page.locator('date-picker input');
      await input.fill('11/03/2026');
      await input.press('ArrowDown');
      await expect(page.locator('date-picker [role="grid"]')).toBeVisible();
      await axe(page);
    });

    test('demo page, error showing', async ({ page }) => {
      await page.goto('/');
      const input = page.locator('date-picker input');
      await input.fill('02/30/2024');
      await input.blur();
      await expect(page.locator('date-picker .error')).toHaveText('February 2024 has 29 days.');
      await axe(page);
    });

    test('the focus ring stands out on the selected day', async ({ page }) => {
      await freezeToday(page);
      await page.goto('/');
      const input = page.locator('date-picker input');
      await input.fill('11/03/2026');
      await input.press('ArrowDown');
      const cell = page.locator('date-picker td[aria-selected="true"]');
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

test.describe('layout', () => {
  test('fits a 320px viewport (400% zoom) without sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/');
    await page.locator('date-picker input').press('ArrowDown');
    await expect(page.locator('date-picker [role="grid"]')).toBeVisible();

    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth);

    const box = await page.locator('date-picker .date-picker').boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  });

  test('the calendar button is at least 24x24 (WCAG 2.5.8)', async ({ page }) => {
    await page.goto('/');
    const box = await page.locator('date-picker .toggle').boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(24);
    expect(box!.height).toBeGreaterThanOrEqual(24);
  });

  test('the field is centered on the demo page', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    const box = await page.locator('date-picker input').boundingBox();
    const fieldCenter = box!.x + box!.width / 2;
    expect(Math.abs(fieldCenter - 640)).toBeLessThan(2);
  });

  test('opening positions the calendar before focusing it (no jump toward the page top)', async ({ page }) => {
    // Before Popper positions it, the calendar sits at a temporary spot near the top of the page.
    // Focusing it there scrolled the page up to it. The calendar is taller than this viewport, so
    // some scrolling down to show the focused day is expected; scrolling up is the bug
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
    await expect(page.locator('date-picker input')).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('PageDown');
    await page.keyboard.press('Enter');

    await expect(page.locator('date-picker input')).toHaveValue('12/25/2026');
    await expect(page.locator('date-picker .toggle')).toBeFocused();
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
