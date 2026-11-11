// Monta listas de exercícios (porte de Core/ExerciseFactory.cs).
import * as Kana from './kana.js';
import { Content, vocabItems } from './content.js';
import { Speech } from './speech.js';

export function shuffle(items) {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export function distinctBy(items, keyFn) {
  const seen = new Set();
  return items.filter((x) => {
    const k = keyFn(x);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** type: 'choice' | 'typing' | 'order' | 'listen' */
export function makeExercise(props) {
  return {
    type: 'choice', context: null, prompt: '', japanese: null, japaneseReading: null, speakText: null,
    options: [], answer: 0, optionsJapanese: false, accepted: [], tiles: [], correct: [],
    explanation: null, hint: null, statKey: null, bigJapanese: false, audioRevealsAnswer: false, passage: null,
    ...props,
  };
}

export function correctAnswerText(ex) {
  switch (ex.type) {
    case 'choice':
    case 'listen': return ex.options[ex.answer] ?? '';
    case 'typing': return ex.accepted[0] ?? '';
    case 'order': return ex.correct.join(' ');
    default: return '';
  }
}

function shuffleOptions(ex, options, correctIndex) {
  const correct = options[correctIndex];
  ex.options = shuffle(options);
  ex.answer = ex.options.indexOf(correct);
}

// ================= LIÇÃO =================
export function forLesson(lesson) {
  const result = [];
  if (lesson.kana && lesson.kana.trim()) result.push(...kanaDrill(Kana.splitUnits(lesson.kana), 12));

  const vocab = vocabItems(lesson);
  if (vocab.length > 0) {
    const n = lesson.exercises.length >= 10 ? 6 : 9;
    result.push(...vocabDrill(vocab, Math.min(n, vocab.length), Content.allVocab));
  }

  const authored = lesson.exercises.map(fromDef).filter(Boolean);
  if (lesson.text.length > 0) {
    const passage = lesson.text.filter((t) => t.length > 0).map((t) => t[0]).join('\n');
    for (const e of authored) if (e.type !== 'listen' && e.japanese == null) e.passage = passage;
  }
  result.push(...authored);
  return result;
}

export function fromDef(d) {
  const t = (d.t || 'mc').toLowerCase();
  if (t === 'mc' || t === 'listen') {
    if (!d.o || d.o.length < 2) return null;
    const ex = makeExercise({
      type: t === 'listen' ? 'listen' : 'choice',
      context: d.ctx,
      prompt: d.q ?? (t === 'listen' ? 'O que você ouviu?' : 'Escolha a resposta correta'),
      japanese: d.jp ?? null,
      speakText: d.s ?? d.jp,
      explanation: d.e,
      hint: d.hint,
    });
    shuffleOptions(ex, d.o, Math.min(Math.max(d.a || 0, 0), d.o.length - 1));
    ex.optionsJapanese = ex.options.some(Kana.containsJapanese);
    return ex;
  }
  if (t === 'type') {
    if (!d.acc || d.acc.length === 0) return null;
    return makeExercise({
      type: 'typing', context: d.ctx, prompt: d.q ?? 'Escreva em japonês', japanese: d.jp ?? null,
      speakText: d.s ?? d.jp, accepted: d.acc, explanation: d.e, hint: d.hint,
    });
  }
  if (t === 'order') {
    if (!d.w || d.w.length < 2) return null;
    return makeExercise({
      type: 'order', context: d.ctx, prompt: d.q ?? 'Monte a frase', japanese: d.jp ?? null,
      correct: d.w, tiles: shuffle([...d.w, ...(d.x || [])]), speakText: d.w.join(''), explanation: d.e, hint: d.hint,
    });
  }
  return null;
}

// ================= KANA =================
export function kanaDrill(units, count) {
  const result = [];
  if (units.length === 0) return result;
  let pool = shuffle(units);
  while (pool.length < count) pool.push(...shuffle(units));
  pool = pool.slice(0, count);

  pool.forEach((u, i) => {
    const romaji = Kana.toRomaji(u);
    let mode = i % 3;
    if (mode === 2 && !Speech.available) mode = 1;
    if (mode === 0) {
      result.push(makeExercise({
        type: 'typing', prompt: 'Como se lê este kana? Digite em romaji.', japanese: u, bigJapanese: true,
        audioRevealsAnswer: true, speakText: u, accepted: [u], statKey: 'kana:' + u, explanation: `${u} = ${romaji}`,
      }));
    } else {
      const ex = makeExercise({
        type: mode === 1 ? 'choice' : 'listen',
        prompt: mode === 1 ? `Qual kana é "${romaji}"?` : 'Ouça e escolha o kana correto',
        speakText: u, statKey: 'kana:' + u, optionsJapanese: true,
        explanation: mode === 1 ? `${romaji} = ${u}` : `Você ouviu "${romaji}" = ${u}`,
      });
      shuffleOptions(ex, [u, ...kanaDistractors(u, units, 3)], 0);
      result.push(ex);
    }
  });
  return result;
}

const SimilarKana = [
  ['あ', 'お', 'め', 'ぬ'], ['い', 'り', 'こ'], ['う', 'ら', 'つ'], ['さ', 'ち', 'き'],
  ['は', 'ほ', 'け'], ['ね', 'れ', 'わ'], ['る', 'ろ'], ['ぬ', 'め'], ['し', 'つ', 'も'],
  ['シ', 'ツ'], ['ソ', 'ン', 'リ'], ['ク', 'ワ', 'ウ', 'タ'], ['コ', 'ユ'], ['チ', 'テ'],
  ['ヌ', 'ス', 'フ'], ['マ', 'ム', 'ア'], ['ノ', 'メ'], ['ハ', 'ル'], ['セ', 'サ', 'ヤ'],
];

function kanaDistractors(target, pool, n) {
  const cands = [];
  for (const g of SimilarKana) if (g.includes(target)) cands.push(...g.filter((x) => x !== target));
  cands.push(...shuffle(pool.filter((p) => p !== target)));
  if (cands.length < n) {
    const kata = [...target].some(Kana.isKatakana);
    const all = Kana.GojuonRows.flatMap((r) => r[1]).filter((k) => k !== '');
    cands.push(...shuffle(all.map((k) => (kata ? Kana.toKatakana(k) : k)).filter((k) => k !== target)));
  }
  return [...new Set(cands)].filter((c) => c !== target).slice(0, n);
}

// ================= VOCABULÁRIO =================
export function vocabDrill(items, count, distractorPool) {
  const result = [];
  shuffle(items).slice(0, count).forEach((v, i) => {
    let mode = i % 4;
    if (mode === 2 && !Speech.available) mode = 0;
    const canType = v.reading.length <= 10 && Kana.isAllKana(v.reading);
    if (mode === 3 && !canType) mode = 1;
    result.push(vocabExercise(v, mode, items, distractorPool));
  });
  return result;
}

/** mode: 0 = JP→PT, 1 = PT→JP, 2 = ouvir→PT, 3 = digitar leitura */
export function vocabExercise(v, mode, sameSet, pool) {
  const others = distinctBy(
    [
      ...shuffle(sameSet.filter((x) => x.meaning !== v.meaning && x.jp !== v.jp)),
      ...shuffle(pool.filter((x) => x.meaning !== v.meaning && x.jp !== v.jp)).slice(0, 12),
    ],
    (x) => x.meaning,
  ).slice(0, 3);

  if (mode === 0 || mode === 2) {
    const ex = makeExercise(mode === 0
      ? {
        type: 'choice', prompt: 'O que significa?', japanese: v.jp, japaneseReading: v.hasKanji ? v.reading : null,
        speakText: v.jp, statKey: v.key, explanation: `${jpWithReading(v)} = ${v.meaning}`,
      }
      : {
        type: 'listen', prompt: 'Ouça e escolha o significado', speakText: v.jp, statKey: v.key,
        explanation: `Você ouviu: ${jpWithReading(v)} = ${v.meaning}`,
      });
    shuffleOptions(ex, [v.meaning, ...others.map((o) => o.meaning)], 0);
    return ex;
  }
  if (mode === 1) {
    const ex = makeExercise({
      type: 'choice', prompt: `Como se diz "${v.meaning}"?`, speakText: v.jp, statKey: v.key, optionsJapanese: true,
      explanation: `${v.meaning} = ${jpWithReading(v)}`,
    });
    shuffleOptions(ex, [...new Set([v.jp, ...others.map((o) => o.jp)])], 0);
    return ex;
  }
  return makeExercise({
    type: 'typing', prompt: `Escreva em japonês (romaji vira kana): "${v.meaning}"`, speakText: v.jp,
    audioRevealsAnswer: true, statKey: v.key, accepted: [v.reading, v.jp],
    hint: `Começa com ${v.reading[0]}… (${v.reading.length} kana)`,
    explanation: `${v.meaning} = ${jpWithReading(v)}`,
  });
}

// ================= KANJI =================
export function kanjiDrill(set) {
  const result = [];
  const allKanji = Content.kanji;
  for (const k of shuffle(set)) {
    const ex1 = makeExercise({
      type: 'choice', prompt: 'Qual o significado deste kanji?', japanese: k.char, bigJapanese: true,
      statKey: 'k:' + k.char, explanation: `${k.char}: ${k.meaning}  ·  on: ${k.on}  ·  kun: ${k.kun}`,
    });
    const wrong = distinctBy(shuffle([...set, ...allKanji].filter((o) => o.char !== k.char && o.meaning !== k.meaning)), (o) => o.meaning)
      .slice(0, 3).map((o) => o.meaning);
    shuffleOptions(ex1, [k.meaning, ...wrong], 0);
    result.push(ex1);

    const w = k.words[0];
    if (w) {
      const readings = distinctBy(shuffle([...set, ...allKanji].flatMap((o) => o.words).filter((o) => o.reading !== w.reading)), (o) => o.reading)
        .slice(0, 3).map((o) => o.reading);
      const ex2 = makeExercise({
        type: 'choice', prompt: `Como se lê esta palavra? (${w.meaning})`, japanese: w.jp, speakText: w.jp,
        audioRevealsAnswer: true, statKey: 'k:' + k.char, optionsJapanese: true,
        explanation: `${w.jp} = ${w.reading} (${Kana.toRomaji(w.reading)}) — ${w.meaning}`,
      });
      shuffleOptions(ex2, [w.reading, ...readings], 0);
      result.push(ex2);
    }
  }
  for (const k of shuffle(set).slice(0, Math.min(5, set.length))) {
    const ex3 = makeExercise({
      type: 'choice', prompt: `Qual kanji significa "${k.meaning}"?`, statKey: 'k:' + k.char, optionsJapanese: true,
      explanation: `${k.meaning} = ${k.char}`,
    });
    const wrong = distinctBy(shuffle([...set, ...allKanji].filter((o) => o.char !== k.char)), (o) => o.char).slice(0, 3).map((o) => o.char);
    shuffleOptions(ex3, [k.char, ...wrong], 0);
    result.push(ex3);
  }
  return result;
}

// ================= FRASES =================
export function phraseDrill(phrases, count) {
  const pool = Content.phraseItems();
  return shuffle(phrases).slice(0, count).map((p, i) => {
    let mode = i % 3;
    if (mode === 2 && !Speech.available) mode = 0;
    return vocabExercise(p, mode === 0 ? 1 : mode === 1 ? 0 : 2, phrases, pool);
  });
}

// ================= PONTOS FRACOS =================
export function weakSpotExercises(mistakes) {
  const keys = Object.entries(mistakes).sort((a, b) => b[1] - a[1]).slice(0, 20).map((kv) => kv[0]);
  const result = [];
  const kanaUnits = keys.filter((k) => k.startsWith('kana:')).map((k) => k.slice(5));
  if (kanaUnits.length > 0) result.push(...kanaDrill(kanaUnits, Math.min(10, kanaUnits.length * 2)));
  const vocab = new Map();
  for (const v of [...Content.allVocab, ...Content.decks.flatMap((d) => d.items), ...Content.phraseItems(), ...Content.kanji.flatMap((k) => k.words)]) if (!vocab.has(v.key)) vocab.set(v.key, v);
  const all = [...vocab.values()];
  let i = 0;
  for (const k of keys.filter((k) => k.startsWith('v:'))) {
    const v = vocab.get(k);
    if (v) result.push(vocabExercise(v, i++ % 3, all, all));
  }
  const kanji = keys.filter((k) => k.startsWith('k:')).map((k) => Content.kanji.find((x) => 'k:' + x.char === k)).filter(Boolean);
  if (kanji.length > 0) result.push(...kanjiDrill(kanji).slice(0, 10));
  return shuffle(result);
}

const jpWithReading = (v) => (v.reading.replaceAll(' ', '') !== v.jp.replaceAll(' ', '') ? `${v.jp}（${v.reading}）` : v.jp);
