// Componentes visuais reutilizados pelas telas.
import * as Kana from './kana.js';
import { Store } from './store.js';
import { Speech } from './speech.js';
import { furiganaNodes } from './furigana.js';
import { wordsWithFurigana, PARTICLES, GRAMMAR } from './glossary.js';
import { Content, VocabItem } from './content.js';
import { openTracing } from './trace.js';

/** h('div.card', {onclick}, filhos...) — cria elementos sem innerHTML (texto sempre escapado). */
export function h(tag, attrs, ...children) {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
    children.unshift(attrs);
    attrs = null;
  }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className += (el.className ? ' ' : '') + v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [sk, sv] of Object.entries(v)) if (sv != null) el.style.setProperty(sk.startsWith('--') ? sk : sk.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()), sv);
    }
    else if (k in el && k !== 'list' && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/** Marca trechos em japonês para usar a fonte/tamanho de japonês. */
export function jpSpan(text) {
  return Kana.containsJapanese(text) ? h('span.jp', { lang: 'ja' }, text) : text;
}

/** Texto em japonês com furigana em cima dos kanji. Sem leitura (ou sem kanji) = texto simples. */
export function jpText(tag, jp, reading, attrs = {}) {
  const nodes = reading && Kana.containsKanji(jp) ? furiganaNodes(jp, reading) : null;
  const el = h(tag, { lang: 'ja', ...attrs }, nodes || jp);
  if (nodes) el.classList.add('has-ruby');
  el.furigana = !!nodes;
  return el;
}

function rubyNode(text, rt) {
  return h('ruby', text, h('rt', rt));
}

/**
 * Frase em japonês em que cada palavra conhecida pode ser tocada para ver o significado
 * (Ajustes → "Tocar numa palavra mostra o significado"). Com leitura, põe furigana como jpText.
 */
export function tappableJp(tag, jp, reading, attrs = {}) {
  const words = wordsWithFurigana(jp, reading);
  let ruby = false;
  const nodes = words.map((w) => {
    const inner = w.parts.map((p) => {
      if (!p.reading) return p.text;
      ruby = true;
      return rubyNode(p.text, p.reading);
    });
    if (!w.entries && !w.particle && !w.grammar) return inner;
    return h('span.w', { role: 'button', tabindex: 0, onclick: (e) => { e.stopPropagation(); showWord(w); } }, inner);
  });
  const el = h(tag, { lang: 'ja', ...attrs }, nodes);
  if (ruby) el.classList.add('has-ruby');
  el.furigana = ruby;
  return el;
}

/** Folha com o significado da palavra tocada. */
function showWord(w) {
  Speech.speak(w.entries?.[0]?.base ? w.entries[0].jp : w.text);
  const reading = w.parts.filter((p) => p.reading).length ? w.parts.map((p) => p.reading || p.text).join('') : null;
  const body = [];
  if (w.particle) {
    body.push(h('div.word-entry', h('div.word-kind', 'partícula'), h('div.word-meaning', PARTICLES[w.particle])));
  }
  if (w.grammar) {
    body.push(h('div.word-entry', h('div.word-kind', 'gramática'), h('div.word-meaning', GRAMMAR[w.grammar])));
  }
  // a mesma palavra pode vir de várias lições com traduções diferentes: junta numa só
  const merged = [];
  for (const e of w.entries || []) {
    const same = merged.find((m) => m.jp === e.jp && m.reading === e.reading && m.kind === e.kind);
    if (!same) merged.push({ ...e });
    else if (!same.meaning.split('; ').includes(e.meaning)) same.meaning += '; ' + e.meaning;
  }
  for (const e of merged.slice(0, 4)) {
    const addBtn = e.kind === 'palavra' ? h('button.btn.small', { type: 'button' }, '＋ Revisão') : null;
    if (addBtn) {
      const v = new VocabItem(e.jp, e.reading, e.meaning, 'toque');
      const inSrs = !!Store.data.Srs[v.key];
      addBtn.disabled = inSrs;
      if (inSrs) addBtn.textContent = '✓ Na revisão';
      addBtn.onclick = () => { Store.addToSrs(v); Store.save(); addBtn.textContent = '✓ Na revisão'; addBtn.disabled = true; };
    }
    body.push(h('div.word-entry',
      h('div.word-head', h('span.word-jp', { lang: 'ja' }, e.jp), e.reading && e.reading !== e.jp ? h('span.word-reading', { lang: 'ja' }, e.reading) : null),
      h('div.word-meaning', e.meaning),
      h('div.btn-row',
        Speech.available ? button('🔊 Ouvir', () => Speech.speak(e.jp), 'btn small') : null,
        addBtn),
      e.base ? h('div.word-kind', `forma de ${e.jp}`) : e.kind === 'kanji' ? h('div.word-kind', 'kanji') : null));
  }
  // qualquer kanji da palavra pode ser praticado na escrita, mesmo fora da lista de kanji do curso
  const kanjiChars = [...new Set([...w.text].filter(Kana.isKanji))];
  const meaningOf = (c) => Content.kanji.find((k) => k.char === c)?.meaning || '';
  const close = sheet(h('div.word-sheet',
    h('div.word-big', { lang: 'ja' }, w.text),
    reading && reading !== w.text ? h('div.word-big-reading', { lang: 'ja' }, reading) : null,
    body,
    kanjiChars.length
      ? button(`✍️ Escrever ${kanjiChars.length === 1 ? 'o kanji' : 'os kanji'} ${kanjiChars.join(' ')}`, () => { close(); openTracing(kanjiChars, 0, meaningOf); })
      : null));
}

export const icons = {
  volume: '🔊', slow: '🐢', play: '▶', back: '‹', next: '›', close: '✕', pen: '✍️', mic: '🎙', check: '✓',
};

export function button(text, onclick, cls = 'btn') {
  return h('button.' + cls.split(' ').join('.'), { type: 'button', onclick }, text);
}

export function infoBox(text, kind = 'neutral') {
  const box = h('div.info.info-' + kind);
  text.split('\n').forEach((line, i) => {
    if (i) box.append(h('br'));
    box.append(jpSpan(line));
  });
  return box;
}

export function progressBar(value, color) {
  const fill = h('div.bar-fill', { style: { width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` } });
  if (color) fill.style.background = color;
  return h('div.bar', fill);
}

export function section(text) { return h('h3.section', text); }

export function speakButtons(text, cls = '') {
  if (!Speech.available) return null;
  return h('div.speak-row' + (cls ? '.' + cls : ''),
    h('button.icon-btn', { type: 'button', 'aria-label': 'Ouvir', onclick: (e) => { e.stopPropagation(); Speech.speak(text); } }, icons.volume),
    h('button.icon-btn.soft', { type: 'button', 'aria-label': 'Ouvir devagar', onclick: (e) => { e.stopPropagation(); Speech.speak(text, true); } }, icons.slow));
}

/** Bloco grande de japonês com leitura (furigana em linha) e romaji. */
export function jpBlock(jp, { size = 'md', reading = null, romaji = null, speak = null } = {}) {
  const main = jpText('div.jp-main.size-' + size, jp, reading);
  return h('div.jp-block',
    reading && !main.furigana ? h('div.jp-reading', { lang: 'ja' }, reading) : null,
    main,
    romaji ? h('div.jp-romaji', romaji) : null,
    speak ? speakButtons(speak) : null);
}

/** Cartão de frase: japonês, leitura, romaji, tradução. Toque = ouvir; 🐢 = devagar. */
export function sentenceCard(jp, reading, meaning, { speaker = null, speakerColor = null, show = false } = {}) {
  reading = reading && reading.trim() ? reading : jp;
  const s = Store.settings;
  const main = (s.TapToDefine ? tappableJp : jpText)('div.sc-jp', jp, s.ShowReading ? reading : null);
  const body = h('div.sc-body',
    main,
    s.ShowReading && Kana.containsKanji(jp) && !main.furigana ? h('div.sc-reading', { lang: 'ja' }, reading.replaceAll(' ', '')) : null,
    s.ShowRomaji && Kana.containsJapanese(reading) ? h('div.sc-romaji', Kana.toRomaji(reading)) : null,
    ...meaning.split('\n').map((m) => h('div.sc-meaning', jpSpan(m))));
  const card = h('div.sentence-card', { role: 'button', tabindex: 0, onclick: () => Speech.speak(jp) },
    speaker ? h('div.avatar', { lang: 'ja', style: { background: speakerColor } }, speaker.slice(0, 2)) : null,
    body,
    h('div.sc-side',
      Speech.available ? h('button.icon-btn.soft.small', { type: 'button', 'aria-label': 'Ouvir devagar', onclick: (e) => { e.stopPropagation(); Speech.speak(jp, true); } }, icons.slow) : null,
      show ? h('button.icon-btn.soft.small', { type: 'button', 'aria-label': 'Mostrar para alguém em tela cheia', onclick: (e) => { e.stopPropagation(); showBig(jp, meaning.split('\n')[0]); } }, '🔎') : null));
  return card;
}

/** Frase em tela cheia, letras grandes, para mostrar a um atendente. Toque para fechar. */
export function showBig(jp, meaning) {
  const close = () => { overlay.remove(); if (history.state?.big) history.back(); };
  const overlay = h('div.big-overlay', { role: 'dialog', 'aria-label': 'Frase em tela cheia', onclick: close },
    h('div.big-jp', { lang: 'ja' }, jp),
    h('div.big-meaning', meaning),
    h('div.btn-row.center',
      Speech.available ? h('button.btn', { type: 'button', onclick: (e) => { e.stopPropagation(); Speech.speak(jp, true); } }, '🔊 Ouvir devagar') : null,
      h('button.btn', { type: 'button', onclick: close }, 'Fechar')),
    h('div.big-tip', 'Mostre a tela para a pessoa. Toque em qualquer lugar para fechar.'));
  document.body.append(overlay);
  history.pushState({ big: true }, '');
  const onPop = () => { window.removeEventListener('popstate', onPop); overlay.remove(); };
  window.addEventListener('popstate', onPop);
  // texto o maior possível sem cortar
  const el = overlay.firstChild;
  let size = 96;
  el.style.fontSize = size + 'px';
  while (size > 28 && (el.scrollHeight > window.innerHeight * 0.55 || el.scrollWidth > window.innerWidth - 32)) { size -= 4; el.style.fontSize = size + 'px'; }
}

export function vocabTile(v, accent) {
  const s = Store.settings;
  const main = jpText('div.vt-jp', v.jp, s.ShowReading ? v.reading : null);
  const sub = [];
  if (v.hasKanji && s.ShowReading && !main.furigana) sub.push(v.reading);
  if (s.ShowRomaji) sub.push(v.romaji);
  const el = h('button.vocab-tile', { type: 'button', onclick: () => Speech.speak(v.jp) },
    main,
    sub.length ? h('div.vt-sub', { lang: 'ja' }, sub.join(' · ')) : null,
    h('div.vt-meaning', v.meaning));
  if (accent) el.style.setProperty('--accent-local', accent);
  return el;
}

export function charTile(ch, sub, { weak = 0, onclick, onlong, big = false } = {}) {
  if (!ch) return h('div.char-tile.empty');
  const el = h('button.char-tile' + (big ? '.big' : ''), { type: 'button', onclick },
    h('div.ct-char', { lang: 'ja' }, ch),
    h('div.ct-sub', sub),
    weak > 0 ? h('span.weak-dot', { title: 'Você costuma errar' }) : null);
  if (onlong) onLongPress(el, onlong);
  return el;
}

/** Pressionar e segurar (≈ duplo clique / clique direito do desktop). */
export function onLongPress(el, fn) {
  let timer = null;
  let fired = false;
  const start = () => { fired = false; timer = setTimeout(() => { fired = true; navigator.vibrate?.(15); fn(); }, 520); };
  const cancel = () => clearTimeout(timer);
  el.addEventListener('pointerdown', start);
  el.addEventListener('pointerup', cancel);
  el.addEventListener('pointerleave', cancel);
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  el.addEventListener('click', (e) => { if (fired) { e.stopImmediatePropagation(); e.preventDefault(); fired = false; } }, true);
}

export function statTile(icon, value, label, color) {
  return h('div.stat', { style: { '--c': color } },
    h('div.stat-icon', icon),
    h('div', h('div.stat-value', value), h('div.stat-label', label)));
}

export function lessonCard(lesson, { wide = false, onclick } = {}) {
  const lp = Store.data.Lessons[lesson.id];
  const done = !!lp?.Completed;
  const color = lesson.module.color || '#C0392B';
  return h('button.lesson-card' + (done ? '.done' : ''), { type: 'button', onclick, style: { '--mc': color } },
    h('div.lc-circle', done ? icons.check : String(lesson.index + 1)),
    h('div.lc-text',
      wide ? h('div.lc-module', lesson.module.title) : null,
      h('div.lc-title', lesson.title),
      h('div.lc-sub', { lang: 'ja' }, lesson.subtitle),
      lp && lp.Attempts > 0 ? h('div.lc-score' + (done ? '.ok' : '.warn'), done ? `Concluída · ${lp.BestScore}%` : `Melhor: ${lp.BestScore}%`) : null));
}

let toastTimer = null;
export function toast(text) {
  let el = document.getElementById('toast');
  if (!el) {
    el = h('div.toast', { id: 'toast', role: 'status' });
    document.body.append(el);
  }
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

/** Folha que sobe de baixo (detalhes de kanji etc.). */
export function sheet(content, { onclose } = {}) {
  const close = () => { overlay.classList.remove('open'); setTimeout(() => overlay.remove(), 200); onclose?.(); };
  const overlay = h('div.sheet-overlay', { onclick: (e) => { if (e.target === overlay) close(); } },
    h('div.sheet', h('div.sheet-handle'), h('button.icon-btn.sheet-close', { type: 'button', 'aria-label': 'Fechar', onclick: close }, icons.close), content));
  document.body.append(overlay);
  setTimeout(() => overlay.classList.add('open'), 20);
  return close;
}

// ================= teoria (mini-markdown) =================
/** Linhas: # título, ## subtítulo, - item, > dica, ! atenção, ex: exemplo, |tabela|, **negrito**. */
export function renderTheory(lines) {
  const root = h('div.theory');
  let i = 0;
  while (i < lines.length) {
    if (lines[i].trimStart().startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].trimStart().startsWith('|')) {
        const cells = lines[i].trim().replace(/^\|+|\|+$/g, '').split('|').map((c) => c.trim());
        if (!cells.every((c) => c.length > 0 && /^[-:]+$/.test(c))) rows.push(cells);
        i++;
      }
      if (rows.length) {
        const table = h('table',
          h('thead', h('tr', rows[0].map((c) => h('th', inline(c))))),
          h('tbody', rows.slice(1).map((r) => h('tr', r.map((c) => h('td', inline(c)))))));
        root.append(h('div.table-wrap', table));
      }
      continue;
    }
    const line = lines[i++];
    if (line.startsWith('# ')) root.append(h('h2.t-h1', inline(line.slice(2))));
    else if (line.startsWith('## ')) root.append(h('h3.t-h2', inline(line.slice(3))));
    else if (line.startsWith('- ')) {
      let ul = root.lastElementChild;
      if (!ul || ul.tagName !== 'UL') { ul = h('ul'); root.append(ul); }
      ul.append(h('li', inline(line.slice(2))));
    } else if (line.startsWith('> ')) root.append(h('div.t-tip', '💡 ', inline(line.slice(2))));
    else if (line.startsWith('! ')) root.append(h('div.t-warn', '⚠ ', inline(line.slice(2))));
    else if (line.startsWith('ex: ')) root.append(h('div.t-ex', inline(line.slice(4))));
    else if (!line.trim()) root.append(h('div.t-gap'));
    else root.append(h('p', inline(line)));
  }
  return root;
}

function inline(text) {
  return text.split('**').map((part, idx) => {
    const content = jpRuns(part);
    return idx % 2 === 1 ? h('strong', content) : content;
  });
}

function jpRuns(s) {
  const out = [];
  let buf = '';
  let cur = null;
  const neutral = ' ·→(),/';
  for (const ch of s) {
    const jp = Kana.containsJapanese(ch);
    if (cur !== null && !neutral.includes(ch) && jp !== cur) {
      out.push(cur ? h('span.jp', { lang: 'ja' }, buf) : buf);
      buf = '';
    }
    if (!neutral.includes(ch) || cur === null) cur = jp;
    buf += ch;
  }
  if (buf) out.push(cur ? h('span.jp', { lang: 'ja' }, buf) : buf);
  return out;
}
