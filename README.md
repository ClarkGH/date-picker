# date-picker
POC date-picker. Consistent across browsers.

## Using it

```html
<date-picker name="start" label="Start date" required></date-picker>
```

Properties, keyboard, forms and styling: [Using the date picker](docs/usage.md).

## Running Locally
1. Clone Repo
2. run `$ pnpm dev`
3. ???
4. Profit.

## The Stack
1. Typescript
2. HTML 5 Web Components and Lit
3. CSS
4. Popper - Calendar positioning
5. Vitest + jsdom - Unit and component tests
6. Playwright + axe - Browser, accessibility, and form tests
7. [Documentation Overview](docs/INDEX.md)

## Testing

- `$ pnpm test` - unit and component specs, colocated as `*.spec.ts`
- `$ pnpm typecheck` - TypeScript over `src/` and `e2e/`, specs included
- `$ pnpm exec playwright install chromium` - once, downloads the browser for the next command
- `$ pnpm test:e2e` - Playwright + axe in Chromium; starts the dev server itself
