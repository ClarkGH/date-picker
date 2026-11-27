# Using the date picker

`<consistent-date-picker>` is a date field for web pages. People can type a date or pick one from a calendar, and it looks and works the same in every browser. It works inside a `<form>` like a normal input.

## Table of Contents

- [Quick start](#quick-start)
- [In a framework](#in-a-framework)
- [Properties](#properties)
- [What people can type](#what-people-can-type)
- [Keyboard](#keyboard)
- [Forms](#forms)
- [Styling](#styling)
- [Server rendering](#server-rendering)
- [Editor support](#editor-support)
- [Limits](#limits)
- [Navigation](#navigation)

## Quick start

Import `define` once, then use the tag anywhere. It needs a bundler (Vite, webpack, and so on) and `lit` 3 installed. It isn't on npm yet, so for now the import is the built file, `dist/define.js`.

```js
import 'consistent-date-picker/define'; // registers <consistent-date-picker>
```

```html
<form>
  <consistent-date-picker name="start" label="Start date" selectedDate="04/03/2023" required></consistent-date-picker>
</form>
```

```js
const picker = document.querySelector('consistent-date-picker');
picker.addEventListener('change', (e) => console.log(e.detail.value)); // "04/03/2023"
```

### A different tag name

Importing `define` is optional. The main entry only exports the class, so you can register it under your own tag. Register a subclass, because one class can't be registered under two tags:

```js
import { DatePicker } from 'consistent-date-picker';
customElements.define('my-date-field', class extends DatePicker {});
```

## In a framework

These are tested on every change in small example apps ([examples/](../examples)).

**Lit:** bind the property, and listen with `@change`.

```js
html`<consistent-date-picker .selectedDate=${value} @change=${(e) => save(e.detail.value)}></consistent-date-picker>`
```

**Vue 3:** tell Vue the tag is a custom element, or it warns that it can't find the component:

```js
// vite.config.js
vue({ template: { compilerOptions: { isCustomElement: (tag) => tag === 'consistent-date-picker' } } })
```

```vue
<consistent-date-picker :selectedDate="value" @change="(e) => (value = e.detail.value)" />
```

With TypeScript, add the picker's template types once, in any `.d.ts` file your project includes (like `src/env.d.ts`):

```ts
/// <reference types="consistent-date-picker/vue" />
```

Then your editor and `vue-tsc` check the tag: a number for `selectedDate` is an error, and `e.detail.value` in `@change` is known to be a string. To also catch a misspelled prop, turn on `strictTemplates` in your tsconfig's `vueCompilerOptions`. Without it, Vue treats unknown props as plain attributes.

**React 19:** `onChange` works, but React passes its own event object, which has no `detail`. Read the picker instead, like `e.target.value` on an input:

```jsx
<consistent-date-picker selectedDate={value} onChange={(e) => setValue(e.target.selectedDate)} />
```

(`onchange`, all lowercase, gets the real event with `e.detail` instead.)

**React 18, or React 19 with a proper component:** use the wrapper. It registers the tag itself, so there's no separate `define` import, and `onDateChange` gets the real event:

```jsx
import { DatePicker } from 'consistent-date-picker/react';

<DatePicker selectedDate={value} onDateChange={(e) => setValue(e.detail.value)} />
```

It needs `react` 18 or 19. Lit and Vue apps never install React.

## Properties

| Name | What it does | Default |
|---|---|---|
| `selectedDate` | The date, as `MM/DD/YYYY`, or `''` when empty. Set it to change the date. A loose date like `4/3/2023` is cleaned up to `04/03/2023`. Anything that isn't a date clears it, but stays visible in the field. In HTML, write it as `selecteddate` | `''` |
| `isFieldValid` | Read-only. `true` when the field holds a real date right now, even before the user leaves the field | `false` |
| `label` | The text above the field. Screen readers use it as the field's name | `Date` |
| `name` | The name the form submits the date under | none |
| `required` | An empty field blocks the form and says "Enter a date." | `false` |
| `disabled` | Turns off the field and the button, and closes the calendar | `false` |
| `locale` | Language for month and weekday names, like `fr-FR`. The typed format stays `MM/DD/YYYY`. A bad value falls back to `en-US` with a console warning | `en-US` |
| `strings` | JavaScript only. Replaces any of the UI text, to translate or reword it. Defaults are in [strings.ts](../src/strings.ts) | English |

| Method or event | What it does |
|---|---|
| `focus()` | Puts the cursor in the field |
| `change` | Fires when the user changes the date. `event.detail.value` is the new value. It doesn't fire when your own code sets `selectedDate` |

```js
picker.locale = 'fr-FR';
picker.strings = { hint: 'Format : MM/JJ/AAAA' }; // change just one piece of text
```

## What people can type

Any of these become `04/03/2023`: `4/3/2023`, `04-03-2023`, `4.3.2023`, `4 3 2023`.

The date is checked when the user leaves the field or presses Enter, not while they type. If it's wrong, their text stays so they can fix one digit, and a message says what's wrong:

| Typed | Message |
|---|---|
| `soon`, `2023-04-03` | Enter the date as MM/DD/YYYY, like 04/03/2023. |
| `4/3/23` | Use a four-digit year, like 2023. |
| `01/01/0000` | The year must be from 1 to 9999. |
| `13/01/2024` | The month must be from 1 to 12. |
| `02/29/2023` | February 2023 has 28 days. |
| (empty, required) | Enter a date. |

Two-digit years are rejected, not guessed. `23` could be 1923 or 2023.

## Keyboard

| Where | Key | Does |
|---|---|---|
| Field or button | Down | Open the calendar, or move into it |
| Field or button | Escape | Close the calendar |
| Field | Enter | Check the date and submit the form |
| Calendar days | Arrow keys | Move a day or a week |
| Calendar days | Home / End | Sunday / Saturday of that week |
| Calendar days | Page Up / Page Down | Previous / next month |
| Calendar days | Shift + Page Up / Page Down | Previous / next year |
| Calendar days | Enter or Space | Pick the day |
| Anywhere in the calendar | Escape | Close without picking |
| Anywhere | Tab | Moves through the field, button, month, year, then the days. Tabbing out closes the calendar |

## Forms

It behaves like a built-in input:

- **Submits** the date under its `name`.
- **Blocks submitting** when the date is invalid, or empty and `required`.
- **Enter** in the field submits the form.
- **Reset** puts back the `selecteddate` attribute's value.
- **A disabled `<fieldset>`** disables it too.
- **Invalid text submits `''`**, never an old date, even with `novalidate`.

Older browsers without form support for custom elements (Safari before 16.4) still show a working picker. It just isn't sent with the form.

## Styling

Page CSS can't reach inside the component, so set these on the `consistent-date-picker` element instead. Anything you don't set keeps the default look.

```css
consistent-date-picker {
  --consistent-date-picker-accent: #6200ee;
  --consistent-date-picker-radius: 8px;
}
```

| Custom property | Styles | Default |
|---|---|---|
| `--consistent-date-picker-font-size` | Calendar text, including the month and year dropdowns | `1rem` |
| `--consistent-date-picker-background` | Calendar background | `Canvas` |
| `--consistent-date-picker-text-color` | Calendar text color | `CanvasText` |
| `--consistent-date-picker-border-color` | Calendar and cell borders | the text color |
| `--consistent-date-picker-radius` | Calendar corners | `0` |
| `--consistent-date-picker-accent` | Selected day background | `Highlight` |
| `--consistent-date-picker-accent-text` | Selected day text | `HighlightText` |
| `--consistent-date-picker-error-color` | Error text and invalid-outline color. Set it if your page's background doesn't match the OS theme | `#b3261e` (light) / `#f2b8b5` (dark), following the OS theme |

The text field uses the page's font. Set `font-family` or `font-size` on the `consistent-date-picker` element to change it.

The default colors switch with light and dark mode on their own. A color you set doesn't switch, so set it again inside a `prefers-color-scheme` media query if you need it to. If you set the colors, checking their contrast is up to you. There's no property for the focus ring, so it can't blend into the day behind it by accident.

### Parts

For anything the properties don't cover, style the pieces directly with `::part()`:

```css
consistent-date-picker::part(input) { border-radius: 6px; }
consistent-date-picker::part(day selected) { border-radius: 50%; }
consistent-date-picker::part(day):hover { background: #eee; }
```

| Part | The piece |
|---|---|
| `label` | The text above the field |
| `input` | The text field |
| `button` | The calendar button |
| `hint` | The format hint under the field |
| `error` | The error message under the field |
| `calendar` | The calendar popup |
| `header` | The row holding the month and year dropdowns |
| `month` | The month dropdown |
| `year` | The year dropdown |
| `grid` | The table of days |
| `weekday` | A day-name column header |
| `day` | A day |
| `selected` | The selected day, alongside `day`: `::part(day selected)` |
| `today` | Today, alongside `day`: `::part(day today)` |
| `empty` | A blank cell before the 1st or after the last day |

`::part()` styles one element. It can't reach inside a part, so `::part(calendar) td` doesn't work; use `::part(day)`. Pseudo-classes work, like `:hover` and `:focus-visible`. **If you restyle `:focus-visible`, keep a clearly visible ring**, because keyboard users need it to see where they are (WCAG 2.4.7).

## Server rendering

Frameworks that render on the server (Next.js, Nuxt, Astro) can import the package there. It won't crash: Lit's Node build stands in for the browser pieces Node doesn't have. The server sends the tag as plain HTML, and the picker appears once the browser loads its script.

- **Next.js:** import it from a client component (`'use client'`), because the React wrapper uses hooks. No dynamic import is needed. The wrapper's props, like `selectedDate`, arrive right after hydration. With the bare tag, attributes such as `selectedDate="04/03/2023"` are in the server HTML and become the starting value.
- **Nuxt:** add `isCustomElement` under `vue.compilerOptions` in `nuxt.config`, and import `consistent-date-picker/define` from a plugin.
- **Astro:** write the tag as plain HTML and import `define` in a `<script>`. Astro bundles that for the browser. `client:only` isn't needed; it's for framework components, not custom elements.

```astro
<consistent-date-picker name="when" label="Meeting date"></consistent-date-picker>
<script>
  import 'consistent-date-picker/define';
</script>
```

The picker isn't rendered on the server. Its calendar and field are drawn in the browser, so with JavaScript off there's no picker.

## Editor support

The package ships `custom-elements.json`, the standard description of the tag. Editor plugins that read it, like lit-plugin for Lit templates, can autocomplete the properties, events and CSS properties. In TypeScript, `addEventListener('change', ...)` knows `event.detail.value` is a string.

## Limits

- `MM/DD/YYYY` only, and weeks start on Sunday. `locale` changes names, not the format
- Years 1 to 9999
- One date: no ranges, no times, no timezones
- Tested in Chromium only so far

## Navigation

- **[Index](INDEX.md)** - Start here
- **[How it works](date-picker.md)** - The inside: rules, state, decisions
- **[Testing](testing.md)** - Running and trusting the tests
- **[Pitfalls](pitfalls.md)** - Problems most date pickers hit
