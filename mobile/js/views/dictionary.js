// Dicionário do curso.
import * as Kana from '../kana.js';
import { Content, vocabItems } from '../content.js';
import { Speech } from '../speech.js';
import { h, jpText } from '../ui.js';
import { page, title } from './common.js';

let dictEntries = null;
const dictState = { query: '' };

function buildDict() {
  const all = [];
  for (const l of Content.allLessons) for (const v of vocabItems(l)) all.push([v, l.title]);
  for (const d of Content.decks) for (const v of d.items) all.push([v, `Deck ${d.level}: ${d.name}`]);
  for (const c of Content.phrases) for (const v of c.items) all.push([v, 'Frases: ' + c.name]);
  for (const k of Content.kanji) for (const w of k.words) all.push([w, `Kanji ${k.char} (${k.level})`]);
  const seen = new Set();
  return all.filter(([v]) => { const key = v.jp + '|' + v.meaning; if (seen.has(key)) return false; seen.add(key); return true; })
    .map(([v, src]) => ({ v, src, fm: Kana.fold(v.meaning), hr: Kana.toHiragana(v.reading).replaceAll(' ', ''), rom: v.romaji.replaceAll(' ', '').replaceAll("'", '') }));
}

export function DictionaryView() {
  dictEntries ??= buildDict();
  const input = h('input.search', { type: 'search', placeholder: 'Português, romaji (ex.: taberu) ou japonês…', value: dictState.query, enterkeyhint: 'search' });
  const count = h('p.muted.small');
  const list = h('div.dict-list');
  let timer = null;
  const fill = () => {
    dictState.query = input.value;
    const q = input.value.trim();
    let res = dictEntries;
    if (q) {
      const fq = Kana.fold(q);
      const lower = q.toLowerCase().replaceAll(' ', '');
      const kq = Kana.containsJapanese(q) ? Kana.toHiragana(q) : Kana.romajiToHiragana(lower);
      res = dictEntries.filter((e) => e.fm.includes(fq) || e.v.jp.includes(q) || e.hr.includes(kq) || e.rom.includes(lower))
        .map((e) => [e, e.fm.startsWith(fq) || e.rom.startsWith(lower) ? 0 : 1])
        .sort((a, b) => a[1] - b[1] || a[0].v.jp.length - b[0].v.jp.length)
        .map((x) => x[0]);
    }
    const shown = res.slice(0, 150);
    count.textContent = `${res.length} de ${dictEntries.length} entradas${res.length > shown.length ? ` (mostrando ${shown.length})` : ''} · toque para ouvir`;
    list.replaceChildren(...shown.map((e) => h('button.dict-row', { type: 'button', onclick: () => Speech.speak(e.v.jp) },
      dictJp(e.v),
      h('div.dict-romaji', e.v.romaji),
      h('div.dict-meaning', e.v.meaning),
      h('div.dict-src', e.src))));
  };
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(fill, 180); });
  fill();
  return page(...title('Dicionário do curso'), input, count, list);
}

/** Palavra com furigana; se a leitura não encaixar nos kanji, mostra a leitura ao lado. */
function dictJp(v) {
  const el = jpText('div.dict-jp', v.jp, v.hasKanji ? v.reading : null);
  if (v.hasKanji && !el.furigana) el.append(h('span.dict-reading', v.reading));
  return el;
}
