# Changelog

This project follows [semantic versioning](https://semver.org): a major version for changes that can break a page, minor for new features, patch for fixes.

## 1.0.0

The first release.

- `<consistent-date-picker>`: a text field plus a calendar popup. Type `MM/DD/YYYY` (looser input like `4/3/2023` is cleaned up) or pick a day.
- Keyboard and screen reader support, following the WAI-ARIA date picker pattern. Built to WCAG 2.2 AA: checked with axe in light and dark mode, and tested by hand with the Orca screen reader.
- Works in forms like a native input: `name`, `required`, `disabled`, reset, back/forward restore, and Enter to submit.
- `locale` for month and weekday names, and `strings` to translate or reword any UI text.
- Styling through 8 `--consistent-date-picker-*` custom properties and 15 `::part()` names.
- Entry points:
  - `consistent-date-picker`: the class and types, with no side effects
  - `consistent-date-picker/define`: registers the tag, and is safe to load twice
  - `consistent-date-picker/react`: a React 18 and 19 component with an `onDateChange` prop
  - `consistent-date-picker/vue`: template types for Vue and `vue-tsc`
- Ships `custom-elements.json` for editor tooling, and TypeScript types, including a typed `change` event.
- Safe to import during server rendering (Next.js, Nuxt, Astro).
