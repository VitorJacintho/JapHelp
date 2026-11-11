// Treinos gerados automaticamente (sem conteúdo escrito à mão):
// conjugação, números/preços/horas/datas, partículas e ditado.
import * as Kana from './kana.js';
import { Content } from './content.js';
import { Speech } from './speech.js';
import { makeExercise, shuffle, distinctBy } from './exercises.js';
import { segment, PARTICLES } from './glossary.js';

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
function withOptions(ex, correct, wrong) {
  const opts = shuffle([correct, ...[...new Set(wrong)].filter((w) => w && w !== correct).slice(0, 3)]);
  ex.options = opts;
  ex.answer = opts.indexOf(correct);
  return ex;
}

// =====================================================================
// CONJUGAÇÃO
// =====================================================================
// verbos do grupo 1 (godan): final do dicionário → [radical do ます, て, た, radical do ない]
const GODAN = {
  'う': ['い', 'って', 'った', 'わ'], 'く': ['き', 'いて', 'いた', 'か'], 'ぐ': ['ぎ', 'いで', 'いだ', 'が'],
  'す': ['し', 'して', 'した', 'さ'], 'つ': ['ち', 'って', 'った', 'た'], 'ぬ': ['に', 'んで', 'んだ', 'な'],
  'ぶ': ['び', 'んで', 'んだ', 'ば'], 'む': ['み', 'んで', 'んだ', 'ま'], 'る': ['り', 'って', 'った', 'ら'],
};
const I_TO_U = Object.fromEntries(Object.entries(GODAN).map(([u, f]) => [f[0], u]));
const E_ROW = 'えけげせぜてでねへべぺめれ';
const I_ROW = 'いきぎしじちぢにひびぴみり';
// grupo 2 com radical terminado em "i" (parecem do grupo 1): 見ます, 起きます, 借ります...
const ICHIDAN_I = ['見', '起き', '借り', 'でき', '出来', '浴び', '降り', '足り', 'い', '居', '着', '落ち', '信じ', '感じ', '生き', '過ぎ', '閉じ', '伸び', '似', '飽き', '煮', '診', '案じ'];
const isIchidanI = (stem) => ICHIDAN_I.some((x) => stem === x || (Kana.containsKanji(x) && stem.endsWith(x)));
// grupo 1 terminado em -iru/-eru (parecem do grupo 2): 帰る, 入る, 走る...
const GODAN_RU = ['練る', '帰る', '入る', '走る', '知る', '切る', '要る', '減る', '喋る', '滑る', '限る', '握る', '蹴る', '参る', '焦る', '混じる', '散る', '照る', '湿る', '茂る'];
const NA_ADJ_I = ['嫌い', '大嫌い', '幸い', '綺麗'];

// adjetivos: só palavras dos decks e lições de adjetivos (substantivos como 匂い também terminam em い)
let adjLessons = null;
function isAdjective(v) {
  if (v.adjective) return true;
  adjLessons ??= new Set(Content.allLessons.filter((l) => /adjetiv/i.test(l.title)).map((l) => l.id));
  const src = v.source || '';
  return (src.startsWith('deck:') && /adjetiv/i.test(src)) || adjLessons.has(src);
}

const isInfinitive = (meaning) => /^(?:\([^)]*\)\s*)?[a-zà-ú-]+(?:ar|er|ir|or|ôr)(?:-se|-lo|-la)?\b/i.test(meaning.trim());

/**
 * Formas de um verbo ou adjetivo do vocabulário (ou null se não der para conjugar com segurança).
 * Devolve { kind, group, meaning, forms: { nome: [japonês, leitura] } }.
 */
