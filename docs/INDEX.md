# hu-date-picker

- A text input with a calendar popup, as one web component
- Looks and behaves the same in every browser

## Table of Contents

- [Overview](#overview)
- [Why not `<input type="date">`?](#why-not-input-typedate)
- [Scope](#scope)
- [TBD / Next steps](#tbd--next-steps)
- [Navigation](#navigation)

## Overview

`<date-picker>` is a Lit web component. Type a date as MM/DD/YYYY or pick one from the calendar. The component holds one committed value and fires `change` when it changes.

Date pickers look like a weekend project. They aren't. Most of the work is in the edge cases: zero-based months, dates that roll over, timezones, popups that leak or float in the wrong place, and controls that drift out of sync. [Pitfalls](pitfalls.md) lists the ones this project ran into or designed around.

Code snippets in these docs explain concepts. They may not match the source line for line.

## Why not `<input type="date">`?

The native input looks different in every browser and on every OS. Its display format comes from the user's locale and can't be styled consistently. This component trades those native features for one look and one format everywhere.

## Scope

- One date, MM/DD/YYYY, US month-first order
- Sunday-first weeks
- Local calendar dates only: no times, no timezones
- Shadow DOM styles, so a host page's CSS can't break it
- Keyboard and screen reader support, following the WAI-ARIA APG date picker combobox pattern
- WCAG 2.2 AA, checked with axe in a real browser in light and dark mode
- Works in `<form>`s like a native input: name, required, disabled, reset, Enter to submit
- Translatable: month and weekday names from `locale`, UI text from `strings`

## TBD / Next steps

- Test with real screen readers (NVDA, VoiceOver). axe and the specs check rules and attributes, not what is actually announced
- Locale-aware typed format and week start (see [Pitfalls: format ambiguity](pitfalls.md#format-ambiguity)). `locale` only changes names today
- Run the Playwright suite in Firefox and WebKit too. Only Chromium runs now
- Upgrade TypeScript to 5.x, so the e2e specs are type-checked and `@types/node` can be unpinned

## Navigation

- **[Date Picker](date-picker.md)** - API, how the component works, the Popper lifecycle, decisions, testing
- **[Pitfalls](pitfalls.md)** - Problems most date pickers hit, and what this one does about each
