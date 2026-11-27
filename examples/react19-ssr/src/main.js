import { createElement } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { App } from './App.js';

// The HTML is already there from prerender.mjs; this attaches React to it, like Next.js does
hydrateRoot(document.getElementById('root'), createElement(App));