export function inflect(v) {
  const jp = v.jp.replace(/[\s　]/g, '');
  const rd = v.reading.replace(/[\s　]/g, '');
  if (!Kana.containsKanji(jp) || /[。、？！〜～・]/.test(jp) || [...jp].length > 8) return null; // expressões longas (お世話になっております) ficam de fora
  // aplica a mesma troca de final no japonês e na leitura (o final é sempre kana)
  const both = (cut, add) => [jp.slice(0, jp.length - cut) + add, rd.slice(0, rd.length - cut) + add];

  // ---------- adjetivos -い ----------
  if (jp.endsWith('い') && rd.endsWith('い') && !NA_ADJ_I.includes(jp) && isAdjective(v)) {
    if (rd === 'いい') return null;
    return {
      kind: 'adj', group: 'adjetivo い', meaning: v.meaning,
      forms: { 'dicionário': [jp, rd], negativa: both(1, 'くない'), passado: both(1, 'かった'), 'て': both(1, 'くて') },
    };
  }

  // ---------- verbos a partir da forma ます ----------
  if (jp.endsWith('ます') && rd.endsWith('ます') && jp.length > 2) {
    const stem = jp.slice(0, -2);
    const last = rd[rd.length - 3];
    if (jp === 'あります') return null;
    if (jp.endsWith('します')) {
      return { kind: 'verb', group: 'grupo 3 (する)', meaning: v.meaning, forms: { 'ます': [jp, rd], 'dicionário': both(3, 'する'), 'て': both(3, 'して'), 'た': both(3, 'した'), 'ない': both(3, 'しない') } };
    }
    if (jp.endsWith('来ます')) {
      const r = rd.slice(0, -3);
      const j = jp.slice(0, -2);
      return { kind: 'verb', group: 'grupo 3 (来る)', meaning: v.meaning, forms: { 'ます': [jp, rd], 'dicionário': [j + 'る', r + 'くる'], 'て': [j + 'て', r + 'きて'], 'た': [j + 'た', r + 'きた'], 'ない': [j + 'ない', r + 'こない'] } };
    }
    if (E_ROW.includes(last) || isIchidanI(stem)) {
      return { kind: 'verb', group: 'grupo 2', meaning: v.meaning, forms: { 'ます': [jp, rd], 'dicionário': both(2, 'る'), 'て': both(2, 'て'), 'た': both(2, 'た'), 'ない': both(2, 'ない') } };
    }
    const u = I_TO_U[last];
    if (!u || !Kana.isKana(jp[jp.length - 3])) return null;
    const g = stem.endsWith('行き') ? ['き', 'って', 'った', 'か'] : GODAN[u];
    return { kind: 'verb', group: 'grupo 1', meaning: v.meaning, forms: { 'ます': [jp, rd], 'dicionário': both(3, u), 'て': both(3, g[1]), 'た': both(3, g[2]), 'ない': both(3, g[3] + 'ない') } };
  }

  // ---------- verbos a partir da forma de dicionário ----------
  const end = jp[jp.length - 1];
  if (!GODAN[end] || rd[rd.length - 1] !== end || !isInfinitive(v.meaning)) return null;
  if (jp === 'ある' || jp === '有る') return null;
  if (jp.endsWith('する')) {
    return { kind: 'verb', group: 'grupo 3 (する)', meaning: v.meaning, forms: { 'dicionário': [jp, rd], 'ます': both(2, 'します'), 'て': both(2, 'して'), 'た': both(2, 'した'), 'ない': both(2, 'しない') } };
  }
  if (jp.endsWith('来る')) {
    const r = rd.slice(0, -2);
    const j = jp.slice(0, -1);
    return { kind: 'verb', group: 'grupo 3 (来る)', meaning: v.meaning, forms: { 'dicionário': [jp, rd], 'ます': [j + 'ます', r + 'きます'], 'て': [j + 'て', r + 'きて'], 'た': [j + 'た', r + 'きた'], 'ない': [j + 'ない', r + 'こない'] } };
  }
  const before = rd[rd.length - 2] || '';
  if (end === 'る' && (E_ROW + I_ROW).includes(before) && !GODAN_RU.includes(jp)) {
    return { kind: 'verb', group: 'grupo 2', meaning: v.meaning, forms: { 'dicionário': [jp, rd], 'ます': both(1, 'ます'), 'て': both(1, 'て'), 'た': both(1, 'た'), 'ない': both(1, 'ない') } };
  }
  const g = jp.endsWith('行く') ? ['き', 'って', 'った', 'か'] : GODAN[end];
  return { kind: 'verb', group: 'grupo 1', meaning: v.meaning, forms: { 'dicionário': [jp, rd], 'ます': both(1, g[0] + 'ます'), 'て': both(1, g[1]), 'た': both(1, g[2]), 'ない': both(1, g[3] + 'ない') } };
}

