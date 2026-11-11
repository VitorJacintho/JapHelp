// Minhas palavras: o aluno cadastra palavras da aula ou da rua e elas entram na revisão (SRS).
import * as Kana from '../kana.js';
import { VocabItem } from '../content.js';
import { Store } from '../store.js';
import { Speech } from '../speech.js';
import { h, icons, infoBox, section, toast, jpText } from '../ui.js';
import { page } from './common.js';
import { App } from '../app.js';

export const MY_WORD = 'minha palavra'; // marca no campo Extra do item da revisão (o PC mostra como observação)

export const myWords = () => Object.values(Store.data.Srs).filter((s) => s.Extra === MY_WORD);

/** Valida e adiciona. Devolve '' se deu certo ou a mensagem de erro. */
export function addMyWord(jp, reading, meaning) {
  jp = (jp || '').trim();
  reading = (reading || '').trim();
  meaning = (meaning || '').trim();
  if (!jp || !meaning) return 'Preencha a palavra em japonês e o significado.';
  // aceita romaji: "taberu" vira たべる
  if (!Kana.containsJapanese(jp)) jp = Kana.romajiToHiragana(jp.toLowerCase());
  if (reading && !Kana.containsJapanese(reading)) reading = Kana.romajiToHiragana(reading.toLowerCase());
  if (!Kana.containsJapanese(jp)) return 'Não entendi a palavra. Escreva em japonês ou em romaji.';
  if (Kana.containsKanji(jp) && !reading) return 'Esta palavra tem kanji: escreva também a leitura (em kana ou romaji).';
  if (reading && Kana.containsKanji(reading)) return 'A leitura deve ser só em kana (ou romaji).';
  const v = new VocabItem(jp, reading, meaning, 'minhas');
  if (Store.data.Srs[v.key]) return 'Essa palavra já está na sua revisão.';
  Store.addToSrs(v);
  Store.data.Srs[v.key].Extra = MY_WORD;
  Store.save();
  return '';
}

export function MyWordsView() {
  const words = myWords().sort((a, b) => a.Front.localeCompare(b.Front, 'ja'));
  const jp = h('input.search', { type: 'text', lang: 'ja', placeholder: 'Japonês (ex.: 自転車 ou jitensha)', autocomplete: 'off', autocapitalize: 'off' });
  const reading = h('input.search', { type: 'text', lang: 'ja', placeholder: 'Leitura em kana ou romaji (se tiver kanji)', autocomplete: 'off', autocapitalize: 'off' });
  const meaning = h('input.search', { type: 'text', placeholder: 'Significado em português', autocomplete: 'off' });
  const error = h('div.info.info-error', { hidden: true });
  const submit = (e) => {
    e?.preventDefault();
    const msg = addMyWord(jp.value, reading.value, meaning.value);
    if (msg) { error.hidden = false; error.textContent = msg; return; }
    toast('Palavra adicionada à revisão.');
    App.render();
  };
  return page(
    h('div.sub-head', h('button.icon-btn.ghost', { type: 'button', 'aria-label': 'Voltar', onclick: () => App.go('practice') }, icons.back),
      h('h1.page-title', 'Minhas palavras')),
    h('p.page-sub', 'Anote palavras da aula, da rua ou do trabalho. Elas entram na revisão espaçada junto com as do curso.'),
    h('form.card.stack.myword-form', { onsubmit: submit },
      jp, reading, meaning, error,
      h('button.btn.primary', { type: 'submit' }, '＋ Adicionar à revisão')),
    section(`Cadastradas (${words.length})`),
    words.length === 0 ? infoBox('Nenhuma palavra ainda. Dica: nos textos e exemplos, tocar numa palavra também tem o botão "＋ Revisão".', 'neutral') : null,
    h('div.dict-list', words.map((w) => h('div.dict-row.myword-row',
      h('button.myword-main', { type: 'button', onclick: () => Speech.speak(w.Front) },
        jpText('div.dict-jp', w.Front, w.Reading !== w.Front ? w.Reading : null),
        h('div.dict-meaning', w.Back)),
      h('button.icon-btn.ghost.small', {
        type: 'button',
        'aria-label': `Apagar ${w.Front}`,
        onclick: () => {
          if (!confirm(`Apagar "${w.Front}" das suas palavras e da revisão?`)) return;
          delete Store.data.Srs[w.Key];
          Store.save();
          App.render();
        },
      }, '🗑')))),
  );
}
