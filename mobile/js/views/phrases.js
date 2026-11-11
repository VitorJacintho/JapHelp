// Frases úteis.
import * as Kana from '../kana.js';
import { Content } from '../content.js';
import { Store } from '../store.js';
import { Speech } from '../speech.js';
import * as Ex from '../exercises.js';
import { h, icons, button, infoBox, sentenceCard } from '../ui.js';
import { page, title, row } from './common.js';
import { App } from '../app.js';

const phraseState = { query: '' };

export function PhrasesView(idx) {
  if (idx != null && Content.phrases[+idx]) return phraseCategory(Content.phrases[+idx]);
  const results = h('div');
  const input = h('input.search', { type: 'search', placeholder: 'Buscar frase (português, romaji ou japonês)…', value: phraseState.query, enterkeyhint: 'search' });
  const list = h('div.menu', Content.phrases.map((c, i) => h('button.menu-item', { type: 'button', onclick: () => App.go('phrases/' + i) },
    h('span.menu-icon', { lang: 'ja' }, c.icon),
    h('span.menu-text', h('strong', c.name), h('small', `${c.phrases.length} frases`)),
    h('span.chev', '›'))));
  const update = () => {
    phraseState.query = input.value;
    const q = input.value.trim();
    list.hidden = q.length >= 2;
    if (q.length < 2) { results.replaceChildren(); return; }
    const fq = Kana.fold(q);
    const kq = Kana.toHiragana(Kana.romajiToHiragana(q.toLowerCase())).replaceAll(' ', '');
    const lower = q.toLowerCase().replaceAll(' ', '');
    const hits = Content.phrases.flatMap((c) => c.phrases.filter((p) => p.length >= 3).map((p) => [c, p]))
      .filter(([, p]) => Kana.fold(p[2]).includes(fq) || p[0].includes(q) || Kana.toHiragana(p[1]).replaceAll(' ', '').includes(kq) ||
        Kana.toRomaji(p[1]).replaceAll(' ', '').includes(lower))
      .slice(0, 60);
    results.replaceChildren(h('h3.section', `${hits.length} resultado(s) para "${q}"`),
      h('div.cards', hits.map(([c, p]) => sentenceCard(p[0], p[1], `${p[2]}   ·   [${c.name}]`))));
  };
  input.addEventListener('input', update);
  setTimeout(update, 0);
  return page(
    ...title('Frases úteis para o Japão'),
    Content.phrases.length === 0 ? infoBox('Nenhuma frase encontrada.', 'error') : null,
    input,
    results,
    list,
  );
}

function phraseCategory(cat) {
  const items = cat.items;
  const addBtn = h('button.btn', { type: 'button' }, '＋ Adicionar à revisão');
  addBtn.onclick = () => {
    items.forEach((v) => Store.addToSrs(v, 'frase'));
    Store.save();
    addBtn.textContent = '✓ Adicionadas à revisão';
    addBtn.disabled = true;
  };
  return page(
    h('div.sub-head', h('button.icon-btn.ghost', { type: 'button', 'aria-label': 'Voltar', onclick: () => App.go('phrases') }, icons.back),
      h('h1.page-title', { lang: 'ja' }, `${cat.icon}  ${cat.name}`)),
    h('div.stack',
      h('button.btn.primary', { type: 'button', onclick: () => startPhraseQuiz(cat) }, '▶ Quiz desta situação'),
      row(addBtn,
        Speech.available ? button('🔊 Ouvir todas', () => Speech.speakQueue(items.map((i) => i.jp))) : null,
        button('🎙 Treinar fala', () => App.openSpeaking('Frases úteis: ' + cat.name, items)))),
    h('div.cards', cat.phrases.filter((p) => p.length >= 3).map((p) =>
      sentenceCard(p[0], p[1], p.length >= 4 && p[3] && p[3].trim() ? `${p[2]}\n💡 ${p[3]}` : p[2]))),
  );
}

function startPhraseQuiz(cat) {
  const items = cat.items;
  App.runExercises({
    title: 'Frases: ' + cat.name,
    generator: () => Ex.phraseDrill(items, Math.min(15, items.length)),
    onComplete: (r) => { Store.addXp(r.correct * 2); return `+${r.correct * 2} XP`; },
  });
}
