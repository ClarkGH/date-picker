// Server frameworks (Next, Nuxt, Astro) import packages in Node, where there's no window or DOM.
// Each entry has to import without throwing, and server rendering has to produce the tag.
// react19-ssr covers the React wrapper; this covers the rest.
import assert from 'node:assert/strict';

assert.equal(typeof window, 'undefined', 'this check needs a plain Node environment');

const main = await import('consistent-date-picker');
assert.equal(typeof main.DatePicker, 'function', 'the main entry exports DatePicker');

await import('consistent-date-picker/define'); // Lit's Node build supplies a stand-in customElements
assert.equal(globalThis.customElements?.get('consistent-date-picker'), main.DatePicker, '/define registers the tag');

const { createSSRApp, h } = await import('vue');
const { renderToString } = await import('vue/server-renderer');
const app = createSSRApp({ render: () => h('consistent-date-picker', { name: 'when', selectedDate: '04/03/2023' }) });
app.config.compilerOptions.isCustomElement = (tag) => tag === 'consistent-date-picker';
const html = await renderToString(app);
assert.match(html, /<consistent-date-picker name="when" selectedDate="04\/03\/2023"><\/consistent-date-picker>/);

console.log('node: every entry imports, and Vue server-renders the tag');
