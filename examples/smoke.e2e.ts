import { expect, test } from '@playwright/test';

// Every example renders the same page: a form with a required picker, a "set from outside"
// button, a readout of `change` events, and the submitted form data

test('the picker works the same in this framework', async ({ page }) => {
  const problems: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(e.message));
  await page.clock.setFixedTime(new Date(2026, 10, 24, 12));
  await page.goto('/');
  const input = page.locator('#picker input');
  const changes = page.locator('#changes');
  const submitted = page.locator('#submitted');
  const submit = page.locator('#form button[type="submit"]');

  await test.step('an empty required picker blocks the form', async () => {
    await submit.click();
    await expect(submitted).toHaveText('');
  });

  await test.step('typing a date commits it on blur and fires change once', async () => {
    await input.fill('11/3/2026');
    await input.blur();
    await expect(input).toHaveValue('11/03/2026');
    await expect(changes).toHaveText('count: 1, last: 11/03/2026');
  });

  await test.step("the app's ::part() rule and custom property apply", async () => {
    await expect(input).toHaveCSS('border-top-width', '3px');
    await input.press('ArrowDown');
    await expect(page.locator('#picker td[aria-selected="true"]')).toHaveCSS('background-color', 'rgb(0, 100, 0)');
    await input.press('Escape');
  });

  await test.step('picking a day fires change once', async () => {
    await input.press('ArrowDown');
    await expect(page.locator('#picker td[tabindex="0"]')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(input).toHaveValue('11/04/2026');
    await expect(changes).toHaveText('count: 2, last: 11/04/2026');
  });

  await test.step('setting the value from code updates the field without a change event', async () => {
    await page.locator('#set-outside').click();
    await expect(input).toHaveValue('04/03/2023');
    await expect(changes).toHaveText('count: 2, last: 11/04/2026');
  });

  await test.step('the form submits the date under its name', async () => {
    await submit.click();
    await expect(submitted).toHaveText('{"when":"04/03/2023"}');
  });

  expect(problems, 'console errors or warnings').toEqual([]);
});
