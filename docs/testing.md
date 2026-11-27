# Testing

Two kinds of tests. Fast ones (Vitest) check the logic in a fake browser. Slower ones (Playwright) open a real browser for anything visual or built into the browser, like layout, colors and forms.

## Commands

```sh
pnpm test                              # Vitest: unit and component specs
pnpm typecheck                         # TypeScript over src/ and e2e/, specs included
pnpm build                             # declarations + library build
pnpm exec playwright install chromium  # once, downloads the browser
pnpm test:e2e                          # Playwright + axe; starts the dev server itself
pnpm test:consumers                    # packs the library and tests it in the five example apps
```

## What each suite covers

| File | Covers |
|---|---|
| [date-utils.spec.ts](../src/date-utils.spec.ts) | Leap years, rollover, month grids, year limits, stepping days and months across DST, cached formatters |
| [date-picker.spec.ts](../src/date-picker.spec.ts) | One test per fixed bug, the Popper lifecycle (with Popper mocked), every key, focus, ARIA, errors, values set from outside, locale and strings |
| [strings.spec.ts](../src/strings.spec.ts) | Overrides merge without losing defaults |
| [define.spec.ts](../src/define.spec.ts) | `/define` registers the tag once, a second copy warns instead of crashing, and the main entry registers nothing |
| [types.spec.ts](../src/types.spec.ts) | Type-level checks, enforced by `pnpm typecheck`: `change` listeners get `detail.value`, the tag maps to the class, `isFieldValid` is read-only |
| [check-manifest.mjs](../scripts/check-manifest.mjs) | Runs at the end of `pnpm build`. Fails if `custom-elements.json` and the tables in [usage.md](usage.md) disagree on the tag, properties, events, CSS properties or parts |
| [date-picker.e2e.ts](../e2e/date-picker.e2e.ts) | axe WCAG 2.2 AA scans in light and dark, the focus ring, styling, 320px reflow, escaping `overflow: hidden`, the 24×24 button, no page jump on open, focus, and real form submit, reset and validation |

[e2e/fixture.html](../e2e/fixture.html) is the page the browser tests run against.

**The example apps** in [examples/](../examples) install the packed tarball, not the source, so they test what npm would ship. There are five: Lit, Vue, React 19 with the bare tag, and the React wrapper on both React 18 and React 19. They're built for production, because tree-shaking bugs only show up there: with `sideEffects: false`, the bundler drops `/define`, and they fail. [smoke.e2e.ts](../examples/smoke.e2e.ts) runs the same steps in each one, and also fails on any console error or warning. The Vue app is TypeScript and runs `vue-tsc` first. Its [TypeChecks.vue](../examples/vue/src/TypeChecks.vue) holds deliberate mistakes, each marked `@vue-expect-error`, so if the Vue types ever stop catching one, `vue-tsc` fails.

**Every fix was checked by breaking it.** Each browser test was run with its fix undone, to watch it fail. For example, removing `forceUpdate` makes the page jump from y=1830 to y=64 on open, and the old `red` error color fails axe's contrast rule.

## Things to know

| Gotcha | Why |
|---|---|
| jsdom, not happy-dom | happy-dom's `<select>` reports the wrong value, which failed tests the component passed |
| The timezone is pinned to `America/Sao_Paulo` | Brazil's DST started at midnight, so 2018-11-04 had no midnight. Date math that passes there passes anywhere. A test checks the pin works |
| "Today" is frozen at Nov 24 2026 | Otherwise "opens on this month" breaks on the 1st |
| jsdom has no layout, colors, focus rings, form association, `delegatesFocus` or popovers | Those are tested in Playwright |
| `axe` checks rules, not experience | A clean run doesn't prove it's pleasant with a screen reader. That needs a person. Orca was tested by hand on 2026-11-27; NVDA and VoiceOver haven't been yet |
| `tsconfig.spec.json` exists | The main config emits declarations, and specs shouldn't land in `types/` |

## Navigation

- **[Index](INDEX.md)** - Start here
- **[How it works](date-picker.md)** - The inside: rules, state, decisions
