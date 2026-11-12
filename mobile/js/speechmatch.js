// Compara o que o reconhecimento de fala ouviu com o que era esperado.
// O reconhecedor costuma devolver kanji ("青" quando a pessoa disse あお), então além de comparar
// o texto direto, o que foi ouvido é convertido para leitura em kana com o vocabulário do curso.
import * as Kana from './kana.js';
import { Content } from './content.js';
import { segment } from './glossary.js';

/** Semelhança 0..1 entre o que foi ouvido e o esperado (ignora espaços, pontuação, kana × katakana). */
export function similarity(heard, expected) {
  const norm = (s) => Kana.normalizeAnswer(s).replace(/\p{P}/gu, '');
  const a = norm(heard);
  const b = norm(expected);
  if (!a.length || !b.length) return 0;
  return Math.max(0, 1 - levenshtein(a, b) / Math.max(a.length, b.length));
}

function levenshtein(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  let cur = new Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
}

let kanjiMap = null;
/** Leituras possíveis de um kanji sozinho, em hiragana ("一" → いち, いつ, ひと). */
function kanjiReadings(ch) {
  if (!kanjiMap) {
    kanjiMap = new Map();
    for (const k of Content.kanji) {
      const list = [k.on, k.kun].join('・').split(/[・、,/\s]+/)
        .map((r) => Kana.toHiragana(r.replace(/[(（].*$/, '').replace(/[.\-－〜～]/g, '')))
        .filter((r) => r && Kana.isAllKana(r));
      kanjiMap.set(k.char, [...new Set(list)]);
    }
  }
  return kanjiMap.get(ch) || [];
}

/** Leitura de uma forma conjugada a partir da palavra base: 食べました + (食べる, たべる) → たべました. */
function inflectedReading(surface, entry) {
  let p = 0;
  while (p < surface.length && p < entry.jp.length && surface[p] === entry.jp[p]) p++;
  const tail = entry.jp.slice(p);
  if (!Kana.isAllKana(tail) && tail) return null;
  if (tail.length > entry.reading.length) return null;
  return entry.reading.slice(0, entry.reading.length - tail.length) + surface.slice(p);
}

const MAX_COMBOS = 24;

// Expressões que o reconhecedor às vezes escreve com kanji que o curso escreve em kana.
const ALIASES = [
  ['今日は', 'こんにちは'], ['今晩は', 'こんばんは'], ['有難う', 'ありがとう'], ['有り難う', 'ありがとう'],
  ['御願い', 'おねがい'], ['お願い', 'おねがい'], ['宜しく', 'よろしく'], ['お休みなさい', 'おやすみなさい'],
  ['済みません', 'すみません'], ['御免なさい', 'ごめんなさい'], ['頂きます', 'いただきます'],
  ['ご馳走様', 'ごちそうさま'], ['御馳走様', 'ごちそうさま'], ['行って来ます', 'いってきます'], ['行ってきます', 'いってきます'],
  ['お帰りなさい', 'おかえりなさい'], ['失礼します', 'しつれいします'], ['お疲れ様', 'おつかれさま'],
  ['只今', 'ただいま'], ['お早う', 'おはよう'], ['左様なら', 'さようなら'], ['又ね', 'またね'], ['何卒', 'なにとぞ'],
];

/** Leituras em kana possíveis para o texto ouvido (o próprio texto se já estiver em kana). */
export function heardReadings(heard) {
  let text = (heard || '').replace(/[\s　]/g, '');
  if (!text) return [];
  for (const [k, v] of ALIASES) text = text.replaceAll(k, v);
  if (!Kana.containsKanji(text)) return [text];
  let combos = [''];
  for (const s of segment(text)) {
    const t = text.slice(s.start, s.end);
    let cands = [];
    if (!Kana.containsKanji(t)) cands = [t];
    else {
      for (const e of s.entries || []) {
        if (e.kind === 'kanji') cands.push(...kanjiReadings(e.jp));
        else if (e.base) { const r = inflectedReading(t, e); if (r) cands.push(r); }
        else if (Kana.isAllKana(e.reading)) cands.push(e.reading);
      }
      if (!cands.length) {
        // kanji solto que o curso não conhece como palavra: monta letra a letra
        let parts = [''];
        for (const ch of t) {
          const opts = Kana.containsKanji(ch) ? kanjiReadings(ch) : [ch];
          if (!opts.length) { parts = []; break; }
          parts = parts.flatMap((p) => opts.slice(0, 4).map((o) => p + o)).slice(0, MAX_COMBOS);
        }
        cands = parts;
      }
    }
    cands = [...new Set(cands)];
    if (!cands.length) return combos.length === 1 && combos[0] === '' ? [] : combos.map((c) => c + t);
    combos = combos.flatMap((c) => cands.map((x) => c + x)).slice(0, MAX_COMBOS);
  }
  return combos;
}

/** Nota 0..1 da fala: compara com a escrita e com a leitura, convertendo os kanji ouvidos. */
export function speechScore(heard, expected, reading) {
  if (!heard) return 0;
  let best = similarity(heard, expected);
  if (reading) {
    best = Math.max(best, similarity(heard, reading));
    if (best < 1) for (const r of heardReadings(heard)) best = Math.max(best, similarity(r, reading));
  }
  if (best < 1 && Kana.isAllKana((expected || '').replace(/[\s　。、？！?!]/g, ''))) {
    for (const r of heardReadings(heard)) best = Math.max(best, similarity(r, expected));
  }
  return best;
}

/** Nota mínima para aceitar: palavras curtíssimas precisam sair certas; frases longas toleram mais. */
export function passScore(reading) {
  const n = Kana.normalizeAnswer(reading || '').replace(/\p{P}/gu, '').length;
  return n <= 2 ? 1 : n <= 5 ? 0.75 : 0.7;
}
