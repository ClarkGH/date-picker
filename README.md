# consistent-date-picker

[![npm](https://img.shields.io/npm/v/consistent-date-picker)](https://www.npmjs.com/package/consistent-date-picker)
[![license](https://img.shields.io/npm/l/consistent-date-picker)](LICENSE)
[![types](https://img.shields.io/npm/types/consistent-date-picker)](https://www.npmjs.com/package/consistent-date-picker)

Consistent across browsers.

A date field with a calendar popup, as one web component. Type a date as MM/DD/YYYY or pick one from the calendar. It works by mouse, keyboard or screen reader, is built to WCAG 2.2 AA (checked with axe and a screen reader), and works in forms like a normal input. Use it in plain HTML, Lit, Vue or React.

## Install

```sh
npm install consistent-date-picker lit
```

Lit 3 is a peer dependency, so your app supplies it.

## Use it

Import `define` once, then use the tag anywhere:

```js
import 'consistent-date-picker/define';
```

```html
<form>
  <consistent-date-picker name="start" label="Start date" required></consistent-date-picker>
</form>
```

It submits under its `name`, blocks the form when it's empty and `required`, and fires `change` with `event.detail.value` (always `MM/DD/YYYY`, or `''`).

**Lit**

```js
html`<consistent-date-picker .selectedDate=${this.start} @change=${(e) => (this.start = e.detail.value)}></consistent-date-picker>`
```

**Vue 3.** Tell Vue it's a custom element, in `vite.config.js`:

```js
vue({ template: { compilerOptions: { isCustomElement: (tag) => tag === 'consistent-date-picker' } } })
```

```vue
<consistent-date-picker :selectedDate="start" @change="(e) => (start = e.detail.value)" />
```

**React 18 or 19.** Use the wrapper, which also registers the tag:

```jsx
import { DatePicker } from 'consistent-date-picker/react';

<DatePicker selectedDate={start} onDateChange={(e) => setStart(e.detail.value)} />
```

**Styling.** Use custom properties for colors and sizes, and `::part()` for anything else:

```css
consistent-date-picker {
  --consistent-date-picker-accent: #6200ee;
}
consistent-date-picker::part(day selected) {
  border-radius: 50%;
}
```

## Browser support

| Browser | Full support from |
|---|---|
| Chrome, Edge | 114 |
| Firefox | 125 |
| Safari | 17 |

Older browsers still get a working picker, with two gaps:
- **Without the popover API**, the calendar opens in place. An `overflow: hidden` parent can clip it.
- **Without form-associated custom elements** (Safari before 16.4), the picker isn't sent with its form.

The browser tests pass in Chromium and Firefox. WebKit, Safari's engine, is set up but hasn't run yet.

## Docs

- **[Using the date picker](docs/usage.md)**: every property, what people can type, the keyboard, forms, styling, server rendering (Next.js, Nuxt, Astro), and TypeScript and Vue types
- **[How it works](docs/date-picker.md)**: for people changing the code
- **[Pitfalls](docs/pitfalls.md)**: the problems most hand-built date pickers run into
- **[Changelog](CHANGELOG.md)**

## Development

For working on the picker itself.

### Running Locally
1. Clone Repo
2. run `$ pnpm dev`
3. ???
4. Profit.

### The Stack
1. Typescript
2. HTML 5 Web Components and Lit
3. CSS
4. Popper - Calendar positioning
5. Vitest + jsdom - Unit and component tests
6. Playwright + axe - Browser, accessibility, and form tests
7. [Documentation Overview](docs/INDEX.md)

### Testing

- `$ pnpm test` - unit and component specs, colocated as `*.spec.ts`
- `$ pnpm typecheck` - TypeScript over `src/` and `e2e/`, specs included
- `$ pnpm exec playwright install chromium firefox webkit` - once, downloads the browsers for the next command
- `$ pnpm test:e2e` - Playwright + axe in Chromium, Firefox and WebKit; starts the dev server itself
- `$ pnpm test:consumers` - packs the library and tests it in the example apps (Lit, Vue, React, server rendering)
