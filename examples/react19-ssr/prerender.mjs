// Server-renders App in Node (Lit's and @lit/react's Node builds) into the built index.html,
// so the browser hydrates real server HTML instead of rendering from scratch
import { readFileSync, writeFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { App } from './src/App.js';

const file = 'dist/index.html';
const page = readFileSync(file, 'utf8');
const marker = '<div id="root"></div>';
if (!page.includes(marker)) throw new Error(`${file} has no ${marker}`);
writeFileSync(file, page.replace(marker, `<div id="root">${renderToString(createElement(App))}</div>`));
console.log(`prerendered ${file}`);
