# date-picker package plan

Turn `<date-picker>` into an npm package that works in React, Vue and Lit (and anything else that renders HTML). Started 2026-11-24.

The component is already a web component, so there's nothing to port. One Lit element stays the source of truth, and each framework gets a small adapter or a docs page only where it needs one. This plan covers the packaging, the adapters, and a test setup that proves each framework actually works.

Each phase ends with a check: something you can run that proves the phase is done. Don't start a phase until the one before it passes its check.

## Where we are

**Restarted 2026-11-26.** Parked 2026-11-24, before Phase 0. The custom properties from Phase 5 and the docs split (usage, how it works, testing) were done in between.

- [x] Phase 0: decisions (2026-11-26)
- [x] Phase 1: toolchain upgrade (2026-11-26). Done before Phase 0 finished, by Clark's call: nothing in it depends on the names. Lit 3.3, TypeScript 6.0, Vite 8, Vitest 5
- [x] Phase 2: package shape (2026-11-26)
- [x] Phase 3: consumer apps (2026-11-27)
- [x] Phase 4: Custom Elements Manifest and types (2026-11-27)
- [x] Phase 5: styling API (2026-11-27)
- [ ] Phase 6: React adapter
- [ ] Phase 7: Vue polish
- [ ] Phase 8: SSR safety
- [ ] Phase 9: docs and release

## Rules for the whole plan

