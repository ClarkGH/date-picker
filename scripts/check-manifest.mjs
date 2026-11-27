// Checks custom-elements.json against the API documented in docs/usage.md (properties, events, CSS properties, parts), so the manifest,
// the code's JSDoc, and the docs can't drift apart. Runs at the end of `pnpm build`.
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync('custom-elements.json', 'utf8'));
const usage = readFileSync('docs/usage.md', 'utf8');
const problems = [];

/** The first column of every table row in a section, minus its backticks. */
function firstColumn(section) {
  const start = usage.indexOf(`## ${section}\n`);
  if (start === -1) throw new Error(`docs/usage.md has no "## ${section}" section`);
  const end = usage.indexOf('\n## ', start + 1);
  return usage
    .slice(start, end === -1 ? undefined : end)
    .split('\n')
    .map((line) => /^\| `([^`]+)` \|/.exec(line)?.[1])
    .filter(Boolean);
}

function compare(what, documented, inManifest) {
  for (const name of documented) if (!inManifest.includes(name)) problems.push(`${what} "${name}" is in docs/usage.md but not the manifest`);
  for (const name of inManifest) if (!documented.includes(name)) problems.push(`${what} "${name}" is in the manifest but not docs/usage.md`);
}

const element = manifest.modules.flatMap((m) => m.declarations ?? []).find((d) => d.customElement);
if (!element) {
  problems.push('no custom element in the manifest');
} else {
  if (element.tagName !== 'consistent-date-picker') problems.push(`tag is "${element.tagName}"`);

  const documented = firstColumn('Properties');
  const events = documented.filter((n) => n === 'change');
  const methods = documented.filter((n) => n.endsWith('()'));
  const properties = documented.filter((n) => !events.includes(n) && !methods.includes(n));
  compare('property', properties, (element.members ?? []).filter((m) => m.kind === 'field').map((m) => m.name));
  compare('event', events, (element.events ?? []).map((e) => e.name));
  const styling = firstColumn('Styling');
  compare('CSS property', styling.filter((n) => n.startsWith('--')), (element.cssProperties ?? []).map((c) => c.name));
  compare('part', styling.filter((n) => !n.startsWith('--')), (element.cssParts ?? []).map((p) => p.name));

  const attributes = (element.attributes ?? []).map((a) => a.name);
  if (!attributes.includes('selecteddate')) problems.push('attribute "selecteddate" is missing');
  for (const name of attributes) if (name !== name.toLowerCase()) problems.push(`attribute "${name}" isn't lowercase, which HTML needs`);
}

const definitions = manifest.modules.flatMap((m) => m.exports ?? []).filter((e) => e.kind === 'custom-element-definition');
if (!definitions.some((d) => d.name === 'consistent-date-picker')) problems.push('no custom-element-definition for consistent-date-picker');

if (problems.length) {
  console.error(`custom-elements.json doesn't match the docs:\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}
console.log('custom-elements.json matches docs/usage.md');
