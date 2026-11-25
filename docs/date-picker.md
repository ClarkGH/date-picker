# Date Picker Component

## Table of Contents

- [API](#api)
  - [Styling](#styling)
- [Rules](#rules)
- [How it works](#how-it-works)
  - [State](#state)
  - [Typing a date](#typing-a-date)
  - [Picking a day](#picking-a-day)
  - [Forms](#forms)
  - [Popper lifecycle](#popper-lifecycle)
  - [Keyboard and focus](#keyboard-and-focus)
- [Decisions](#decisions)
- [Testing](#testing)
- [Navigation](#navigation)

## API

```html
<form>
  <date-picker name="start" label="Start date" selectedDate="04/03/2023" required></date-picker>
</form>
```

```js
picker.locale = 'fr-FR';                        // month and weekday names
picker.strings = { hint: 'Format : MM/JJ/AAAA' }; // any subset of the UI text
picker.focus();                                 // focuses the input
```

| Member | Kind | Meaning |
|---|---|---|
| `selectedDate` | property, string | The committed value: a valid `MM/DD/YYYY` or `''` |
| `isFieldValid` | read-only property, boolean | `true` when the input holds a real date; `false` when empty or invalid. Updates as you type |
| `label` | property, string | Visible label above the field, which is also its accessible name. Defaults to `Date` |
| `name` | property/attribute | Form field name. The form submits `selectedDate` under it |
| `required` | property/attribute | Empty is invalid: blocks form submission and says "Enter a date." on blur |
| `disabled` | property/attribute | Disables the field and button and closes the calendar. A disabled `<fieldset>` does the same |
| `locale` | property, string | BCP 47 tag for month and weekday names and the button's spoken date. Default `en-US`. The typed format stays MM/DD/YYYY. An invalid tag falls back to `en-US` with one console warning |
| `strings` | property (JS only) | Overrides for UI text: hint, button and dialog names, dropdown names, error messages. Any subset; `errors` merges one level deep. Defaults are in [strings.ts](../src/strings.ts) |
| `focus()` | method | Focuses the input (`delegatesFocus`) |
| `change` | event | Fires when `selectedDate` changes. `event.detail.value` is the new value. Bubbles out of the shadow root |

The HTML attribute is `selecteddate`, all lowercase, because attributes are case-insensitive. Setting the property from JS is the usual route.

### Styling

Page CSS can't reach inside the component, so set these on the `date-picker` element instead. Anything you don't set keeps the default look.

```css
date-picker {
  --date-picker-accent: #6200ee;
  --date-picker-radius: 8px;
}
```

| Custom property | Styles | Default |
|---|---|---|
| `--date-picker-font-size` | Calendar text, including the month and year dropdowns | `1rem` |
| `--date-picker-background` | Calendar background | `Canvas` |
| `--date-picker-text-color` | Calendar text color | `CanvasText` |
| `--date-picker-border-color` | Calendar and cell borders | the text color |
| `--date-picker-radius` | Calendar corners | `0` |
| `--date-picker-accent` | Selected day background | `Highlight` |
| `--date-picker-accent-text` | Selected day text | `HighlightText` |
| `--date-picker-error-color` | Error text and invalid-outline color. Set it if your page's background doesn't match the OS theme | `#b3261e` (light) / `#f2b8b5` (dark), following the OS theme |

The text field uses the page's font. Set `font-family` or `font-size` on the `date-picker` element to change it.

The default colors switch with light and dark mode on their own. A color you set doesn't switch, so set it again inside a `prefers-color-scheme` media query if you need it to. If you set the colors, checking their contrast is up to you. The focus ring can't be themed (see [Decisions](#decisions)).

## Rules

1. **`selectedDate` is always valid or empty.** Invalid typing never reaches it, and neither does an invalid value set from outside. Anything that reads the value can trust it.
2. **One way in.** Every change to the value goes through `_commit`, so `change` fires once, and only when the value really changes.
3. **The view is not the value.** `_viewYear` and `_viewMonth` are what the calendar shows. Browsing to March doesn't change the selected date.
4. **The calendar mirrors the field.** The highlighted day is whatever the input's text parses to, not `selectedDate`. If the text is partial or invalid, nothing is highlighted, so the calendar never shows a different date than the field.
5. **Months are 1-based everywhere outside `date-utils.ts`.** The 0-based JS month only appears inside that file. See [Pitfalls: zero-based months](pitfalls.md#zero-based-months).
6. **Calendar math stays pure.** [date-utils.ts](../src/date-utils.ts) has no DOM and no Lit, so it's tested on its own.
7. **Never parse a string with `new Date(string)`.** Parse the parts yourself and build the date from numbers. See [Pitfalls: timezones](pitfalls.md#timezones-and-string-parsing).

## How it works

### State

| Field | Public | Holds |
|---|---|---|
| `selectedDate` | yes | Committed value |
| `isFieldValid` | yes, read-only | Whether the input text is a real date. Worked out from `_text`, never stored |
| `_text` | no | What the input shows. Differs from `selectedDate` while the text is invalid |
| `_shownProblem` | no | What's wrong with the field, shown under it. Set on blur or Enter, not on every keystroke |
| `_formDisabled` | no | Set by a disabled `<fieldset>` or form, separately from `disabled` |
| `_viewYear`, `_viewMonth` | no | The month on screen |
| `_focusDay` | no | The day in that month holding the grid's one tab stop |
| `_isOpen` | no | Calendar shown |
| `_popper` | no | The live Popper instance, or `null` |

When a page sets `selectedDate` from outside, `willUpdate` syncs `_text` and the view to it. A loose date (`4/3/2023`) is stored as `04/03/2023`. Anything that isn't a date stays in the field so it can be fixed, but `selectedDate` becomes `''`. Neither fires `change`, because the page made the change itself. Opening the calendar always starts on the field's date, or today if the field is empty or invalid. Browsing to another month and closing doesn't carry over to the next open.

### Typing a date

Typing and committing are separate steps.

**While typing (`input`)**, the calendar follows the field. Once the text is a complete, real date, the view jumps to that month and highlights the day. Partial text like `04/03/20` never parses, so the calendar doesn't jump around mid-keystroke. Nothing is committed, no `change` fires, and no error shows.

**On blur**, the value is committed or rejected. Validation waits until then because half-typed text like `04/0` is never valid, and an error flashing while someone is still typing is noise. Committing on every keystroke would also fire `change` for dates the user hasn't settled on. Native inputs work the same way.

**On Enter**, the same commit happens, then the form is submitted. See [Forms](#forms).

- Empty: the value is cleared. No error, unless the field is `required`
- Valid: the text is normalized to MM/DD/YYYY, committed, and the calendar's view moves to that month
- Invalid: the text **stays** in the input, an error says what's wrong, `aria-invalid="true"` is set, and `selectedDate` doesn't change

**Lenient in, strict out.** One or two digit month and day, a four-digit year, and any one separator: `4/3/2023`, `04-03-2023`, `4.3.2023`, `4 3 2023`. All of them become `04/03/2023`. Mixed separators (`4/3-2023`) are rejected.

**Errors say what's wrong** (WCAG 3.3.3). `validateDate` returns a reason, not just pass or fail:

| Typed | Message |
|---|---|
| `soon`, `2023-04-03` | Enter the date as MM/DD/YYYY, like 04/03/2023. |
| `4/3/23` | Use a four-digit year, like 2023. |
| `01/01/0000` | The year must be from 1 to 9999. |
| `13/01/2024` | The month must be from 1 to 12. |
| `02/29/2023` | February 2023 has 28 days. |
| (empty, required) | Enter a date. |

A two-digit year is rejected rather than guessed. `23` could be 1923 or 2023, and a birthday picker and a booking picker would guess differently. See [Pitfalls: rollover](pitfalls.md#silent-rollover) for why the day check exists at all.

### Picking a day

Clicking a day, or pressing Enter or Space on it, builds the value with `formatDate`, commits it, closes the calendar, and returns focus to the button. `formatDate` writes exactly the format `parseDate` accepts. The first version wrote `4/3/2023`, which the blur check then rejected and wiped. See [Pitfalls: round-tripping](pitfalls.md#output-that-fails-your-own-input).

### Popper lifecycle

[Popper](https://popper.js.org/docs/v2/) positions the calendar under the input. It needs both elements to exist when it starts.

```text
open  -> _isOpen = true, listen for document pointerdown -> await updateComplete
      -> calendar exists -> showPopover -> createPopper -> forceUpdate -> focus the grid's tab stop
close -> popper.destroy(), stop listening -> _isOpen = false -> Lit removes the calendar
         (button click, Escape, picking a day, pointerdown outside, focus leaving the component,
          removed from the page)
```

- **Wait for the render.** Lit renders asynchronously. Setting `_isOpen` only schedules a render, so `createPopper` has to wait for `updateComplete`. The first version called it right away and handed Popper `null`.
- **Re-check after the wait.** A fast open-close-open can resume the first `await` after the second open. `_open` bails if it's closed again or an instance already exists, so you never end up with two.
- **Destroy on every close path.** Each instance listens for scroll and resize. Skipping `destroy()` leaks those listeners, one set per open.
- **The document listener follows the same rule.** The outside-click listener is added on open and removed on every close, for the same reason Popper is destroyed.
- **Position before focusing.** Popper places the calendar at a temporary spot and calculates the real position asynchronously. Calling `.focus()` in between scrolls the page to the temporary spot, and then the calendar jumps. `forceUpdate()` positions it synchronously, so focus lands where the calendar really is.
- **The calendar is a popover in the top layer.** `popover="manual"` plus `showPopover()` lifts it above everything on the page, so an `overflow: hidden` parent can't clip it and no `z-index` can cover it. "Manual" means no built-in light dismiss or Escape handling; the picker already does its own. Where the popover API is missing, it renders in normal flow like before.
- **Popper failing isn't fatal.** If `createPopper` throws, the error is logged and the calendar still shows, unpositioned, below the input.

### Keyboard and focus

This follows the WAI-ARIA APG **date picker combobox** pattern. The input is a `combobox` that opens a **non-modal** dialog with a grid inside it. The [date picker dialog example](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/) is the reference for the grid keys.

Why non-modal: the calendar follows what you type, so the field has to stay usable while the calendar is open. A modal (`aria-modal="true"`) tells screen readers to hide everything outside the dialog, which would include the field being typed in. An earlier version did exactly that.

| Where | Key | Does |
|---|---|---|
| Grid | Left / Right | Previous / next day |
| Grid | Up / Down | Same day, previous / next week |
| Grid | Home / End | Sunday / Saturday of the current week |
| Grid | PageUp / PageDown | Same day, previous / next month (clamped: Jan 31 goes to Feb 28/29) |
| Grid | Shift + PageUp / PageDown | Same day, previous / next year |
| Grid | Enter / Space | Pick the day, close, focus the button |
| Anywhere in the calendar | Escape | Close without picking, focus the button |
| Anywhere in the component | Tab / Shift+Tab | Normal order: field → button → month → year → grid. Tabbing out of the component closes the calendar |
| Field or button | Down / Alt+Down | Open the calendar and focus the grid, or move into it if it's already open |
| Field or button | Escape | Close the calendar; focus stays where it is |

All grid moves can cross into another month or year. The dropdowns and heading follow. Moves stop at years 1 and 9999. `MM/DD/YYYY` can't write past 9999, and year 0 is 1 BC, which `Intl` calls year 1.

**Roving tabindex.** Only one cell has `tabindex="0"`: the focus day. Every other cell has `-1`. Tab enters the grid at one cell, and the arrow keys move within it. Without this, Tab would stop on all 30 or so days.

**Where focus goes:**

- Open: the field's date, else today, else the 1st of the month on screen
- Pick or Escape: back to the button, since that's what opened the dialog. If it went nowhere, it would fall to `<body>` when the calendar is removed, and keyboard users would lose their place
- Outside click, or tabbing out: left alone, because the user just chose to go somewhere else. Both close the calendar
- Window switch: the calendar stays open. The browser reports that as focus moving to nothing (`relatedTarget` is `null`), and closing then would surprise someone who alt-tabs away and comes back

**What screen readers get:**

- The field: `role="combobox"`, `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls` pointing at the dialog, and `aria-describedby` for the format hint and the error
- The button: `aria-label="Choose date"`, `aria-haspopup="dialog"`, and `aria-expanded`
- The dialog: a label, and no `aria-modal` (see above)
- The grid: labeled by a visually hidden month/year text. It's `aria-live`, so changing months is announced. It's a `<div>`, not a heading, so it doesn't add a heading to the host page's outline
- Column headers: `abbr="Sunday"` and so on, so a cell reads as "Sunday, 3" instead of "Sun, 3"
- The selected day: `aria-selected="true"`. Today: `aria-current="date"`

### Forms

The element is **form-associated**: it uses `ElementInternals` to take part in a `<form>` like a native input. A shadow-root input can't do that by itself. See [Pitfalls: forms and shadow DOM](pitfalls.md#forms-and-shadow-dom).

- **Value:** `setFormValue(selectedDate)` after every render, so the form always submits what's committed. If the field holds text that isn't a date, it submits `''` instead, like a native date input. Otherwise `novalidate` or `form.submit()` would send the last valid date while the field shows something else
- **Validity:** follows what's *typed*, not just what's committed. Typing `02/30/2024` and clicking Submit is blocked, even before blur. Empty and `required` gives `valueMissing`; anything else invalid gives `badInput`. The input is the anchor, so the browser's validation bubble points at it
- **Enter submits.** An input inside a shadow root doesn't trigger the outer form's implicit submission, so Enter commits the text, updates validity, and calls `form.requestSubmit()`. `requestSubmit` (not `submit`) runs validation and fires `submit` events, like a native Enter
- **Reset:** `formResetCallback` restores the `selecteddate` *attribute*. The attribute is the default value and the property is the current value, the same split as `value` on `<input>`. Reset doesn't fire `change`, which matches native inputs
- **Disabled:** our own `disabled` or a disabled `<fieldset>` (`formDisabledCallback`). Disabled fields don't validate
- **Restore:** `formStateRestoreCallback` puts the value back on back/forward navigation

Where `ElementInternals` isn't supported (Safari before 16.4, and jsdom) the picker still works. It just isn't part of the form.

## Decisions

Choices that might look odd, and why we made them:

- **Keep invalid text instead of wiping it.** Wiping throws away what someone typed and gives no reason. Keeping it lets them fix one digit.
- **`.selected` on each `<option>`, not `?selected` or `.value` on the `<select>`.** The `selected` *attribute* only sets the starting option. Once the user picks an option by hand, the browser ignores that option's attribute from then on. So after picking July and then August, typing a July date would move the grid but leave the dropdown on August. The `selected` *property* always applies. `.value` on the `<select>` doesn't work either: Lit sets it before the options inside it exist, so there's nothing to match.
- **`live()` on the input's value.** Lit normally skips a binding whose value hasn't changed since the last render. But the user can type into the input in between, so the DOM can differ from what Lit last wrote. `live()` compares against the actual DOM value. Without it, picking the same day again would leave half-typed junk in the field.
- **The year list is ±100 years.** It was ±500, which meant 1,001 options rebuilt on every open and "1 of 1001" to a screen reader. 201 covers birthdays and planning. `guard()` still rebuilds them only when `_viewYear` changes.
- **The year list stretches to fit.** If someone types `01/01/0050`, the dropdown grows to include year 50. Otherwise the `<select>` would have no matching option and would show the wrong year.
- **`setFullYear` instead of `new Date(y, m, d)`.** The constructor maps years 0-99 to 1900-1999. See [Pitfalls: two-digit years](pitfalls.md#two-digit-years).
- **`background: Canvas`.** Popper floats the calendar over the page, so it can't be transparent. `Canvas`/`CanvasText` are CSS system colors that follow light/dark `color-scheme` without picking a palette.
- **`type="button"` on the icon button.** A bare `<button>` inside a `<form>` submits it.
- **`<td>` grid cells, not a `<button>` per day.** A real `<table role="grid">` gives screen readers rows and column headers for free, so a cell is announced with its weekday. The APG example does the same. Buttons in a CSS grid would need `role="row"` wrappers, and the usual trick for that (`display: contents`) has dropped ARIA roles in some browsers.
- **No Tab trap.** A Tab trap goes with a modal dialog, and this dialog is non-modal (see [Keyboard and focus](#keyboard-and-focus)). Instead, focus leaving the component closes the calendar, so a closed calendar is never left floating over the page.
- **The format is shown as visible text, not just the placeholder.** The placeholder disappears once you type, and screen readers don't reliably read it (WCAG 3.3.2). `Format: MM/DD/YYYY` stays visible and is linked with `aria-describedby`.
- **A two-tone focus ring.** A `CanvasText` outline with a `Canvas` band inside it. The first version's single `Highlight` outline was invisible on the selected day, whose background is also `Highlight`, and that's the cell that gets focus when the calendar opens (WCAG 2.4.7).
- **Sizes that shrink.** The calendar is `min(400px, 100vw - 16px)` wide, and cells are `clamp(2.75rem, 12vw, 100px)` tall. At a 320px-wide viewport (400% zoom) it fits without scrolling sideways (WCAG 1.4.10). Cells never shrink below a comfortable touch target.
- **A minimum height on the input.** The calendar button is as tall as the input, and `min-height: 2rem` keeps it above the 24×24 minimum target size (WCAG 2.5.8).
- **Error colors from the OS theme, plus an override.** `red` measured 4.0:1 on white and 3.9:1 on the demo's dark background, below the 4.5:1 minimum (WCAG 1.4.3). The new colors are 6.5:1 and 9.1:1. The error text sits on the host page's background, which the component can't know, so `--date-picker-error-color` lets the page fix a mismatch.
- **Calendar text in `rem`, not `px`.** It was `16px`, which ignored both the page and the reader's browser font size (WCAG 1.4.4). `1rem` looks the same in a default browser.
- **`font: inherit` on the input and the dropdowns.** Browsers give form controls their own small font (13.33px) instead of the page's, so the field didn't match its label and hint, and the month and year dropdowns ignored `--date-picker-font-size`.
- **Theming through custom properties, and none for the focus ring.** Custom properties are the only page CSS that crosses the shadow boundary, and each one defaults to today's look. The two-tone focus ring stays in system colors, because a themed ring could end up the same color as the day behind it.
- **A visible label rendered inside the component.** IDs don't cross shadow roots, so a `<label for="x">` on the page can never point at the input inside. An earlier version used `aria-label` from the `label` property. That named the input, but its default "Date" rarely matched the visible text a page put next to it, which fails WCAG 2.5.3 Label in Name for voice-control users ("click Start date"). Rendering the label inside the component means the visible text and the spoken name are the same string. It's not a `<slot>`, because browsers disagree on how `aria-labelledby` handles slotted text. See [Pitfalls: labels and shadow DOM](pitfalls.md#labels-and-shadow-dom).
- **`delegatesFocus: true`.** `picker.focus()` focuses the input. Without it, a page's "jump to the first error" link or its own focus management does nothing.
- **The button says the date.** With a date set, it's "Change date, November 3, 2026", so a screen-reader user who tabs past the field still hears the value (APG).
- **`locale` changes names, not the format.** Month and weekday names come from `Intl`, cached per locale. The typed format stays MM/DD/YYYY and weeks still start on Sunday. Changing those means a different parser, so it's a separate piece of work. See [Pitfalls: format ambiguity](pitfalls.md#format-ambiguity).
- **An invalid locale falls back, it doesn't throw.** `Intl` throws `RangeError` on a malformed tag, which would take down the render. The picker warns once and uses `en-US`.
- **Lit and Popper are both left out of the bundle.** An app that already uses either one would otherwise ship it twice. The build went from 45.6 KB to 21.9 KB (14.4 KB to 7.2 KB gzipped).
- **The host is as wide as the field.** The host is 280px, not the calendar's 400px. The calendar floats via Popper, centered under the field, so a page can center or align the picker like any other input.
- **Outside clicks use `composedPath()`.** A click inside the shadow root shows up on the document with `e.target` set to the host element, so checking `e.target` can't tell the calendar from the text field. `composedPath()` lists the real elements.
- **`pointerdown`, not `click`, for outside clicks.** It fires before focus moves, and it also covers touch and pen input.

## Testing

```sh
pnpm test        # vitest, specs are colocated *.spec.ts
pnpm typecheck   # tsc over src, specs included
pnpm build       # tsc declarations + vite library build
```

- [date-utils.spec.ts](../src/date-utils.spec.ts): leap years (including 1900/2000), rollover rejections, grid padding, year range errors, day and month stepping across DST
- [date-picker.spec.ts](../src/date-picker.spec.ts): one test for each bug that's been fixed, the Popper lifecycle using a mocked `@popperjs/core` that counts `createPopper` and `destroy` calls, every key in the table above, focus placement, ARIA attributes, error messages, locale and strings
- [strings.spec.ts](../src/strings.spec.ts): string overrides merge without losing defaults
- [e2e/date-picker.e2e.ts](../e2e/date-picker.e2e.ts): Playwright in real Chromium, for what jsdom can't do: axe WCAG 2.2 AA scans (closed, open, error showing, light and dark), the focus ring on the selected day, styling custom properties and their defaults, 320px reflow, escaping an `overflow: hidden` parent, the 24×24 button, no page jump on open, `delegatesFocus`, label click, and form submit, required, reset, and disabled `<fieldset>`. [e2e/fixture.html](../e2e/fixture.html) is the test page

```sh
pnpm exec playwright install chromium   # once, downloads the browser
pnpm test:e2e                           # starts the Vite dev server itself
```

Every accessibility fix has been checked by breaking it on purpose and watching a test fail. Removing `forceUpdate` makes the page jump from y=1830 to y=64 on open. The old `red` error color fails axe's `color-contrast` rule. The old single-color focus ring fails the focus-ring test. The old `16px` calendar text fails the rem test. Without `font: inherit`, the input stays at 13.33px and fails the font test.

Things to know:

- **jsdom, not happy-dom.** happy-dom's `<select>` reports the wrong `value` when an option has `selected`. The component was correct, but the tests failed.
- **The timezone is pinned to `America/Sao_Paulo`** in `vitest.config.ts`. Brazil used to start DST at midnight, so on 2018-11-04 local midnight didn't exist. Date math that gets that day right will work in any timezone. A test checks that the pin is in effect, so it can't silently stop working.
- **Today is frozen.** Specs fake `Date` to Nov 24 2026, so "opens on the current month" doesn't break on the 1st of each month.
- **`@types/node` is pinned to 18.11.** Vitest pulls in the latest `@types/node`, which uses syntax TypeScript 4.9 can't parse. Unpin it when TypeScript is upgraded.
- **jsdom doesn't do layout, color, focus rings, form association, or `delegatesFocus`.** Those are tested in Playwright instead.
- **The e2e files aren't type-checked.** Playwright's type declarations need a newer TypeScript than 4.9. Playwright compiles the specs itself, so they run, but `pnpm typecheck` skips `e2e/`. Upgrading TypeScript would fix this, and would let `@types/node` be unpinned.
- **`axe` checks rules, not experience.** A clean axe run doesn't prove the picker is pleasant with a screen reader. That still needs a person.
- **`tsconfig.spec.json` exists** because the main tsconfig emits declarations only, and spec files shouldn't end up in `types/`.

## Navigation

- **[Index](INDEX.md)** - Overview, scope, next steps
- **[Pitfalls](pitfalls.md)** - Problems most date pickers hit
