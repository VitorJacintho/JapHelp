// Hiragana e katakana: tabelas, quiz e escrita.
import * as Kana from '../kana.js';
import { Store } from '../store.js';
import { Speech } from '../speech.js';
import * as Ex from '../exercises.js';
import { openTracing } from '../trace.js';
import { h, button, infoBox, section, charTile, toast } from '../ui.js';
import { page, title, row } from './common.js';
import { App } from '../app.js';

const kanaState = { katakana: false, groups: new Set([0, 1]) };
const rowUnits = (i) => Kana.GojuonRows[i][1].filter((k) => k);
const KANA_GROUPS = [
  ['あ い う え お (vogais)', () => rowUnits(0)],
  ['か行  k', () => rowUnits(1)],
  ['さ行  s', () => rowUnits(2)],
  ['た行  t', () => rowUnits(3)],
  ['な行  n', () => rowUnits(4)],
  ['は行  h', () => rowUnits(5)],
  ['ま行  m', () => rowUnits(6)],
  ['や・ら・わ・ん', () => [...rowUnits(7), ...rowUnits(8), ...rowUnits(9), ...rowUnits(10)]],
  ['Dakuten: が ざ だ ば ぱ', () => Kana.DakutenRows.flatMap((r) => r[1]).filter((k) => k !== 'ぢ' && k !== 'づ')],
  ['Combinações: きゃ しゃ ちゃ…', () => Kana.YoonRows.flatMap((r) => r[1])],
];

export function KanaView() {
  const conv = (k) => (kanaState.katakana ? Kana.toKatakana(k) : k);
  const selectedUnits = () => [...new Set([...kanaState.groups].sort((a, b) => a - b).flatMap((i) => KANA_GROUPS[i][1]().map(conv)))];
  const allUnits = [];
  const tables = [];
  const addSection = (name, rows, cols) => {
    tables.push(section(name));
    const grid = h('div.kana-table', { style: { '--cols': cols } });
    for (const [, kanas] of rows) {
      for (const k of kanas) {
        const ch = k ? conv(k) : '';
        if (ch) allUnits.push(ch);
        grid.append(charTile(ch, ch ? Kana.toRomaji(ch) : '', {
          weak: Store.data.Mistakes['kana:' + ch] || 0,
          onclick: () => Speech.speak(ch),
          onlong: () => openTracing(allUnits, allUnits.indexOf(ch)),
        }));
      }
    }
    tables.push(grid);
  };
  addSection('Básicos (gojūon)', Kana.GojuonRows, 5);
  addSection('Com dakuten ゛ e handakuten ゜', Kana.DakutenRows, 5);
  addSection('Combinações (yōon)', Kana.YoonRows, 3);
  if (kanaState.katakana) {
    const ext = ['ファ', 'フィ', 'フェ', 'フォ', 'ティ', 'ディ', 'トゥ', 'ウィ', 'ウェ', 'ウォ', 'シェ', 'ジェ', 'チェ', 'ヴァ', 'ヴ'];
    tables.push(section('Katakana para sons estrangeiros'),
      h('div.kana-table', { style: { '--cols': 3 } }, ext.map((e) => charTile(e, Kana.toRomaji(e), { onclick: () => Speech.speak(e) }))));
  }

  const weakKana = Object.entries(Store.data.Mistakes).filter(([k]) => k.startsWith('kana:')).sort((a, b) => b[1] - a[1]).map(([k]) => k.slice(5));
  const startQuiz = () => {
    const units = selectedUnits();
    if (!units.length) { toast('Marque pelo menos um grupo.'); return; }
    App.runExercises({
      title: 'Quiz de kana',
      generator: () => Ex.kanaDrill(units, 20),
      onComplete: (r) => { Store.addXp(r.correct); return `+${r.correct} XP`; },
    });
  };
  const startWeak = () => {
    const weak = weakKana.slice(0, 15);
    App.runExercises({
      title: 'Kana que você mais erra',
      generator: () => Ex.kanaDrill(weak, Math.max(10, weak.length * 2)),
      onComplete: (r) => { Store.addXp(r.correct); return `+${r.correct} XP`; },
    });
  };

  return page(
    ...title('Hiragana & Katakana'),
    h('div.segmented',
      h('button' + (!kanaState.katakana ? '.active' : ''), { type: 'button', lang: 'ja', onclick: () => { kanaState.katakana = false; App.render(); } }, 'ひらがな Hiragana'),
      h('button' + (kanaState.katakana ? '.active' : ''), { type: 'button', lang: 'ja', onclick: () => { kanaState.katakana = true; App.render(); } }, 'カタカナ Katakana')),
    h('details.card.quiz-box', { open: true },
      h('summary', h('strong', 'Quiz de kana'), h('span.muted.small', ' — marque os grupos')),
      h('div.chips', KANA_GROUPS.map(([name], i) => {
        const chip = h('button.chip' + (kanaState.groups.has(i) ? '.on' : ''), { type: 'button', lang: 'ja' }, name);
        chip.onclick = () => {
          if (kanaState.groups.has(i)) kanaState.groups.delete(i); else kanaState.groups.add(i);
          chip.classList.toggle('on');
        };
        return chip;
      })),
      row(
        button('Todos', () => { KANA_GROUPS.forEach((_, i) => kanaState.groups.add(i)); App.render(); }, 'btn small'),
        button('Nenhum', () => { kanaState.groups.clear(); App.render(); }, 'btn small')),
      h('div.stack',
        h('button.btn.primary', { type: 'button', onclick: startQuiz }, '▶ Começar quiz (20)'),
        h('button.btn', { type: 'button', disabled: weakKana.length === 0, onclick: startWeak }, `🎯 Kana que mais erro (${weakKana.length})`),
        h('button.btn', { type: 'button', onclick: () => { const u = selectedUnits(); if (u.length) openTracing(u, 0); else toast('Marque pelo menos um grupo.'); } }, '✍️ Praticar escrita do grupo'))),
    h('p.muted.small', 'Toque em um kana para ouvir · segure para traçar · ponto laranja = você costuma errar.'),
    tables,
    infoBox('Dica: aprenda 1 linha por dia. Treine até reconhecer cada kana em menos de 2 segundos — isso faz toda a diferença para ler placas, cardápios e estações no Japão.', 'neutral'),
  );
}
