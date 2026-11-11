// Tocar numa palavra mostra o significado: divide a frase em palavras usando o vocabulário do curso.
import * as Kana from './kana.js';
import { Content } from './content.js';
import { alignFurigana } from './furigana.js';

export const PARTICLES = {
  'は': 'partícula de tópico — "quanto a…" (lê-se "wa")',
  'が': 'partícula de sujeito; também "mas"',
  'を': 'objeto direto (lê-se "o")',
  'に': 'destino, horário, onde algo está, a quem',
  'で': 'lugar onde a ação acontece; meio ("de ônibus")',
  'へ': 'direção — "para" (lê-se "e")',
  'と': '"e" entre nomes; "com" alguém',
  'も': '"também"; "nem" (em frases negativas)',
  'の': 'posse e ligação — "de"',
  'から': '"de / desde"; depois de frase: "porque"',
  'まで': '"até"',
  'か': 'transforma a frase em pergunta',
  'ね': '"né?" — busca concordância',
  'よ': 'ênfase; avisa algo novo para o ouvinte',
  'や': '"e" numa lista incompleta ("…entre outros")',
  'より': '"do que" (comparação)',
  'けど': '"mas", "porém"',
  'って': 'citação informal ("disse que…")',
};

// Palavrinhas de gramática que aparecem coladas nas frases (tocáveis, como as partículas).
export const GRAMMAR = {
  'です': 'verbo "ser/estar" educado — "é", "são"',
  'でした': '"era", "foi" (passado de です)',
  'ですか': '"é…?" — pergunta educada',
  'じゃありません': '"não é" (negativo de です)',
  'ではありません': '"não é" (negativo formal de です)',
  'じゃない': '"não é" (informal)',
  'だ': '"é" (informal de です)',
  'ます': 'final educado do verbo',
  'ません': 'final educado negativo — "não…"',
  'ました': 'final educado no passado',
  'ませんでした': 'final educado no passado negativo — "não…"',
  'ましょう': '"vamos…!"',
  'ませんか': 'convite — "que tal…?", "não quer…?"',
  'たい': '"quero…"',
  'ている': 'ação em andamento ou estado (forma ている)',
  'ています': 'ação em andamento ou estado — educado',
  'てください': 'pedido educado — "por favor, …"',
  'て': 'forma て: liga ações ("e então") ou faz pedidos',
  'た': 'passado informal',
  'ない': 'negativo informal',
  'この': '"este/esta" (perto de quem fala) + nome',
  'その': '"esse/essa" (perto de quem ouve) + nome',
  'あの': '"aquele/aquela" (longe dos dois) + nome',
  'どの': '"qual…?" + nome',
  'こと': '"coisa", "fato"; 〜たことがある = "já fiz…"',
  'もの': '"coisa" (objeto)',
  'とき': '"quando…", "na hora em que…"',
  'ので': '"porque", "como…" (motivo, educado)',
  'のに': '"apesar de…", "mesmo que…"',
  'でも': '"mas", "porém"; "até mesmo"',
  'だから': '"por isso"',
  'それから': '"e depois", "em seguida"',
  'そして': '"e", "e então"',
  'ながら': '"enquanto…" (duas ações ao mesmo tempo)',
  'たら': '"se…", "quando…" (condição)',
  'ば': '"se…" (condição)',
};

const MAX_LEN = 12;
let index = null; // texto → [{ jp, reading, meaning, kind, base, form }]

function add(map, surface, entry) {
  if (!surface) return;
  const list = map.get(surface) || [];
  if (!list.some((e) => e.jp === entry.jp && e.meaning === entry.meaning)) list.push(entry);
  map.set(surface, list);
}

