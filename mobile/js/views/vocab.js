// Decks de vocabulário.
import { Content } from '../content.js';
import { Store } from '../store.js';
import { Speech } from '../speech.js';
import * as Ex from '../exercises.js';
import { h, icons, button, infoBox, section, vocabTile, toast } from '../ui.js';
import { page, title, row } from './common.js';
import { App } from '../app.js';
import { learnPanel } from './learnpanel.js';
import { sentencePool } from '../drills.js';

export function VocabView(idx) {
  if (idx != null && Content.decks[+idx]) return deckView(Content.decks[+idx]);
  const byLevel = new Map();
  Content.decks.forEach((d, i) => { const k = d.level || 'Outros'; if (!byLevel.has(k)) byLevel.set(k, []); byLevel.get(k).push([d, i]); });
  return page(
    ...title('Decks de vocabulário', 'Faça o quiz de um deck com 70% ou mais para concluí-lo — as palavras entram na revisão espaçada.'),
    Content.decks.length === 0 ? infoBox('Nenhum deck encontrado.', 'error') : null,
    [...byLevel.entries()].map(([lvl, decks]) => [
      section(lvl),
      h('div.menu', decks.map(([d, i]) => {
        const done = Store.hasDeck(d.key);
        const inSrs = d.items.filter((v) => Store.data.Srs[v.key]).length;
        return h('button.menu-item' + (done ? '.done' : ''), { type: 'button', onclick: () => App.go('vocab/' + i) },
          h('span.menu-icon', { lang: 'ja' }, d.icon),
          h('span.menu-text', h('strong', (done ? '✓ ' : '') + d.name), h('small', `${d.items.length} palavras · ${inSrs} na revisão`)),
          h('span.chev', '›'));
      })),
    ]),
  );
}

function deckView(deck) {
  const inSrs = deck.items.filter((v) => Store.data.Srs[v.key]).length;
  const done = Store.hasDeck(deck.key);
  return page(
    h('div.sub-head', h('button.icon-btn.ghost', { type: 'button', 'aria-label': 'Voltar', onclick: () => App.go('vocab') }, icons.back),
      h('h1.page-title', { lang: 'ja' }, `${deck.icon}  ${deck.name}`)),
    h('p.muted', `${deck.level} · ${deck.items.length} palavras · ${inSrs} na sua revisão${done ? ' · ✓ deck concluído' : ''}`),
    h('div.stack',
      h('button.btn.primary', { type: 'button', onclick: () => startDeckQuiz(deck) }, '▶ Quiz (20 questões)'),
      row(
        h('button.btn', { type: 'button', disabled: inSrs >= deck.items.length, onclick: () => { deck.items.forEach((v) => Store.addToSrs(v)); Store.save(); toast('Palavras adicionadas à revisão.'); App.render(); } }, '＋ Adicionar à revisão'),
        Speech.available ? button('🔊 Ouvir todas', () => Speech.speakQueue(deck.items.map((i) => i.jp))) : null,
        button('🎙 Treinar fala', () => App.openSpeaking('Deck: ' + deck.name, deck.items)))),
    learnPanel('deck:' + deck.key, deck.name, deck.items, {
      pool: [...Content.decks.flatMap((d) => d.items), ...Content.allVocab], sentences: sentencePool(), intro: false,
    }),
    section('Todas as palavras'),
    h('p.muted.small', 'Toque numa palavra para ouvir.'),
    h('div.vocab-grid', deck.items.map((v) => vocabTile(v))),
  );
}

function startDeckQuiz(deck) {
  const pool = [...Content.decks.flatMap((d) => d.items), ...Content.allVocab];
  App.runExercises({
    title: 'Deck: ' + deck.name,
    generator: () => {
      const m = Store.data.Mistakes;
      const ordered = deck.items
        .map((v) => [v, m[v.key] || 0, Store.data.Srs[v.key] ? 1 : 0, Math.random()])
        .sort((a, b) => b[1] - a[1] || a[2] - b[2] || a[3] - b[3])
        .slice(0, 20).map((x) => x[0]);
      return Ex.shuffle(Ex.vocabDrill(ordered, ordered.length, pool));
    },
    onComplete: (r) => {
      let xp = r.correct * 2;
      let msg = `+${xp} XP`;
      if (r.percent >= 70) {
        if (Store.addDeck(deck.key)) xp += 15;
        deck.items.forEach((v) => Store.addToSrs(v));
        msg = `+${xp} XP · Deck concluído! As palavras entraram na sua revisão.`;
      }
      Store.addXp(xp);
      return msg;
    },
  });
}