- **The element is the product.** Adapters only map props and events. They never hold their own state or add behavior. If an adapter needs logic, that logic belongs in the element.
- **Consumers test the tarball, not the source.** The example apps install the output of `pnpm pack`, so they test what npm would actually ship, including `exports`, `files` and `types`.
- **The [Rules](docs/date-picker.md#rules) in the component doc still hold.** `selectedDate` is valid or empty, one way in through `_commit`, and so on. Nothing here changes how the picker works.
- **Breaking changes go before the first publish.** The tag name, the event name and the entry points are hard to change once someone depends on them, so they're decided in Phase 0 and built in Phase 2.

## Phase 0: decisions

- [x] **Package name.** *Decided 2026-11-26: `consistent-date-picker`, unscoped (free on npm). Clark's npm account is `clarkusmalarkus`.* Recommended: a scoped name (`@<npm-user>/date-picker`), which can't clash with anyone else's. Check any unscoped name with `pnpm view <name>`.
- [x] **Tag name.** *Decided 2026-11-26: `consistent-date-picker`, the same as the package. The CSS custom properties follow it: `--consistent-date-picker-*`.* `date-picker` is generic, and defining the same custom element name twice throws. Two libraries using that name, or two copies of this one, will crash. Recommended: a short prefix of your own (`<prefix>-date-picker`).
- [x] **Registration.** *Decided 2026-11-26: (b) plus a guard.* (a) Importing the package registers the tag, like today. (b) The main entry exports the class without registering it, and `/define` registers it. Recommended: **(b) plus a guard** (`if (!customElements.get(tag))`), so an app can also register the class under its own tag name.
- [x] **Event name.** *Decided 2026-11-26: keep `change` for now, and settle it with the React 19 app in Phase 3. Settled 2026-11-27: keep `change` (see Phase 3).* Keep `change`, or rename it to `date-change`. `change` reads naturally in Vue and Lit, but React treats `onChange` specially, and it's unclear how React 19 maps it onto a custom element. [VERIFY] Phase 3's React 19 app settles this. Decide here, or wait until Phase 3 and decide then.
- [x] **Oldest React supported.** *Decided 2026-11-26: React 18, with the `@lit/react` wrapper.* React 19 only (no adapter needed), or React 18 as well (Phase 6 builds an `@lit/react` wrapper). Recommended: support 18. Plenty of apps are still on it, and the wrapper is small.
- [x] **Vue `v-model`.** *Decided 2026-11-26: docs and a types file first; a wrapper only if needed.* Docs only (`:selectedDate` plus `@change`), or ship a tiny Vue wrapper component that supports `v-model`. Recommended: docs plus a types file first, and the wrapper only if the docs version feels clunky in the example app.
- [x] **Version.** *Decided 2026-11-26: stay on `0.x` while building (`0.8.0` now), and publish the first release as `1.0.0` in Phase 9.* Publish as `0.x` while the API settles, or go straight to `1.0.0`. Recommended: `0.6.0` first, and `1.0.0` once the example apps have been used for a while.
- [x] **Who writes it.** *Decided 2026-11-26: Claude writes it, Clark reviews.* Clark writes it and Claude reviews, Clark writes the seams and Claude fills in the bodies, or Claude writes it and Clark reviews.

**Check:** every box above has an answer written next to it.

## Phase 1: toolchain upgrade

*Done 2026-11-26.* Lit 3.3.3, TypeScript 6.0.3, Vite 8.4, Vitest 5.1, and `@types/node` 26, unpinned. Notes:
- TypeScript went to 6.0, not 7.0. 7 is the native compiler rewrite, and the tools later phases need, like `vue-tsc`, build on the JavaScript compiler's API.
- TypeScript 6 needed `rootDir` set explicitly, or the type declarations would have moved to `types/src/`. It also needed `moduleResolution: "Bundler"`, because the old `"Node"` setting is deprecated.
- Type-checking `e2e/` found an unused parameter in a test helper straight away.
- The bundle went from 20.75 KB to 19.57 KB (6.32 KB gzipped) with Vite 8's new bundler. Lit and Popper are still left out of it.
- `pnpm audit` is clean. All the dev-tool vulnerabilities are gone.

Already on the [TBD list](docs/INDEX.md#next-steps). Doing it now means the published `peerDependencies` range covers the current Lit release from the start.

- Lit 2 → 3. [VERIFY] against Lit's upgrade guide that `experimentalDecorators` with `useDefineForClassFields: false` is still supported (I believe it is).
- TypeScript 4.9 → 5.x, unpin `@types/node`, and type-check the e2e specs.
- Vite 4 → current, and Vitest to match. Check each one's migration notes.
- `moduleResolution: "Bundler"` in tsconfig. This is also what catches a missing `types` condition in Phase 2.

**Check:** `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` and `pnpm build` all pass, and the bundle size is recorded next to the 21.9 KB in [Decisions](docs/date-picker.md#decisions).

## Phase 2: package shape

*Built 2026-11-26, except what needs the names.* Done: the `exports` map with `types` first, Lit as a peer (`^3.0.0`), `sideEffects`, a guarded `/define`, `.js` import extensions (attw's node16 check failed without them), `license`, `publishConfig.access: public` (scoped packages are private on npm by default), `repository`, `keywords`, and no `public/` in `dist/`. publint and attw (ESM) are clean, and the tarball holds only the expected files. Then, with the names: `name` is `consistent-date-picker`, `TAG_NAME` matches, and the CSS custom properties, console messages, tests and docs were renamed. `private` stays on until Phase 9, so nothing can be published before the API is proven. Skipped on purpose: `engines`, because for a browser library it would only restrict consumers' build tools.

- Remove `"private": true` and set the name from Phase 0.
- Move `lit` to `peerDependencies` (`"^3"`, or `"^2.6 || ^3"` if Lit 2 still passes the tests). Keep it in `devDependencies` too. `@popperjs/core` stays a normal dependency, since apps rarely have it already.
- Entry points, each with a `types` condition listed first:
  ```json
  "exports": {
    ".":        { "types": "./types/index.d.ts",  "import": "./dist/index.js" },
    "./define": { "types": "./types/define.d.ts", "import": "./dist/define.js" }
  }
  ```
- `"sideEffects": ["./dist/define.js"]`, so bundlers can tree-shake the main entry but keep the file that registers the tag.
- Rename the tag, and update `HTMLElementTagNameMap`, the docs, the specs and `index.html`.
- `@customElement` → an explicit, guarded `customElements.define` in `define.ts`.
- Vite lib build with multiple entries. `types/` from `tsc`.
- Add `"engines"` and `"repository"`, and `"keywords"` including `web-component`.

**Check:** `pnpm dlx publint` and `pnpm dlx @arethetypeswrong/cli --pack` report no errors. `pnpm pack` contains only `dist/`, `types/`, `README.md`, `LICENSE` and `package.json`. Importing `/define` twice doesn't throw.

## Phase 3: consumer apps

*Done 2026-11-27.* `pnpm test:consumers` packs the library, installs the tarball fresh into `examples/lit`, `examples/vue` and `examples/react19`, builds each for production, and runs [smoke.e2e.ts](examples/smoke.e2e.ts) against `vite preview`. With `sideEffects: false`, all three fail, so the setup catches production-only bugs. React needed no Vite plugin, since Vite 8 handles JSX. What React 19 does with events:
- It strips `on` and listens for the rest, case-sensitive: `ondate-change` listens for `date-change`, and `onDateChange` for `DateChange`.
- `onChange` is the exception. React treats it as its own built-in change handler, so the handler gets React's synthetic event, with no `detail`. It still fires exactly once, and `e.target` is the picker.
- `onchange`, all lowercase, gets the real `CustomEvent`.
- **Kept `change`.** It's natural in Lit, Vue and plain JavaScript, and React users read `e.target.selectedDate`. Renaming would make them write `ondate-change`.

Build these before the adapters, so every later phase can be proven in every framework.

- `examples/lit`, `examples/vue` and `examples/react19`, each a minimal Vite app installing `../../<name>-x.y.z.tgz`.
- Each app shows the same page: a `<form>` with a required picker, a "set date from outside" button, a readout of the last `change` value, and a submit that prints the form data.
- One Playwright config runs a smoke spec against each app: type a date, pick a day, set the value from outside, receive `change` once, submit the form, and get blocked by `required`.
- Record what React 19 does with `onChange` versus `onchange` (the Phase 0 event-name question).

**Check:** one command (`pnpm test:consumers`) packs the library, installs it into all three apps, and the smoke spec passes in each.

## Phase 4: Custom Elements Manifest and types

*Done 2026-11-27.* `pnpm analyze` (the last step of `pnpm build`) writes `custom-elements.json`, and [check-manifest.mjs](scripts/check-manifest.mjs) fails the build if it disagrees with [usage.md](docs/usage.md). Fixes the first manifest needed:
- The tag was recorded as `TAG_NAME`. `@tagname` fixes the class, and a config plugin fixes the registration entry.
- The attribute came out as `selectedDate`. It's now `attribute: 'selecteddate'`, which Lit already did.
- 45 private members and the form callbacks were listed. A plugin and `@internal` drop them.

The typed event comes from a `DatePickerEventMap` merged into the class, and [types.spec.ts](src/types.spec.ts) proves it fails when broken. **The VS Code hover part of the check was replaced.** Plain VS Code HTML hovers need a different file format (`html.customData`), and the Vue side is Phase 7's template types. The build-time check covers what the manifest says. Seeing it in an editor is a manual try with lit-plugin.

- `@custom-elements-manifest/analyzer` (dev dependency) writes `custom-elements.json`. Add `"customElements": "custom-elements.json"` to package.json, and put the file in `files`.
- JSDoc tags on the class: `@fires change`, `@cssprop --date-picker-error-color`, plus the `@csspart` tags from Phase 5.
- Add the typed event to the global event map, so `addEventListener('change', e => e.detail.value)` is typed in plain TS and Lit.

**Check:** `custom-elements.json` lists every member in the [API table](docs/usage.md#properties). In VS Code, hovering the tag in the Lit and Vue example apps shows its docs.

## Phase 5: styling API

Shadow DOM blocks page CSS. Without hooks, every consumer forks the component to change one color.

*Custom properties done 2026-11-25. Parts done 2026-11-27:* 15 parts (`label`, `input`, `button`, `hint`, `error`, `calendar`, `header`, `month`, `year`, `grid`, `weekday`, `day`, `selected`, `today`, `empty`), each with `@csspart`, listed in [usage.md](docs/usage.md#parts), and checked against the manifest. A fixture picker is restyled only with `::part()`, and each example app with a custom property and a `::part()` rule.

- `part="…"` on the label, input, button, hint, error, dialog, header, grid, and day cells. Day cells also get state parts (`day selected`, `day today`, `day outside`).
- Custom properties for the things people change first: accent color, border color, radius, font, and calendar background. Each one defaults to what the component looks like today.
- A "Styling" section in [date-picker.md](docs/date-picker.md) listing every part and property. Part names are public API once published.

**Check:** each example app restyles the picker using only `::part()` and custom properties, and the existing axe and contrast specs still pass with the default styles.

## Phase 6: React adapter

Only if Phase 0 picked React 18 support.

- `src/react.ts`, using `@lit/react`'s `createComponent`, mapping the event to an `onDateChange` prop (or whatever name Phase 0 chose).
- Exported as `./react`. `react` is an optional peer dependency (`peerDependenciesMeta`). [VERIFY] which React versions the current `@lit/react` supports.
- `examples/react18` joins the consumer smoke spec.
- Note in the docs that React 19 apps can use the tag directly or the wrapper. Both should work.

**Check:** the consumer smoke spec passes in `examples/react18`, and `publint`/`attw` are still clean with the new entry.

## Phase 7: Vue polish

- Docs: `compilerOptions.isCustomElement` for the Vue plugin, binding `.selectedDate` as a property, and the `@change` handler.
- A `vue.d.ts` that adds the tag to Vue's `GlobalComponents`, so templates get prop checking. [VERIFY] the exact way to declare custom elements for Vue's template type checker (Volar) in the current Vue version.
- If Phase 0 chose a wrapper: a small `./vue` entry that supports `v-model`, with `vue` as an optional peer dependency.

**Check:** a typo in a prop name in `examples/vue` fails `vue-tsc`, and the smoke spec still passes.

## Phase 8: SSR safety

Server renderers (Next.js, Nuxt, Astro) run imports in Node, where `customElements` doesn't exist.

- Make sure importing the main entry doesn't touch `customElements`, `window` or `document`, and that only `/define` registers.
- Docs for each framework: client-only import (`'use client'` plus a dynamic import in Next, `<ClientOnly>` in Nuxt, `client:only` in Astro).
- Not doing real SSR of the element's shadow DOM (`@lit-labs/ssr`). Popper and `ElementInternals` are browser-only anyway. Out of scope unless someone needs it.

**Check:** `node -e "import('<name>')"` against the packed tarball doesn't throw. The portfolio site (Astro) can render the picker with `client:only`. That's a local trial, not a change to the portfolio.

## Phase 9: docs and release

- README: install, one short example per framework, and links to the docs.
- `docs/frameworks.md`: the full per-framework guide (Phases 6–8). Add an INDEX.md entry and Navigation links, in the same format as the other docs.
- Move the package-shape choices into [Decisions](docs/date-picker.md#decisions): the peer dependency, the tag prefix, the guarded define, the part names.
- `CHANGELOG.md`, starting at `1.0.0`. The tag and CSS property renames happened before anything was published, so they aren't breaking changes for anyone.
- Set the version to `1.0.0` and remove `"private": true`.
- `pnpm publish --dry-run` and read the file list.

**Check:** the dry run lists only the expected files, and a fresh app that follows only the README works in each framework. Clark does the real `pnpm publish` himself.

## Out of scope

- Rewriting per framework (Stencil, Mitosis, or separate React/Vue components).
- Locale-aware typed format and week start. Already on the TBD list, and a separate piece of work.
- CommonJS output. ESM only.
- Vue 2 and Angular examples. They should work as plain custom elements, but they're not tested.