// verbos do grupo 1 (godan): última letra → [ます, て, た, ない]
const GODAN = {
  'う': ['います', 'って', 'った', 'わない'], 'く': ['きます', 'いて', 'いた', 'かない'], 'ぐ': ['ぎます', 'いで', 'いだ', 'がない'],
  'す': ['します', 'して', 'した', 'さない'], 'つ': ['ちます', 'って', 'った', 'たない'], 'ぬ': ['にます', 'んで', 'んだ', 'なない'],
  'ぶ': ['びます', 'んで', 'んだ', 'ばない'], 'む': ['みます', 'んで', 'んだ', 'まない'], 'る': ['ります', 'って', 'った', 'らない'],
};
const MASU_ENDINGS = ['ます', 'ません', 'ました', 'ませんでした', 'ましょう', 'たい', 'たくない'];

/** Formas conjugadas mais comuns de uma palavra (só para palavras com kanji, para não virar ruído). */
export function conjugations(jp) {
  const out = new Set();
  if (!Kana.containsKanji(jp)) return out;
  const masuStem = (st) => { for (const e of MASU_ENDINGS) out.add(st + e); };
  if (jp.endsWith('ます')) {
    const st = jp.slice(0, -2);
    masuStem(st);
    out.add(st); // 食べ(て), 書き(ました)...
    if (/[えけげせぜてでねへべぺめれ]$/.test(st) || jp.endsWith('します') || jp.endsWith('来ます')) {
      // grupo 2 (e grupo 3): て/た/ない saem direto do radical
      for (const e of ['て', 'た', 'ない', 'ています', 'てください']) out.add(st + e);
    }
    return out;
  }
  const last = jp.slice(-1);
  const st = jp.slice(0, -1);
  if (jp.endsWith('する') || jp.endsWith('来る')) {
    const base = jp.endsWith('する') ? jp.slice(0, -2) + 'し' : jp.slice(0, -1);
    masuStem(base);
    for (const e of ['て', 'た', 'ています', 'てください']) out.add(base + e);
    out.add(jp.endsWith('する') ? jp.slice(0, -2) + 'しない' : jp.slice(0, -1) + 'ない');
    return out;
  }
  if (last === 'い' && st.length) {
    // adjetivo -い: 高い → 高くない, 高かった, 高くて
    for (const e of ['くない', 'かった', 'くなかった', 'くて', 'く']) out.add(st + e);
    return out;
  }
  if (last === 'る') {
    // pode ser grupo 2 (食べる) ou grupo 1 (帰る): guarda as duas formas
    masuStem(st);
    for (const e of ['て', 'た', 'ない', 'ています', 'てください']) out.add(st + e);
  }
  const g = GODAN[last];
  if (g) {
    const special = jp.endsWith('行く') ? ['きます', 'って', 'った', 'かない'] : g;
    masuStem(st + special[0].slice(0, -2));
    out.add(st + special[1]); out.add(st + special[2]); out.add(st + special[3]);
    out.add(st + special[1] + 'ください'); out.add(st + special[1] + 'います');
  }
  return out;
}

/** Índice de palavras do curso (lições, decks, palavras de kanji e os próprios kanji). */
export function buildIndex() {
  const map = new Map();
  const words = [
    ...Content.allVocab,
    ...Content.decks.flatMap((d) => d.items),
    ...Content.kanji.flatMap((k) => k.words),
  ];
  for (const v of words) {
    const jp = v.jp.replace(/[\s　]/g, '');
    if (!jp || jp.length > MAX_LEN || /[。、？！?!]/.test(jp)) continue;
    // kana de 1 letra ("え", "は") viraria ruído no meio de outras palavras
    if (!Kana.containsKanji(jp) && [...jp].length < 2) continue;
    const entry = { jp, reading: v.reading.replace(/[\s　]/g, ''), meaning: v.meaning, kind: 'palavra' };
    add(map, jp, entry);
    for (const form of conjugations(jp)) if (form !== jp) add(map, form, { ...entry, base: true });
  }
  for (const k of Content.kanji) {
    add(map, k.char, { jp: k.char, reading: [k.on, k.kun].filter((s) => s && s.trim()).join(' / '), meaning: k.meaning, kind: 'kanji' });
  }
  index = map;
  return map;
}

