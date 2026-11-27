# hu-date-picker

- A text input with a calendar popup, as one web component
- Looks and behaves the same in every browser

Type a date as MM/DD/YYYY or pick one from the calendar. It's keyboard and screen-reader friendly, meets WCAG 2.2 AA, and works in forms like a normal input.

Date pickers look like a weekend project. They aren't. Most of the work is in the edge cases: zero-based months, dates that roll over, timezones, popups that leak or float in the wrong place, and controls that drift out of sync. [Pitfalls](pitfalls.md) lists the ones this project ran into or designed around.

## Which doc do I need?

| I want to... | Read |
|---|---|
| Put the picker on a page, style it, or translate it | [Using the date picker](usage.md) |
| Change the code | [How it works](date-picker.md) |
| Run or add tests | [Testing](testing.md) |
| Know what makes date pickers hard | [Pitfalls](pitfalls.md) |

Code snippets in these docs explain ideas. They may not match the source line for line.

## Why not `<input type="date">`?

The native input looks different in every browser and on every OS, and its format follows the user's locale. This component trades those native features for one look and one format everywhere.

## Next steps

- Test with real screen readers (NVDA, VoiceOver). axe checks rules and attributes, not what's actually announced
- A typed format and week start that follow the locale (see [Pitfalls: format ambiguity](pitfalls.md#format-ambiguity))
- Run the browser tests in Firefox and WebKit too. Only Chromium runs now

## Navigation

- **[Using the date picker](usage.md)** - Properties, typing, keyboard, forms, styling
- **[How it works](date-picker.md)** - Rules, state, the Popper lifecycle, decisions
- **[Testing](testing.md)** - Commands, coverage, gotchas
- **[Pitfalls](pitfalls.md)** - Problems most date pickers hit, and what this one does about each
