// Exercícios de falar: o app mostra (ou toca) algo e você responde em voz alta pelo microfone.
// Modos: ler kana, ler kanji, dizer em japonês a partir do português, ouvir e repetir.
import * as Kana from './kana.js';
import { Content } from './content.js';
import { Store } from './store.js';
import { Practice } from './speech.js';
import { makeExercise, shuffle, distinctBy } from './exercises.js';
import { sentencePool } from './drills.js';

// "Estou sem microfone": desliga os exercícios de falar até o app ser fechado.
let micOff = false;
export const Mic = {
  get off() { return micOff; },
  pause() { micOff = true; },
  resume() { micOff = false; },
};

/** Dá para pôr exercícios de falar nas sessões? (aparelho reconhece fala, ajuste ligado e microfone não pausado) */
export function speakingAllowed() {
  return Practice.canRecognize && Store.settings.SpeakExercises !== false && !micOff;
}

const clean = (s) => (s || '').replace(/[\s　]/g, '');
const speakable = (v) => {
  const r = clean(v.reading);
  return r.length >= 2 && r.length <= 24 && Kana.isAllKana(r.replace(/[。、？！?!ー]/g, '')) &&
    !/[0-9０-９〇~〜～／/()（）]|___/.test(v.jp);
};
const withReading = (v) => (clean(v.reading) !== clean(v.jp) ? `${v.jp}（${clean(v.reading)}）` : v.jp);

/**
 * Um exercício de falar.
 * mode: 'read' (ler o japonês em voz alta), 'say' (português → falar em japonês), 'repeat' (ouvir e repetir).
 */
export function speakExercise(v, mode) {
  const reading = clean(v.reading) || clean(v.jp);
  const hasKanji = Kana.containsKanji(v.jp);
  const romaji = Kana.toRomaji(reading);
  const base = {
    type: 'speak', speakMode: mode, speakText: v.jp, expected: v.jp, expectedReading: reading,
    statKey: v.key ?? null, explanation: `${withReading(v)} = ${v.meaning}`,
  };
  if (mode === 'read') {
    const kata = [...reading].some(Kana.isKatakana) && !hasKanji;
    return makeExercise({
      ...base,
      prompt: hasKanji ? 'Leia em voz alta (com kanji)' : kata ? 'Leia em voz alta (katakana)' : 'Leia em voz alta',
      japanese: v.jp, audioRevealsAnswer: true, context: null,
      hint: hasKanji ? `Leitura: ${reading} (${romaji})` : `Em romaji: ${romaji}`,
      speakNote: hasKanji ? 'Leia o kanji e fale a palavra.' : null,
    });
  }
  if (mode === 'say') {
    return makeExercise({
      ...base,
      prompt: `Diga em japonês: "${v.meaning}"`, audioRevealsAnswer: true,
      hint: `Começa com ${reading[0]}… (${[...reading].length} kana) — ${Kana.toRomaji(reading[0])}…`,
    });
  }
  return makeExercise({
    ...base,
    prompt: 'Ouça e repita em voz alta', context: v.meaning, dictation: true,
    hint: withReading(v),
  });
}

/** Palavras que você já estudou (lições concluídas e revisão); sem nada estudado, as primeiras lições. */
function studiedWords() {
  const lessons = Content.allLessons.filter((l) => Store.isCompleted(l.id));
  let words = (lessons.length ? lessons : Content.allLessons.filter((l) => (l.module.order ?? 0) <= 1))
    .flatMap((l) => l.vocab.filter((x) => x.length >= 3).map((x) => ({ jp: x[0], reading: x[1] && x[1].trim() ? x[1] : x[0], meaning: x[2], key: 'v:' + x[0] + '|' + (x[1] && x[1].trim() ? x[1] : x[0]) })));
  const srs = Object.values(Store.data.Srs).filter((s) => s.Kind === 'vocab')
    .map((s) => ({ jp: s.Front, reading: s.Reading || s.Front, meaning: s.Back, key: s.Key }));
  words = distinctBy([...srs, ...words], (w) => w.jp);
  return words.filter(speakable);
}

/** Treino de fala de uma rodada. kind: 'kana' | 'kanji' | 'say' | 'repeat' | 'mix'. */
export function speakingDrill(kind = 'mix', count = 10) {
  const words = studiedWords();
  const kanaWords = words.filter((w) => !Kana.containsKanji(w.jp));
  const kanjiWords = words.filter((w) => Kana.containsKanji(w.jp));
  const sentences = sentencePool().filter((s) => speakable(s) && clean(s.reading).length <= 18);
  const take = (list, n, mode) => shuffle(list).slice(0, n).map((v) => speakExercise(v, mode));
  if (kind === 'kana') {
    // completa com palavras de kana do Nível 0 (hiragana e katakana)
    const extra = Content.allLessons.filter((l) => (l.module.order ?? 0) === 0)
      .flatMap((l) => l.vocab.filter((x) => x.length >= 3).map((x) => ({ jp: x[0], reading: x[1] || x[0], meaning: x[2], key: 'v:' + x[0] + '|' + (x[1] || x[0]) })))
      .filter((w) => speakable(w) && !Kana.containsKanji(w.jp));
    return take(distinctBy([...kanaWords, ...extra], (w) => w.jp), count, 'read');
  }
  if (kind === 'kanji') {
    const extra = Content.kanji.filter((k) => k.level === 'N5').flatMap((k) => k.words).filter(speakable);
    return take(distinctBy([...kanjiWords, ...extra], (w) => w.jp), count, 'read');
  }
  if (kind === 'say') return take(words, count, 'say');
  if (kind === 'repeat') return take(sentences, count, 'repeat');
  const n = Math.ceil(count / 4);
  return shuffle([
    ...take(kanaWords, n, 'read'), ...take(kanjiWords, n, 'read'),
    ...take(words, n, 'say'), ...take(sentences, count - 3 * n, 'repeat'),
  ]);
}

/** 1–2 exercícios de falar para a sessão de uma lição (se o aparelho deixar). */
export function lessonSpeaking(lesson, sentences) {
  if (!speakingAllowed()) return [];
  const words = lesson.vocab.filter((x) => x.length >= 3)
    .map((x) => ({ jp: x[0], reading: x[1] && x[1].trim() ? x[1] : x[0], meaning: x[2], key: 'v:' + x[0] + '|' + (x[1] && x[1].trim() ? x[1] : x[0]) }))
    .filter(speakable);
  const out = [];
  const w = shuffle(words);
  if (w[0]) out.push(speakExercise(w[0], 'read'));
  const s = shuffle(sentences.filter((x) => speakable(x) && clean(x.reading).length <= 18))[0];
  if (s) out.push(speakExercise(s, 'repeat'));
  else if (w[1]) out.push(speakExercise(w[1], 'say'));
  return out;
}