const isPunct = (c) => /[、。！？!?「」『』（）()・…\s　,.]/.test(c);

/**
 * Divide a frase em trechos [{ start, end, entries, particle, grammar }] cobrindo o texto inteiro.
 * Escolhe a divisão de menor "custo": palavras do curso custam pouco, partículas um pouco mais,
 * letras soltas sem significado custam caro — assim "これはいくら" vira これ・は・いくら, não これ・はい・くら.
 */
export function segment(jp) {
  const map = index || buildIndex();
  const n = jp.length;
  const best = Array(n + 1).fill(Infinity);
  const from = Array(n + 1).fill(null);
  best[0] = 0;
  for (let i = 0; i < n; i++) {
    if (best[i] === Infinity) continue;
    const step = (end, cost, seg) => {
      if (best[i] + cost < best[end]) { best[end] = best[i] + cost; from[end] = { ...seg, start: i, end }; }
    };
    for (let len = 1; len <= Math.min(MAX_LEN, n - i); len++) {
      const text = jp.slice(i, i + len);
      const e = map.get(text);
      if (e) step(i + len, 1, { entries: e, particle: null, grammar: null });
      if (PARTICLES[text]) step(i + len, 1.2, { entries: null, particle: text, grammar: null });
      if (GRAMMAR[text]) step(i + len, 1.1, { entries: null, particle: null, grammar: text });
    }
    step(i + 1, isPunct(jp[i]) ? 0.5 : 3, { entries: null, particle: null, grammar: null, loose: true });
  }
  const segs = [];
  for (let end = n; end > 0; end = from[end].start) segs.unshift(from[end]);
  // letras soltas vizinhas viram um trecho só
  const out = [];
  for (const s of segs) {
    const prev = out[out.length - 1];
    if (s.loose && prev?.loose && !isPunct(jp[s.start]) && !isPunct(jp[prev.start])) prev.end = s.end;
    else out.push({ ...s });
  }
  return out;
}


/**
 * Junta furigana e palavras: cada palavra vira { text, parts: [{ text, reading }], entries, particle }.
 * Quando a leitura de um trecho de kanji cobre duas palavras (ex.: 昨日何), elas viram uma só.
 */
export function wordsWithFurigana(jp, reading) {
  let pos = 0;
  const parts = ((reading && Kana.containsKanji(jp) && alignFurigana(jp, reading)) || [{ text: jp, reading: null }])
    .map((p) => ({ ...p, s: pos, e: (pos += p.text.length) }));
  let segs = segment(jp).map((s) => ({ ...s }));
  // um trecho com furigana não pode ser cortado: junta as palavras que o dividem
  for (const p of parts.filter((x) => x.reading)) {
    const over = segs.filter((s) => s.start < p.e && s.end > p.s);
    if (over.length <= 1 && (!over[0] || (over[0].start <= p.s && over[0].end >= p.e))) continue;
    const merged = {
      start: Math.min(p.s, ...over.map((s) => s.start)),
      end: Math.max(p.e, ...over.map((s) => s.end)),
      entries: over.flatMap((s) => s.entries || []),
      particle: null,
      grammar: null,
    };
    if (!merged.entries.length) merged.entries = null;
    segs = [...segs.filter((s) => !over.includes(s)), merged].sort((a, b) => a.start - b.start);
  }
  return segs.map((s) => ({
    text: jp.slice(s.start, s.end),
    entries: s.entries,
    particle: s.particle,
    grammar: s.grammar || null,
    parts: parts.filter((p) => p.s < s.end && p.e > s.start)
      .map((p) => (p.reading ? { text: p.text, reading: p.reading } : { text: jp.slice(Math.max(p.s, s.start), Math.min(p.e, s.end)), reading: null })),
  }));
}