const FORM_HELP = {
  'ます': 'forma ます (educada)', 'dicionário': 'forma de dicionário', 'て': 'forma て', 'た': 'forma た (passado informal)',
  'ない': 'forma ない (negativo informal)', negativa: 'negativa (〜くない)', passado: 'passado (〜かった)',
};

const WRONG_ENDINGS = {
  'て': ['て', 'って', 'んで', 'いて', 'して', 'いで'], 'た': ['た', 'った', 'んだ', 'いた', 'した', 'いだ'],
  'ない': ['ない', 'らない', 'わない', 'かない', 'さない', 'まない'], 'ます': ['ます', 'ります', 'います', 'きます', 'みます', 'します'],
  'dicionário': ['る', 'う', 'く', 'す', 'む', 'つ'],
  'adj:negativa': ['くない', 'じゃない', 'ない', 'いくない'], 'adj:passado': ['かった', 'いかった', 'でした', 'だった'], 'adj:て': ['くて', 'いて', 'で', 'って'],
};

/** Palavras do curso que dá para conjugar. */
export function inflectable() {
  const seen = new Set();
  const out = [];
  for (const v of [...Content.allVocab, ...Content.decks.flatMap((d) => d.items)]) {
    if (seen.has(v.jp)) continue;
    seen.add(v.jp);
    const info = inflect(v);
    if (info) out.push({ v, info });
  }
  return out;
}

export function conjugationDrill(count = 12, list = inflectable()) {
  return shuffle(list).slice(0, count).map(({ info }, i) => {
    const names = Object.keys(info.forms);
    const from = names[0];
    const to = pick(names.slice(1));
    const [srcJp, srcRd] = info.forms[from];
    const [ansJp, ansRd] = info.forms[to];
    const prompt = `${info.kind === 'adj' ? 'Adjetivo' : 'Verbo'}: passe para a ${FORM_HELP[to]}`;
    const explanation = `${srcJp} → ${ansJp}（${ansRd}）· ${info.meaning} · ${info.group}`;
    const base = { japanese: srcJp, japaneseReading: srcRd, context: info.meaning, speakText: ansJp, audioRevealsAnswer: true, explanation };
    if (i % 2 === 0) return makeExercise({ ...base, type: 'typing', prompt: prompt + ' (digite em romaji)', accepted: [ansRd, ansJp], hint: info.group });
    // erros típicos: o final de outro grupo aplicado ao mesmo radical (食べって, 書いて × 書って...)
    const dict = info.forms['dicionário'][0];
    const stem = info.group.startsWith('grupo 3') ? (info.forms['ます'][0]).slice(0, -2) : dict.slice(0, -1);
    const wrong = shuffle((WRONG_ENDINGS[info.kind === 'adj' ? 'adj:' + to : to] || []).map((s) => stem + s));
    return withOptions(makeExercise({ ...base, type: 'choice', prompt, optionsJapanese: true }), ansJp, wrong.filter((w) => w !== srcJp));
  });
}

