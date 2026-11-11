// Menu Praticar.
import { Content } from '../content.js';
import { Store } from '../store.js';
import { h } from '../ui.js';
import { page, title } from './common.js';
import { startWeakSpots } from './home.js';
import { App } from '../app.js';

export function PracticeView() {
  const item = (icon, name, desc, route) => h('button.menu-item', { type: 'button', onclick: () => App.go(route) },
    h('span.menu-icon', { lang: 'ja' }, icon), h('span.menu-text', h('strong', name), h('small', desc)), h('span.chev', '›'));
  const weak = Object.keys(Store.data.Mistakes).length;
  return page(
    ...title('Praticar'),
    h('div.menu',
      item('あ', 'Hiragana & Katakana', 'Tabelas, quiz e escrita por traçado', 'kana'),
      item('漢', 'Kanji', `${Content.kanji.length} kanji: N5, N4, N3 e placas`, 'kanji'),
      item('語', 'Vocabulário', `${Content.decks.reduce((n, d) => n + d.items.length, 0)} palavras em ${Content.decks.length} decks`, 'vocab'),
      item('話', 'Frases úteis', `${Content.phrases.reduce((n, c) => n + c.phrases.length, 0)} frases para situações reais`, 'phrases'),
      item('声', 'Treino de fala', 'Ouvir, gravar, comparar e verificar a pronúncia', 'speak'),
      item('辞', 'Dicionário', 'Busca em português, romaji ou japonês', 'dict')),
    weak > 0 ? h('button.btn.wide', { type: 'button', onclick: startWeakSpots }, `🎯 Treinar pontos fracos (${weak})`) : null,
  );
}
