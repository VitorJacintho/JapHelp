// Prática de escrita com o dedo, em 3 níveis, conferindo a ordem e o sentido dos traços (dados do KanjiVG).
//   Fácil   — modelo com os números da ordem dos traços
//   Médio   — modelo apagado, sem números
//   Difícil — quadro vazio: escreva de memória
import * as Kana from './kana.js';
import { Speech } from './speech.js';
import { Store } from './store.js';
import { h, icons } from './ui.js';
import { loadStrokeData } from './strokes.js';
import { createBoard, describeResult } from './board.js';

const LEVELS = [
  ['easy', 'Fácil', 'Modelo com a ordem dos traços'],
  ['medium', 'Médio', 'Modelo sem números'],
  ['hard', 'Difícil', 'Quadro vazio: escreva de memória'],
];
const LEVEL_KEY = 'japhelp.trace.level';
const readLevel = () => { try { return localStorage.getItem(LEVEL_KEY) || 'easy'; } catch { return 'easy'; } };
const saveLevel = (v) => { try { localStorage.setItem(LEVEL_KEY, v); } catch { /* ignora */ } };

export function openTracing(units, index = 0, describe = null) {
  if (!units || units.length === 0) return;
  describe = describe || ((c) => (Kana.isAllKana(c) ? Kana.toRomaji(c) : ''));

  let level = LEVELS.some((l) => l[0] === readLevel()) ? readLevel() : 'easy';
  let data = null; // { "日": [caminhos] }
  let items = units.map((u) => ({ ch: u, label: describe(u) }));
  let i = Math.min(Math.max(index, 0), items.length - 1);
  let hinted = false; // viu a animação antes de conferir (no difícil)

  const refOf = (it) => (data && data[it.ch]) || null;

  // ---------------------------------------------------------------- elementos
  const board = createBoard({
    level,
    // nos níveis com modelo, confere sozinho quando a quantidade de traços fecha
    onStrokeEnd: (b) => { if (b.ref && level !== 'hard' && b.strokeCount === b.ref.length) verify(); },
  });
  const info = h('div.trace-info', { lang: 'ja' });
  const sub = h('div.trace-sub');
  const feedback = h('div.trace-feedback', { role: 'status', 'aria-live': 'polite' });
  const levelBar = h('div.segmented.trace-levels', LEVELS.map(([key, name]) =>
    h('button' + (key === level ? '.active' : ''), { type: 'button', 'data-level': key, onclick: () => setLevel(key) }, name)));
  const checkBtn = h('button.btn.small.primary', { type: 'button', onclick: () => verify() }, '✓ Conferir');
  const animBtn = h('button.btn.small', { type: 'button', onclick: () => animate() }, '▶ Ver ordem');
  const resize = () => board.resize();

  const close = () => {
    window.removeEventListener('resize', resize);
    board.destroy();
    overlay.remove();
    if (history.state?.trace) history.back();
  };
  const overlay = h('div.trace-overlay',
    h('header.trace-top',
      h('button.icon-btn.ghost', { type: 'button', 'aria-label': 'Fechar', onclick: close }, icons.close),
      h('div.trace-title', 'Escrita — 書く練習')),
    levelBar,
    h('div.trace-head', info, sub),
    h('div.trace-canvas-wrap', board.el),
    feedback,
    h('div.btn-row.center.wrap.trace-actions',
      h('button.icon-btn', { type: 'button', 'aria-label': 'Anterior', onclick: () => move(-1) }, icons.back),
      h('button.icon-btn', { type: 'button', 'aria-label': 'Ouvir', onclick: () => Speech.speak(items[i].ch) }, icons.volume),
      h('button.icon-btn', { type: 'button', 'aria-label': 'Próximo', onclick: () => move(1) }, icons.next),
      h('button.btn.small', { type: 'button', onclick: () => board.undo() }, 'Desfazer'),
      h('button.btn.small', { type: 'button', onclick: () => show() }, 'Limpar'),
      animBtn,
      checkBtn));

  // ---------------------------------------------------------------- navegação e estado
  function setLevel(key) {
    level = key;
    saveLevel(key);
    for (const b of levelBar.children) b.classList.toggle('active', b.dataset.level === key);
    board.setLevel(key);
    show();
  }

  function move(d) {
    i = (i + d + items.length) % items.length;
    show();
  }

  function show() {
    hinted = false;
    const it = items[i];
    const ref = refOf(it);
    board.setChar(it.ch, ref);
    info.textContent = it.ch;
    const parts = [];
    if (it.label) parts.push(it.label);
    if (ref && level !== 'hard') parts.push(`${ref.length} ${ref.length === 1 ? 'traço' : 'traços'}`);
    parts.push(`${i + 1}/${items.length}`);
    sub.textContent = parts.join(' · ');
    if (level === 'hard' && it.label) {
      // de memória: mostra o som/significado, não o desenho
      info.textContent = it.label;
      sub.textContent = `Escreva o caractere de memória · ${i + 1}/${items.length}`;
    }
    checkBtn.hidden = !ref;
    animBtn.hidden = !ref;
    setFeedback(!ref ? 'Sem dados de ordem dos traços para este caractere: trace livremente por cima do modelo.'
      : level === 'easy' ? 'Siga os números: cada traço começa onde está o número.'
        : level === 'medium' ? 'Trace por cima do modelo na ordem certa. O app confere quando você terminar.'
          : 'Escreva de memória e toque em "Conferir".', 'neutral');
    Speech.speak(it.ch); // no difícil o som ajuda a lembrar; o desenho continua escondido
  }

  /** Mostra o caractere no topo (no difícil ele fica escondido até conferir ou ver a ordem). */
  function revealTitle() {
    const it = items[i];
    if (level === 'hard') info.textContent = it.label ? `${it.ch}  ${it.label}` : it.ch;
  }

  function setFeedback(text, kind) {
    feedback.className = 'trace-feedback info info-' + kind;
    feedback.replaceChildren(...text.split('\n').flatMap((l, k) => (k ? [h('br'), l] : [l])));
  }

  function verify() {
    if (!board.ref) return;
    if (board.strokeCount === 0) { setFeedback('Desenhe primeiro. ✍️', 'warn'); return; }
    const result = board.check();
    revealTitle();
    const fromMemory = level === 'hard' && !hinted;
    if (result.ok && level !== 'easy' && !hinted) Store.addXp(1);
    const { kind, text } = describeResult(result, { fromMemory });
    setFeedback(result.ok ? text : text + ' Toque em "Limpar" e tente de novo.', kind);
  }

  function animate() {
    if (!board.ref) return;
    if (level === 'hard' && !board.result) hinted = true;
    revealTitle();
    setFeedback(level === 'hard' ? 'Dica: veja a ordem e o sentido dos traços. Quando você começar a escrever, o modelo some.'
      : 'Observe a ordem e o sentido de cada traço. Depois é a sua vez.', 'indigo');
    board.animate();
  }

  // ---------------------------------------------------------------- abrir
  document.body.append(overlay);
  history.pushState({ trace: true }, '');
  const onPop = () => {
    window.removeEventListener('popstate', onPop);
    if (overlay.isConnected) { board.destroy(); history.replaceState(null, ''); overlay.remove(); }
  };
  window.addEventListener('popstate', onPop);
  window.addEventListener('resize', resize);
  setFeedback('Carregando a ordem dos traços…', 'neutral');
  setTimeout(resize, 0);

  loadStrokeData().then((d) => {
    data = d;
    // "きゃ" vira "き" e "ゃ": cada caractere tem a sua ordem de traços
    const expanded = [];
    let newIndex = 0;
    units.forEach((u, k) => {
      const chars = [...u];
      if (k === index) newIndex = expanded.length;
      if (chars.length > 1 && chars.every((c) => d[c])) chars.forEach((c) => expanded.push({ ch: c, label: describe(c) }));
      else expanded.push({ ch: u, label: describe(u) });
    });
    items = expanded;
    i = Math.min(newIndex, items.length - 1);
  }).catch(() => { /* sem dados (offline na primeira vez): traçado livre */ })
    .finally(() => { resize(); show(); });
}