// =====================================================================
// NÚMEROS, PREÇOS, HORAS E DATAS
// =====================================================================
const DIG = ['', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう'];

/** 1..99.999 em hiragana. */
export function numberKana(n) {
  const man = Math.floor(n / 10000), sen = Math.floor(n / 1000) % 10, hyaku = Math.floor(n / 100) % 10, juu = Math.floor(n / 10) % 10, ichi = n % 10;
  let s = '';
  if (man) s += DIG[man] + 'まん';
  if (sen) s += { 1: 'せん', 3: 'さんぜん', 8: 'はっせん' }[sen] || DIG[sen] + 'せん';
  if (hyaku) s += { 1: 'ひゃく', 3: 'さんびゃく', 6: 'ろっぴゃく', 8: 'はっぴゃく' }[hyaku] || DIG[hyaku] + 'ひゃく';
  if (juu) s += juu === 1 ? 'じゅう' : DIG[juu] + 'じゅう';
  if (ichi) s += DIG[ichi];
  return s;
}

export function priceKana(n) {
  const k = numberKana(n);
  return (n % 10 === 4 ? k.slice(0, -2) + 'よ' : k) + 'えん';
}

const HOURS = ['', 'いち', 'に', 'さん', 'よ', 'ご', 'ろく', 'しち', 'はち', 'く', 'じゅう', 'じゅういち', 'じゅうに'];
/** Horas (1–12) e minutos múltiplos de 5. */
export function timeKana(h, m) {
  let s = HOURS[h] + 'じ';
  if (m === 0) return s;
  const tens = Math.floor(m / 10);
  const t = tens === 0 ? '' : tens === 1 ? 'じゅう' : DIG[tens] + 'じゅう';
  s += m % 10 === 5 ? t + 'ごふん' : (tens === 1 ? 'じゅっぷん' : DIG[tens] + 'じゅっぷん');
  return s;
}

const MONTHS = ['', 'いちがつ', 'にがつ', 'さんがつ', 'しがつ', 'ごがつ', 'ろくがつ', 'しちがつ', 'はちがつ', 'くがつ', 'じゅうがつ', 'じゅういちがつ', 'じゅうにがつ'];
const DAYS = { 1: 'ついたち', 2: 'ふつか', 3: 'みっか', 4: 'よっか', 5: 'いつか', 6: 'むいか', 7: 'なのか', 8: 'ようか', 9: 'ここのか', 10: 'とおか', 14: 'じゅうよっか', 17: 'じゅうしちにち', 19: 'じゅうくにち', 20: 'はつか', 24: 'にじゅうよっか', 27: 'にじゅうしちにち', 29: 'にじゅうくにち' };
export function dateKana(month, day) {
  return MONTHS[month] + (DAYS[day] || numberKana(day) + 'にち');
}
const MONTH_PT = ['', 'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function numberItem(kind) {
  if (kind === 'price') {
    const n = pick([() => rand(11, 99) * 10, () => rand(10, 99) * 100 + pick([0, 50, 80]), () => rand(10, 50) * 1000 + pick([0, 500]), () => rand(101, 999)])();
    const show = (x) => `¥${x.toLocaleString('pt-BR')}`;
    const d = String(n).split('').map(Number);
    const near = new Set();
    const tries = [[3, 8], [6, 8], [4, 7], [1, 7], [2, 5], [3, 6], [8, 3], [8, 6], [7, 4], [7, 1], [5, 2], [6, 3]];
    d.forEach((x, i) => { for (const [a, b] of tries) if (x === a) near.add(Number(d.map((y, j) => (j === i ? b : y)).join(''))); });
    for (let i = 0; i + 1 < d.length; i++) if (d[i] !== d[i + 1] && d[i + 1] !== 0) near.add(Number(d.map((y, j) => (j === i ? d[i + 1] : j === i + 1 ? d[i] : y)).join('')));
    near.add(n * 10); near.add(n + 100); near.add(Math.max(10, n - 100)); near.add(n + 1000);
    return { label: show(n), kana: priceKana(n), wrong: shuffle([...near].filter((x) => x !== n && x > 0 && x < 100000)).map((x) => ({ label: show(x), kana: priceKana(x) })), what: 'preço' };
  }
  if (kind === 'time') {
    const h = rand(1, 12), m = pick([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
    const show = (a, b) => `${a}:${String(b).padStart(2, '0')}`;
    const alt = [[{ 4: 7, 7: 4, 1: 7, 9: 6, 6: 9 }[h] || (h % 12) + 1, m], [h, (m + 5) % 60], [h, (m + 30) % 60], [(h % 12) + 1, m], [h, (m + 10) % 60], [((h + 10) % 12) + 1, m]];
    return { label: show(h, m), kana: timeKana(h, m), wrong: shuffle(alt.filter(([a, b]) => a !== h || b !== m)).map(([a, b]) => ({ label: show(a, b), kana: timeKana(a, b) })), what: 'horário' };
  }
  const mo = rand(1, 12), day = rand(1, 28);
  const show = (a, b) => `${b} de ${MONTH_PT[a]}`;
  const alt = [[mo, { 4: 8, 8: 4, 2: 20, 20: 2, 1: 7, 7: 1, 14: 24, 24: 14, 6: 9, 9: 6 }[day] || (day % 28) + 1], [{ 4: 7, 7: 4, 1: 7, 9: 6 }[mo] || (mo % 12) + 1, day], [mo, ((day + 9) % 28) + 1], [(mo + 5) % 12 + 1, day], [mo, ((day + 3) % 28) + 1]];
  return { label: show(mo, day), kana: dateKana(mo, day), wrong: shuffle(alt.filter(([a, b]) => a !== mo || b !== day)).map(([a, b]) => ({ label: show(a, b), kana: dateKana(a, b) })), what: 'data' };
}

/** kinds: 'price' | 'time' | 'date' */
export function numbersDrill(count = 12, kinds = ['price', 'time', 'date']) {
  return Array.from({ length: count }, (_, i) => {
    const it = numberItem(kinds[i % kinds.length]);
    const wrong = distinctBy(it.wrong, (w) => w.label).filter((w) => w.label !== it.label && w.kana !== it.kana);
    let mode = i % 3; // 0 = ouvir → escolher o número; 1 = ler → escolher a leitura; 2 = digitar a leitura
    if (mode === 0 && !Speech.available) mode = 1;
    const explanation = `${it.label} = ${it.kana} (${Kana.toRomaji(it.kana)})`;
    if (mode === 0) {
      return withOptions(makeExercise({ type: 'listen', prompt: it.what === 'data' ? 'Ouça: qual é a data?' : `Ouça: qual é o ${it.what}?`, speakText: it.kana, explanation }), it.label, wrong.map((w) => w.label));
    }
    if (mode === 1) {
      return withOptions(makeExercise({ type: 'choice', prompt: `Como se lê? ${it.label}`, speakText: it.kana, optionsJapanese: true, explanation }), it.kana, wrong.map((w) => w.kana));
    }
    return makeExercise({ type: 'typing', prompt: `Escreva como se lê (romaji vira kana): ${it.label}`, speakText: it.kana, audioRevealsAnswer: true, accepted: [it.kana], explanation });
  });
}

// =====================================================================
// PARTÍCULAS
// =====================================================================
const DRILL_PARTICLES = ['は', 'が', 'を', 'に', 'で', 'へ', 'と', 'も', 'の'];
// partículas que muitas vezes servem no mesmo lugar: não entram juntas nas opções
const INTERCHANGEABLE = { 'は': 'がも', 'が': 'はもを', 'を': 'がは', 'に': 'へで', 'へ': 'に', 'で': 'に', 'と': 'も', 'も': 'はがと', 'の': 'が' };

/** Frases do curso (exemplos e diálogos) com leitura e tradução. */
export function sentencePool() {
  const out = [];
  for (const l of Content.allLessons) {
    for (const e of l.examples) if (e.length >= 3) out.push({ jp: e[0], reading: e[1] || e[0], meaning: e[2] });
    for (const d of l.dialog) if (d.length >= 4) out.push({ jp: d[1], reading: d[2] || d[1], meaning: d[3] });
  }
  for (const c of Content.phrases) for (const p of c.phrases) if (p.length >= 3) out.push({ jp: p[0], reading: p[1] || p[0], meaning: p[2] });
  return distinctBy(out, (s) => s.jp);
}

export function particleDrill(count = 12, pool = sentencePool()) {
  const result = [];
  for (const s of shuffle(pool)) {
    if (result.length >= count) break;
    if (s.jp.length > 28) continue;
    const spots = segment(s.jp).filter((g) => g.particle && DRILL_PARTICLES.includes(g.particle) && g.start > 0);
    if (!spots.length) continue;
    const spot = pick(spots);
    const p = spot.particle;
    const blank = s.jp.slice(0, spot.start) + ' ___ ' + s.jp.slice(spot.end);
    const wrong = shuffle(DRILL_PARTICLES.filter((x) => x !== p && !INTERCHANGEABLE[p].includes(x)));
    result.push(withOptions(makeExercise({
      type: 'choice', prompt: 'Qual partícula falta?', context: s.meaning, japanese: blank, speakText: s.jp,
      audioRevealsAnswer: true, optionsJapanese: true, explanation: `${s.jp}\n${p}: ${PARTICLES[p]}`,
    }), p, wrong));
  }
  return result;
}

// =====================================================================
// DITADO
// =====================================================================
export function dictationDrill(count = 10, pool = sentencePool()) {
  const short = pool.filter((s) => {
    const r = s.reading.replace(/[\s　。、？！?!]/g, '');
    return r.length >= 4 && r.length <= 16 && Kana.isAllKana(r);
  });
  return shuffle(short).slice(0, count).map((s) => makeExercise({
    type: 'typing', dictation: true, prompt: 'Ouça e escreva o que ouviu (romaji vira kana)', speakText: s.jp,
    accepted: [s.reading, s.jp], hint: s.meaning, explanation: `${s.jp} = ${s.meaning}`,
  }));
}

// =====================================================================
// MONTAR FRASE
// =====================================================================
const PUNCT = /^[、。！？!?「」『』（）()・…\s　,.]+$/;

/** Peças de uma frase: as palavras do curso, sem a pontuação. null se ficar curta ou longa demais. */
export function sentenceTiles(jp) {
  const words = segment(jp).map((s) => jp.slice(s.start, s.end)).filter((w) => !PUNCT.test(w));
  return words.length >= 3 && words.length <= 7 ? words : null;
}

export function orderDrill(count = 6, pool = sentencePool()) {
  const result = [];
  for (const s of shuffle(pool)) {
    if (result.length >= count) break;
    const words = sentenceTiles(s.jp);
    if (!words) continue;
    result.push(makeExercise({
      type: 'order', prompt: `Monte a frase: "${s.meaning}"`, correct: words, tiles: shuffle(words),
      speakText: s.jp, explanation: `${s.jp}（${s.reading.replace(/\s+/g, ' ')}）`,
    }));
  }
  return result;
}

// =====================================================================
// SESSÃO DA LIÇÃO: exercícios da lição + produção (digitar, montar, conjugar, ditado)
// =====================================================================
/** Frases da própria lição (exemplos e diálogo). */
export function lessonSentences(lesson) {
  const out = [];
  for (const e of lesson.examples) if (e.length >= 3) out.push({ jp: e[0], reading: e[1] || e[0], meaning: e[2] });
  for (const d of lesson.dialog) if (d.length >= 4) out.push({ jp: d[1], reading: d[2] || d[1], meaning: d[3] });
  return distinctBy(out, (s) => s.jp);
}

/** Exercícios extras gerados a partir da lição; não repete o que os autores já escreveram. */
export function lessonExtras(lesson) {
  const sentences = lessonSentences(lesson);
  const extras = [];
  extras.push(...orderDrill(3, sentences));
  extras.push(...particleDrill(1, sentences));
  const conj = inflectable().filter(({ v }) => lesson.vocab.some((x) => x[0] === v.jp));
  extras.push(...conjugationDrill(Math.min(3, conj.length), conj));
  if (Speech.available) extras.push(...dictationDrill(2, sentences));
  return extras;
}

/** Sessão completa da lição: autores + extras espalhados no meio (não no começo). */
export function lessonSession(lesson, base) {
  const list = [...base];
  const extras = lessonExtras(lesson);
  const start = Math.min(list.length, Math.ceil(list.length / 3));
  for (const ex of extras) list.splice(start + Math.floor(Math.random() * (list.length - start + 1)), 0, ex);
  return list;
}
