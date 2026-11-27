# How the date picker works

This is for people changing the code. [Using the date picker](usage.md) covers it from the outside.

The core idea: what the field *shows* and the date that's *committed* are two separate things. Typing only changes what's shown. Leaving the field, pressing Enter, or clicking a day commits it. Lit draws everything, and Popper floats the calendar under the field.

## Table of Contents

- [Files](#files)
- [Rules](#rules)
- [State](#state)
- [Typing and committing](#typing-and-committing)
- [Popper lifecycle](#popper-lifecycle)
- [Keyboard and focus](#keyboard-and-focus)
- [Forms](#forms)
- [Decisions](#decisions)
- [Navigation](#navigation)

## Files

| File | Holds |
|---|---|
| [date-picker.ts](../src/date-picker.ts) | The component: state, rendering, keyboard, forms, styles |
| [date-utils.ts](../src/date-utils.ts) | Calendar math: parsing, validating, month grids, stepping days and months. No DOM, no Lit |
| [strings.ts](../src/strings.ts) | Every piece of UI text, and how overrides merge |
| [index.ts](../src/index.ts) | The main entry: exports the class and types, registers nothing |
| [define.ts](../src/define.ts) | The `/define` entry: registers the tag, safely, if it isn't already taken |
| [custom-elements-manifest.config.mjs](../custom-elements-manifest.config.mjs) | How `pnpm analyze` builds `custom-elements.json` from the class's JSDoc |

## Rules

1. **`selectedDate` is always valid or empty.** Not from typing, not from a page setting it. Anything that reads it can trust it.
2. **One way in.** Every value change goes through `_commit`, so `change` fires once, and only on a real change.
3. **The view is not the value.** `_viewYear` and `_viewMonth` are what the calendar shows. Browsing to March doesn't change the date.
4. **The calendar mirrors the field.** The highlighted day comes from the field's text, not `selectedDate`, so the two never disagree.
5. **Months are 1-based outside `date-utils.ts`.** JavaScript's 0-based month stays inside that file. See [Pitfalls: zero-based months](pitfalls.md#zero-based-months).
6. **Calendar math stays pure.** No DOM or Lit in `date-utils.ts`, so it's tested on its own.
7. **Never `new Date(string)`.** Parse the parts and build the date from numbers. See [Pitfalls: timezones](pitfalls.md#timezones-and-string-parsing).

## State

| Field | Holds |
|---|---|
| `selectedDate` | The committed date (public) |
| `isFieldValid` | Whether the field's text is a real date. Worked out from `_text` each time, never stored (public, read-only) |
| `_text` | What the field shows. Differs from `selectedDate` while the text is invalid |
| `_shownProblem` | The error under the field. Set on blur or Enter, not on every keystroke |
| `_viewYear`, `_viewMonth` | The month on screen |
| `_focusDay` | The one day in the grid that Tab lands on |
| `_isOpen` | Whether the calendar is showing |
| `_formDisabled` | Set by a disabled `<fieldset>`, separate from `disabled` |
| `_popper` | The live Popper instance, or `null` |

When a page sets `selectedDate`, `willUpdate` syncs `_text` and the view to it, cleaning the value up to follow Rule 1. That never fires `change`, because the page made the change itself.

## Typing and committing

| When | What happens |
|---|---|
| Typing | `_text` updates. Once it's a complete, real date, the calendar jumps to it. Nothing commits and no error shows |
| Blur or Enter | Empty clears the date. Valid text is rewritten as `MM/DD/YYYY` and committed. Invalid text stays, and the error shows |
| Clicking a day | `formatDate` builds the value, it's committed, and the calendar closes with focus back on the button |

Validation waits for blur because half-typed text like `04/0` is never valid, and an error flashing mid-typing is noise. Native inputs wait too.

`formatDate` writes exactly what `parseDate` reads. The first version wrote `4/3/2023`, which the blur check then rejected. See [Pitfalls: output that fails your own input](pitfalls.md#output-that-fails-your-own-input).

## Popper lifecycle

```text
open  -> _isOpen = true, listen for outside clicks -> wait for the render
      -> showPopover -> createPopper -> forceUpdate -> focus a day
close -> popper.destroy(), stop listening -> _isOpen = false -> Lit removes the calendar
```

The calendar closes on: the button, Escape, picking a day, clicking outside, focus leaving the component, or the component leaving the page.

- **Wait for the render.** Setting `_isOpen` only schedules a render. Calling Popper right away hands it `null`, which is what the first version did.
- **Re-check after waiting.** A fast open-close-open can resume the first open late. `_open` stops if it's closed again or a Popper already exists.
- **Destroy on every close.** Each Popper listens for scroll and resize. A missed `destroy()` leaks those listeners on every open. The outside-click listener follows the same rule.
- **Position before focusing.** Popper's first placement is async. Focusing before it lands scrolls the page to a temporary spot, so `forceUpdate()` places it first.
- **The top layer.** `popover="manual"` and `showPopover()` lift the calendar above the whole page, so no `overflow: hidden` parent can clip it and no `z-index` can cover it. "Manual" skips the browser's own close-on-Escape and close-on-outside-click, because the picker does its own.
- **Failures aren't fatal.** If Popper throws, the error is logged and the calendar shows unpositioned, below the field.

## Keyboard and focus

This follows the WAI-ARIA APG [date picker dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/) example. The field is a `combobox` that opens a **non-modal** dialog. Non-modal, because you can keep typing while the calendar is open. A modal tells screen readers to hide everything outside it, including the field you're typing in. An earlier version did exactly that.

The key list is in [Using: Keyboard](usage.md#keyboard).

**One tab stop in the grid.** Only the `_focusDay` cell has `tabindex="0"`, and the arrow keys move it. Otherwise Tab would stop on all 30 days.

| After | Focus goes to | Why |
|---|---|---|
| Opening | The field's date, else today | Start where the user is |
| Picking, or Escape in the calendar | The button | It opened the calendar. Otherwise focus falls to `<body>` and keyboard users lose their place |
| Clicking outside, or tabbing out | Wherever the user went | They chose to leave |
| Switching windows | Nowhere; the calendar stays open | The browser reports this as focus moving to nothing (`relatedTarget` is `null`), and closing would surprise someone who comes back |

**What screen readers get:** the field has `aria-expanded`, `aria-controls` and `aria-describedby` for the hint and error. The button's name includes the date ("Change date, November 3, 2026"). The grid is labeled by a hidden month and year that's announced when it changes. Column headers carry full day names, so a cell reads "Sunday, 3". The selected day has `aria-selected`, and today has `aria-current="date"`.

## Forms

The element is **form-associated**: `ElementInternals` lets it join a `<form>`, which an input inside a shadow root can't do on its own. See [Pitfalls: forms and shadow DOM](pitfalls.md#forms-and-shadow-dom).

| Piece | How |
|---|---|
| Value | `setFormValue` after every render: `selectedDate`, or `''` while the text is invalid |
| Validity | Follows what's typed, so Submit is blocked even before blur. Empty and `required` gives `valueMissing`, anything else `badInput` |
| Enter | Shadow-root inputs don't submit the outer form, so Enter commits, updates validity, and calls `requestSubmit()`, which validates like a native Enter |
| Reset | `formResetCallback` restores the `selecteddate` attribute, the same default-vs-current split as `value` on `<input>`. No `change` |
| Disabled | `disabled`, or `formDisabledCallback` from a `<fieldset>`. Disabled fields don't validate |
| Restore | `formStateRestoreCallback` puts the value back on back/forward navigation |

Without `ElementInternals` (Safari before 16.4, jsdom), the picker works but isn't part of the form.

## Decisions

Choices that might look odd, and why.

**Typing**

| Choice | Why |
|---|---|
| Keep invalid text | Wiping it throws away what someone typed. Keeping it lets them fix one digit |
| Validate on blur, not per keystroke | Half-typed dates are never valid, so per-keystroke errors are noise |
| Reject two-digit years | `23` could be 1923 or 2023, and different apps would guess differently |
| `setFullYear`, not `new Date(y, m, d)` | The constructor turns years 0-99 into 1900-1999. See [Pitfalls: two-digit years](pitfalls.md#two-digit-years) |
| Years 1 to 9999 | `MM/DD/YYYY` can't write past 9999, and year 0 is 1 BC, which `Intl` writes as year 1 |
| `locale` changes names, not the format | A different format needs a different parser. See [Pitfalls: format ambiguity](pitfalls.md#format-ambiguity) |
| A bad `locale` warns instead of throwing | `Intl` throws on a malformed tag, which would break the render |
| The event is `change`, not `date-change` | It's what Lit, Vue and plain JavaScript expect. In React 19, `onChange` still fires once and `e.target.selectedDate` has the value. A renamed event would mean writing `ondate-change` in React |

**Rendering**

| Choice | Why |
|---|---|
| `.selected` property on each `<option>` | The `selected` attribute stops working once the user picks an option by hand. `.value` on the `<select>` runs before the options exist |
| `live()` on the field's value | The user types between renders, so Lit's last value can be stale. `live()` checks the real one |
| Year list of ±100 years | ±500 meant 1,001 options and "1 of 1001" to a screen reader. `guard()` rebuilds it only when the year changes |
| The year list stretches | A typed year outside the list is added, or the dropdown would show the wrong year |
| `<td>` cells, not a `<button>` per day | A real table gives screen readers rows and column headers for free |
| `type="button"` on the icon button | A bare `<button>` in a form submits it |
| `pointerdown` and `composedPath()` for outside clicks | `pointerdown` fires before focus moves and covers touch. `e.target` is always the host from outside the shadow root; `composedPath()` sees the real element |

**Accessibility**

| Choice | Why |
|---|---|
| A label rendered inside the component | A page's `<label for>` can't reach inside a shadow root. One string for the visible and spoken name passes WCAG 2.5.3. Not a `<slot>`, because browsers disagree on slotted label text. See [Pitfalls: labels](pitfalls.md#labels-and-shadow-dom) |
| The format as visible text | Placeholders vanish as you type and aren't read reliably (WCAG 3.3.2) |
| `delegatesFocus` | `picker.focus()` reaches the field, so "jump to the error" links work |
| No Tab trap | Traps are for modal dialogs. Leaving the component closes the calendar instead |
| A two-tone focus ring | One color vanished on the selected day, which is where focus lands (WCAG 2.4.7) |
| Error colors measured, plus an override | `red` measured 4.0:1, below the 4.5:1 minimum (WCAG 1.4.3). The page's background is unknown, so `--consistent-date-picker-error-color` lets it adjust |
| Sizes that shrink | At a 320px viewport (400% zoom) it fits without sideways scrolling (WCAG 1.4.10) |
| `min-height` on the field | Keeps the button above the 24×24 minimum target (WCAG 2.5.8) |

**Styling and build**

| Choice | Why |
|---|---|
| Custom properties for theming | The only page CSS that crosses the shadow boundary. Each defaults to the original look |
| No property for the focus ring | A themed ring could match the day behind it and vanish |
| `::part()` names for the pieces | Custom properties only cover what we chose to expose. Parts let a page restyle anything else, without forking |
| States as extra part names (`day selected`) | `::part()` can't read attributes like `aria-selected`, so the state has to be in the part name |
| A `part` on blank cells (`empty`) | A borderless or compact grid needs to restyle them too |
| Parts can still remove the focus ring | CSS can't stop `::part(day):focus-visible` from overriding it. The docs ask pages to keep one |
| `rem`, not `px`, for calendar text | `16px` ignored the reader's browser font size (WCAG 1.4.4) |
| `font: inherit` on the field and dropdowns | Form controls use their own small 13.33px font, not the page's |
| System colors (`Canvas`, `Highlight`) as defaults | They follow light and dark mode without a palette |
| The host is as wide as the field | The calendar floats, so the page can align the picker like any input |
| TypeScript 6, not 7 | 7 is the native compiler rewrite. Tools this project will need, like `vue-tsc`, build on the JavaScript compiler's API |
| Lit and Popper left out of the bundle | An app that already has them would ship them twice. 45.6 KB became 21.9 KB, and 19.6 KB after the Vite 8 upgrade |
| Lit is a peer dependency, Popper a normal one | Two copies of Lit on a page cause warnings and wasted bytes, so the app supplies Lit. Apps rarely have Popper already |
| The tag is the package name, `consistent-date-picker` | A bare `date-picker` would clash with other libraries. Matching the package name tells you where the tag comes from |
| CSS properties use the full tag name | `--date-picker-accent` could be picked up from styles meant for another date picker |
| Registering is a separate import (`/define`) | Importing the class shouldn't have side effects. It lets apps pick their own tag, and keeps server rendering from touching `customElements` |
| `define` checks before registering | Registering a tag twice throws, which would crash a page that loads two copies. It warns instead |
| `.js` on relative imports in `.ts` files | TypeScript copies import paths into the type files as written. Projects using `node16` or `nodenext` resolution need the extension, or the types fail to load |
| `public/` isn't copied into `dist/` | It holds the demo page's assets, not the library's |
| A generated `custom-elements.json` | The standard file editors and docs tools read to learn a tag's properties, events and CSS properties. It's built from JSDoc tags (`@tagname`, `@fires`, `@cssprop`), so the code is the source |
| The manifest is checked against the docs | A property added to the code but not [usage.md](usage.md), or the other way around, fails the build |
| `attribute: 'selecteddate'` written out | Lit already lowercases it. Writing it out makes the manifest list the attribute HTML actually accepts |
| Private members and `@internal` left out of the manifest | Editors would otherwise suggest `_viewYear` and the form callbacks as if they were API |

## Navigation

- **[Index](INDEX.md)** - Start here
- **[Using the date picker](usage.md)** - Properties, typing, keyboard, forms, styling
- **[Testing](testing.md)** - Running and trusting the tests
- **[Pitfalls](pitfalls.md)** - Problems most date pickers hit
