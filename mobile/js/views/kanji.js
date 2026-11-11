// Kanji por nível e grupo.
import { Content } from '../content.js';
import { Store } from '../store.js';
import { Speech } from '../speech.js';
import * as Ex from '../exercises.js';
import { openTracing } from '../trace.js';
import { h, button, infoBox, section, sentenceCard, charTile, sheet } from '../ui.js';
import { page, title, row } from './common.js';
import { App } from '../app.js';

const levelName = (l) => ({ N5: 'N5 · iniciante', N4: 'N4 · básico', N3: 'N3 · intermediário' }[l] || l);
const levelOrder = (l) => ({ N5: 0, N4: 1, N3: 2, N2: 3 }[l] ?? 9);

export function KanjiView(level) {
  const levels = [...new Set(Content.kanji.map((k) => k.level))].sort((a, b) => levelOrder(a) - levelOrder(b));
  if (!levels.includes(level)) level = levels[0] || '';
  const items = Content.kanji.filter((k) => k.level === level);
  const groups = new Map();
  for (const k of items) { if (!groups.has(k.group)) groups.set(k.group, []); groups.get(k.group).push(k); }

  return page(
    ...title('Kanji', 'Estude um grupo por vez: veja os detalhes, trace cada kanji e faça o quiz. Com 70%+ os kanji entram na revisão (SRS).'),
    Content.kanji.length === 0 ? infoBox('Nenhum kanji encontrado.', 'error') : null,
    h('div.pills', levels.map((l) => h('button.pill' + (l === level ? '.active' : ''), { type: 'button', onclick: () => App.go('kanji/' + l, true) }, levelName(l)))),
    [...groups.entries()].map(([g, set]) => {
      const gkey = `${level}:${g}`;
      const done = Store.hasKanjiGroup(gkey);
      const describe = (c) => set.find((x) => x.char === c)?.meaning || '';
      return h('div.kanji-group',
        h('div.group-head',
          h('h3.section' + (done ? '.done' : ''), `${done ? '✓ ' : ''}Grupo ${g + 1}`),
          h('div.btn-row',
            button('▶ Quiz', () => startKanjiQuiz(set, gkey), 'btn small'),
            button('✍️ Traçar', () => openTracing(set.map((k) => k.char), 0, describe), 'btn small'))),
        h('div.char-grid', set.map((k, i) => charTile(k.char, k.meaning.split(/[;,]/)[0].trim(), {
          big: true,
          weak: Store.data.Mistakes['k:' + k.char] || 0,
          onclick: () => showKanjiDetail(k),
          onlong: () => openTracing(set.map((x) => x.char), i, describe),
        }))));
    }),
  );
}

function showKanjiDetail(k) {
  const dash = (s) => (s && s.trim() ? s : '—');
  sheet(h('div.kanji-detail',
    h('div.kanji-big', { lang: 'ja' }, k.char),
    h('div.kanji-meaning', k.meaning),
    infoBox(`音読み on'yomi (leitura chinesa):  ${dash(k.on)}\n訓読み kun'yomi (leitura japonesa):  ${dash(k.kun)}`, 'indigo'),
    row(
      Speech.available ? button('🔊 Ouvir', () => Speech.speak(k.words[0]?.jp ?? k.char)) : null,
      button('✍️ Traçar', () => openTracing([k.char], 0, () => k.meaning))),
    k.words.length ? [section('Palavras com este kanji'), h('div.cards', k.words.map((w) => sentenceCard(w.jp, w.reading, w.meaning)))] : null,
    infoBox("On'yomi (katakana) costuma aparecer em palavras compostas de 2+ kanji (ex.: 日本). Kun'yomi (hiragana) aparece quando o kanji está sozinho ou com okurigana (ex.: 食べる).", 'neutral')));
}

function startKanjiQuiz(set, gkey) {
  App.runExercises({
    title: 'Quiz de kanji',
    generator: () => Ex.kanjiDrill(set),
    onComplete: (r) => {
      let xp = r.correct * 2;
      let msg = `+${xp} XP`;
      if (r.percent >= 70) {
        if (Store.addKanjiGroup(gkey)) xp += 15;
        for (const k of set) Store.addKanjiToSrs(k);
        msg = `+${xp} XP · Grupo concluído! Os kanji entraram na sua revisão.`;
      }
      Store.addXp(xp);
      return msg;
    },
  });
}
