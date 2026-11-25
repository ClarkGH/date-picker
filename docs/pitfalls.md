# Date Picker Pitfalls

Problems that show up in almost every hand-built date picker. For each one: what goes wrong, and what this project does about it. The ones marked **(hit)** were real bugs here before they were fixed.

## Table of Contents

- [Zero-based months](#zero-based-months)
- [Silent rollover](#silent-rollover)
- [Output that fails your own input](#output-that-fails-your-own-input) **(hit)**
- [Leap years](#leap-years)
- [Two-digit years](#two-digit-years)
- [Timezones and string parsing](#timezones-and-string-parsing)
- [Daylight saving time](#daylight-saving-time)
- [Format ambiguity](#format-ambiguity)
- [Week start](#week-start)
- [Controls out of sync](#controls-out-of-sync) **(hit)**
- [Popup lifecycle](#popup-lifecycle) **(hit)**
- [Popup layering](#popup-layering)
- [Validation that punishes](#validation-that-punishes) **(hit)**
- [Events that don't leave the shadow root](#events-that-dont-leave-the-shadow-root) **(hit)**
- [Keyboard and screen readers](#keyboard-and-screen-readers)
- [Labels and shadow DOM](#labels-and-shadow-dom) **(hit)**
- [Fixed-size popups](#fixed-size-popups) **(hit)**
- [Error red](#error-red) **(hit)**
- [Month math that overshoots](#month-math-that-overshoots)
- [Forms and shadow DOM](#forms-and-shadow-dom) **(hit)**
- [Strict input](#strict-input) **(hit)**
- [Testing in a fake DOM](#testing-in-a-fake-dom) **(hit)**
- [Testing against "today"](#testing-against-today)
- [Navigation](#navigation)

## Zero-based months

`new Date(2024, 1, 1)` is **February** 1st. JS months run 0-11, while days run 1-31 and humans count months 1-12. Mixing the two conventions causes off-by-one bugs.

Here: 1-based everywhere, converted only inside [date-utils.ts](../src/date-utils.ts).

## Silent rollover

`new Date(2024, 1, 30)` doesn't throw. It quietly becomes March 1st. So "did `new Date` succeed?" is not validation. A regex isn't either: `13/45/2023` matches `\d{2}/\d{2}/\d{4}`.

Here: `parseDate` checks the shape, then checks `1 <= day <= daysInMonth(year, month)`.

## Output that fails your own input

If the calendar writes a date in a format the text input rejects, a perfectly valid pick gets wiped on the next blur. The first version wrote `4/3/2023` and required `04/03/2023`.

Here: one `formatDate` and one `parseDate`, with a test that checks they round-trip.

## Leap years

Divisible by 4, except centuries, except every 400 years. 1900 had no Feb 29, 2000 did. Hand-rolled `year % 4 === 0` checks get 1900 and 2100 wrong.

Here: we don't write the rule. `new Date(year, month, 0)` is the last day of the previous month, and `Date` already knows the rule.

## Two-digit years

`new Date(50, 0, 1)` is January 1st **1950**. The constructor treats years 0-99 as 1900-1999, a leftover from the Y2K era. January 1st, 50 was a Saturday, but 1950's was a Sunday, so the calendar for `01/01/0050` would start every week one day off.

Here: `localDate` builds dates with `setFullYear`, which does no such mapping.

## Timezones and string parsing

`new Date('2024-03-10')` is parsed as **UTC midnight**. West of Greenwich, that's still March 9th locally, so the picker shows the day before. `new Date('03/10/2024')` is parsed as local time, and the spec doesn't define that format at all.

A calendar date (a birthday, a due date) isn't a moment in time. Keep it as year/month/day numbers.

Here: no string is ever passed to `Date`. Values are `MM/DD/YYYY` strings and `{ year, month, day }` objects.

## Daylight saving time

Stepping a day by adding `24 * 60 * 60 * 1000` ms breaks twice a year, when a day is 23 or 25 hours long. In some timezones local midnight doesn't exist on the changeover day, so "midnight on day X" lands an hour later.

Here: the code never does time arithmetic. Days come from the calendar fields (`getDate`, `getDay`), and those stay correct across a DST change.

## Format ambiguity

Is `04/03/2023` April 3rd or March 4th? That depends on where you live. Guessing from the browser locale makes the same text mean different dates for different users.

Here: one fixed format, MM/DD/YYYY, stated in the placeholder and the error. Locale support (`Intl.DateTimeFormat`) is a future step and would need its own parser.

## Week start

The US starts weeks on Sunday. Most of Europe starts on Monday. A grid hard-coded to one is wrong for the other.

Here: Sunday-first, by design, for now. `buildMonthGrid` is the only place that would change.

## Controls out of sync

A month dropdown, a year dropdown, and a grid are three views of the same state. In the first version the grid showed November while the dropdown said January. Picking January then did nothing, because the dropdown already said January and no `change` event fired.

Typing a date while the calendar is open is the same problem with a fourth view, the text field.

Here: `_viewYear` and `_viewMonth` are the one source of truth. Each `<option>` sets its `selected` *property* from them. Using the attribute fails once the user has picked an option by hand ([why](date-picker.md#decisions)). Typing a complete date moves the view, and the highlighted day comes from the field's text.

## Popup lifecycle

Popup libraries (Popper, Floating UI) need both elements to exist and must be torn down when the popup closes. The usual mistakes:

- Creating the popup before the framework has rendered it, so the target is `null`
- Creating a new instance on every click and never destroying any, which leaks scroll and resize listeners
- Races: open, close, open quickly, and you get two instances

Here: see [Date Picker: Popper lifecycle](date-picker.md#popper-lifecycle).

## Popup layering

A floating calendar needs an opaque background, a `z-index`, and an ancestor that doesn't clip it. An `overflow: hidden` parent will cut it off. A transparent calendar over page content is unreadable.

Here: `background: Canvas`, and the calendar is a popover in the browser's top layer, so no parent can clip or cover it. Popper's `strategy: 'fixed'` looked like the fix, but a fixed calendar taller than the space below the field opens off-screen, and the page can't scroll to it.

## Validation that punishes

Clearing the field on bad input throws away the user's typing and gives no reason. Logging the reason to `console.error` doesn't help, because users don't read the console.

Here: invalid text stays, an inline message appears, and `aria-invalid` marks the input.

## Events that don't leave the shadow root

Native `change` events from inside a shadow root aren't `composed`, so the host page never sees them. A web component that doesn't dispatch its own event can't be used in a form.

Here: `_commit` dispatches `change` with `{ bubbles: true, composed: true }`.

## Keyboard and screen readers

A grid of clickable `<div>`s can't be reached with Tab, doesn't respond to Enter, and is announced as plain text. Date pickers are one of the most commonly inaccessible components on the web.

The usual gaps:

- No way to reach the days with the keyboard, or a Tab stop on every day
- Focus dropped onto `<body>` when the popup closes
- A modal dialog that hides the text field while users keep typing in it **(hit)**
- A focus ring the same color as the selected day's background **(hit)**
- Month changes that are visible but never announced
- An icon button with no name, read as "button"
- The format only given in the placeholder, which disappears as you type **(hit)**

Here: the WAI-ARIA APG date picker combobox pattern, covered in [Date Picker: Keyboard and focus](date-picker.md#keyboard-and-focus).

## Fixed-size popups

A calendar fixed at 400px wide doesn't fit a 320px-wide viewport, which is what a desktop browser at 400% zoom gives you. Low-vision users then have to scroll sideways to see the days (WCAG 1.4.10). Tall fixed rows make it worse.

Here: the width is capped at the viewport, row heights scale with the viewport, and the dialog scrolls vertically if it still doesn't fit.

## Error red

`color: red` looks like an obvious choice for an error, but it measures 4.0:1 on white, below the 4.5:1 minimum for text. It's also worse on dark backgrounds. A component also can't know the background it'll be placed on.

Here: tested colors for light and dark, plus `--date-picker-error-color` for pages that don't match the OS theme.

## Labels and shadow DOM

`<label for="start">` finds its input by ID, and IDs don't cross shadow roots. An input inside a web component can't be labeled from the page, so screen readers announce an unnamed text field. A placeholder isn't a label: it disappears once you type, and screen readers don't reliably read it.

A first fix is usually `aria-label` on the inner input. That names it, but now the spoken name and the visible text near it can disagree. Voice-control users say what they see ("click Start date"), and a mismatch means the command doesn't work (WCAG 2.5.3).

Here: the component renders its own visible `<label>` from the `label` property, so there's one string for both. **(hit twice)**

## Month math that overshoots

"Same day next month" from January 31st has no answer, and `new Date(2024, 1, 31)` quietly gives March 2nd. PageDown from Jan 31 shouldn't skip February.

Here: `addMonths` clamps to the last day of the target month, so Jan 31 goes to Feb 29.

## Forms and shadow DOM

An `<input>` inside a shadow root is invisible to the `<form>` around the component. It isn't submitted, it doesn't block submission when it's invalid, form reset doesn't touch it, a disabled `<fieldset>` doesn't disable it, and pressing Enter in it doesn't submit. The component looks like a form field and behaves like decoration.

Here: a form-associated custom element (`static formAssociated = true` + `ElementInternals`), plus Enter calling `form.requestSubmit()` by hand. Details in [Date Picker: Forms](date-picker.md#forms).

## Strict input

Rejecting `4/3/2023` because it's missing leading zeros makes people do formatting work the computer could do. Error messages like "Invalid date" also don't say what to fix.

Here: lenient in, strict out. Several formats are accepted and always written back as MM/DD/YYYY. Errors name the problem ("February 2023 has 28 days"). Two-digit years are the exception: they're rejected, because guessing the century is a coin flip.

## Testing in a fake DOM

jsdom and happy-dom run tests fast, but they aren't browsers. In this project:

- happy-dom reported the wrong `<select>` value, which failed tests the component passed
- jsdom has no layout, so a 400px popup "fits" a 320px screen
- jsdom has no `ElementInternals` form methods and no `delegatesFocus`
- neither computes color contrast or focus rings

Here: logic and ARIA in Vitest + jsdom, everything visual or browser-native in Playwright + axe. Each browser test was checked by breaking the fix it guards.

## Testing against "today"

A test like "opens on the current month" passes today and fails on the 1st. Real dates in tests make them flaky.

Here: specs freeze `Date` with `vi.setSystemTime`.

## Navigation

- **[Index](INDEX.md)** - Overview, scope, next steps
- **[Date Picker](date-picker.md)** - API, how it works, decisions, testing
