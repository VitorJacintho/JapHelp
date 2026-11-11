// Peças usadas por várias telas.
import { h } from '../ui.js';

export const COLORS = { accent: '#d64545', indigo: '#34498c', success: '#27965a', warning: '#d68c14' };

export const page = (...children) => h('div.page', ...children);
export const title = (text, sub) => [h('h1.page-title', text), sub ? h('p.page-sub', sub) : null];
export const row = (...items) => h('div.btn-row', ...items);
