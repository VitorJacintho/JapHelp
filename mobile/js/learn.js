// "Aprender as palavras": atividade guiada para decorar o vocabulário em grupos pequenos.
// Cada grupo ensina uma palavra de cada vez (cartão com leitura, letra por letra, kanji e um exemplo),
// pergunta logo em seguida e vai subindo devagar: reconhecer → lembrar → escrever com peças → usar numa
// frase → falar. Pensado para os primeiros níveis, mas serve para qualquer lista de palavras.
import * as Kana from './kana.js';
import { Content } from './content.js';
import { Store } from './store.js';
import { Speech } from './speech.js';
import { makeExercise, shuffle, distinctBy, vocabExercise, kanaDistractors } from './exercises.js';
import { segment } from './glossary.js';
import { sentenceTiles } from './drills.js';
import { speakExercise, speakingAllowed } from './speak.js';
import { h, jpText, sentenceCard, speakButtons } from './ui.js';

export const GROUP_SIZE = 4;

const clean = (s) => (s || '').replace(/[\s　]/g, '');
const withReading = (v) => (clean(v.reading) !== clean(v.jp) ? `${v.jp}（${clean(v.reading)}）` : v.jp);

/** Divide a palavra em letras (きゃ conta como uma; repete letras iguais, ao contrário de Kana.splitUnits). */
export function kanaLetters(reading) {
  const small = 'ゃゅょャュョぁぃぅぇぉァィゥェォ';
  const s = clean(reading);
  const out = [];
  for (let i = 0; i < s.length; i++) {
    if (i + 1 < s.length && small.includes(s[i + 1])) { out.push(s.slice(i, i + 2)); i++; } else out.push(s[i]);
  }
  return out;
}

/** Grupos de até 4 palavras, na ordem da lição; um resto de 1 palavra entra no grupo anterior. */
export function wordGroups(items, size = GROUP_SIZE) {
  const words = distinctBy(items.filter((v) => v.jp && v.meaning), (v) => v.jp);
  const groups = [];
  for (let i = 0; i < words.length; i += size) groups.push(words.slice(i, i + size));
  if (groups.length > 1 && groups[groups.length - 1].length < 2) groups[groups.length - 2].push(...groups.pop());
  return groups;
}

/** Uma frase que usa a palavra (como palavra inteira, não pedaço de outra: いえ não vale dentro de いいえ). */
export function sentenceFor(v, sentences) {
  const target = clean(v.jp);
  if (!target || /[〜～]/.test(target)) return null;
  for (const s of sentences) {
    if (!s.jp.includes(target) || clean(s.jp).replace(/[。、？！?!]/g, '').length <= target.length + 1) continue;
    const seg = segment(s.jp).find((g) => s.jp.slice(g.start, g.end) === target);
    if (seg) return { ...s, start: seg.start, end: seg.end };
  }
  return null;
}

/** Frases da própria lição primeiro, depois das lições anteriores (gramática que você já viu). */
export function sentencesUpTo(lesson) {
  const all = Content.allLessons;
  const idx = all.indexOf(lesson);
  const lessons = [lesson, ...all.slice(0, Math.max(0, idx)).reverse()];
  const out = [];
  for (const l of lessons) {
    for (const e of l.examples) if (e.length >= 3) out.push({ jp: e[0], reading: e[1] || e[0], meaning: e[2] });
    for (const d of l.dialog) if (d.length >= 4) out.push({ jp: d[1], reading: d[2] || d[1], meaning: d[3] });
  }
  return distinctBy(out, (s) => s.jp);
}

// ---------------------------------------------------------------- cartão de ensino
function letterBreakdown(v) {
  const letters = kanaLetters(v.reading);
  if (letters.length < 2 || letters.length > 12 || !Kana.isAllKana(letters.join(''))) return null;
  return h('div.learn-box',
    h('div.learn-label', v.hasKanji ? 'Leitura, letra por letra' : 'Letra por letra'),
    h('div.learn-parts', letters.map((u) => h('span.learn-part', h('b', { lang: 'ja' }, u), h('small', Kana.toRomaji(u))))));
}

function kanjiBreakdown(v) {
  const list = [...new Set([...v.jp].filter((c) => Kana.containsKanji(c)))]
    .map((c) => Content.kanji.find((k) => k.char === c)).filter(Boolean);
  if (!list.length) return null;
  return h('div.learn-box',
    h('div.learn-label', list.length > 1 ? 'Os kanji da palavra' : 'O kanji da palavra'),
    h('div.learn-parts', list.map((k) => h('span.learn-part.kanji', h('b', { lang: 'ja' }, k.char), h('small', k.meaning)))));
}

/** Dicas de pronúncia que mais pegam brasileiros. */
export function pronunciationTips(v) {
  const r = clean(v.reading);
  const rom = Kana.toRomaji(r);
  const tips = [];
  if (/[っッ]/.test(r)) tips.push('っ pequeno = uma pausa curta antes da consoante seguinte (きって = kit-te). Sem a pausa, vira outra palavra.');
  if (/ー/.test(r) || /(aa|ii|uu|ee|oo|ou|ei)/.test(rom)) tips.push('Vogal longa: segure o som o dobro do tempo (おばさん "tia" × おばあさん "avó").');
  if (/ん/.test(r) && /n[aiueo]/.test(rom.replace(/n'/g, ''))) tips.push('ん é um som sozinho, um pouco mais longo — não se junta com a vogal seguinte.');
  if (!v.hasKanji && [...r].every((c) => Kana.isKatakana(c) || c === 'ー')) tips.push('Katakana: usado para palavras de outras línguas. Pense na palavra original e adapte os sons.');
  return tips;
}

function learnCard(v, i, n, sentence) {
  const s = Store.settings;
  const tips = pronunciationTips(v);
  return makeExercise({
    type: 'learn', word: v, speakText: v.jp, prompt: v.meaning,
    build: () => [
      h('div.learn-tag', `Palavra nova ${i + 1} de ${n}`),
      h('div.learn-card',
        jpText('div.learn-jp', v.jp, v.hasKanji ? clean(v.reading) : null),
        h('div.learn-romaji', Kana.toRomaji(v.reading)),
        h('div.learn-meaning', v.meaning),
        speakButtons(v.jp)),
      kanjiBreakdown(v),
      letterBreakdown(v),
      tips.length ? h('div.learn-box.tip', h('div.learn-label', '💡 Pronúncia'), tips.map((t) => h('div', t))) : null,
      sentence ? h('div.learn-box', h('div.learn-label', 'Numa frase'), sentenceCard(sentence.jp, sentence.reading, sentence.meaning)) : null,
      h('p.muted.small.center', s.AutoPlayAudio ? 'Ouça e repita em voz alta 2 ou 3 vezes.' : 'Toque em 🔊, ouça e repita em voz alta 2 ou 3 vezes.'),
    ],
  });
}

// ---------------------------------------------------------------- exercícios do grupo
/** "Escreva amor": montar a palavra com as letras (mais fácil que digitar romaji). */
export function spellExercise(v) {
  const reading = clean(v.reading);
  const letters = kanaLetters(reading);
  if (letters.length < 2 || letters.length > 8 || !Kana.isAllKana(reading)) return null;
  const extra = shuffle([...new Set(letters.flatMap((u) => kanaDistractors(u, [], 2)))].filter((x) => !letters.includes(x)))
    .slice(0, letters.length <= 3 ? 2 : 3);
  const kata = !v.hasKanji && letters.every((u) => [...u].every((c) => Kana.isKatakana(c) || c === 'ー'));
  return makeExercise({
    type: 'order',
    prompt: v.hasKanji ? `Escreva "${v.meaning}" em hiragana` : kata ? `Escreva "${v.meaning}" em katakana` : `Escreva "${v.meaning}"`,
    context: v.hasKanji ? `Em kanji: ${v.jp}` : null,
    correct: letters, tiles: shuffle([...letters, ...extra]), joinTiles: '',
    answerLabel: 'Sua palavra:', orderHint: 'Toque nas letras na ordem certa. Toque numa letra colocada para devolvê-la.',
    speakText: v.jp, statKey: v.key, hint: `Em romaji: ${Kana.toRomaji(reading)}`,
    explanation: `${v.meaning} = ${withReading(v)}`,
  });
}

/** Frase com a palavra em branco; as opções são as palavras do grupo (e, se faltar, da mesma lição). */
export function blankExercise(v, s, group, siblings = []) {
  const blank = s.jp.slice(0, s.start) + ' ___ ' + s.jp.slice(s.end);
  const others = distinctBy([...shuffle(group), ...shuffle(siblings)]
    .filter((x) => x.jp !== v.jp && x.meaning !== v.meaning && !/[〜～]/.test(x.jp)), (x) => x.jp)
    .slice(0, 3).map((x) => x.jp);
  const options = shuffle([v.jp, ...others]);
  return makeExercise({
    type: 'choice', prompt: 'Qual palavra completa a frase?', context: s.meaning, japanese: blank, speakText: s.jp,
    audioRevealsAnswer: true, optionsJapanese: true, options, answer: options.indexOf(v.jp), statKey: v.key,
    explanation: `${s.jp}\n${s.meaning}`,
  });
}

/** Montar uma frase que usa a palavra ("eu amo comer sushi"). */
function sentenceOrder(v, s) {
  const words = sentenceTiles(s.jp);
  if (!words) return null;
  return makeExercise({
    type: 'order', prompt: `Monte a frase: "${s.meaning}"`, correct: words, tiles: shuffle(words), speakText: s.jp,
    statKey: v.key, explanation: `${s.jp}（${clean(s.reading)}）`,
  });
}

/**
 * Sessão de um grupo: ensina e pergunta palavra por palavra, depois escrever, usar em frases e falar.
 * siblings = as outras palavras da lição/deck (opções erradas mais justas); pool = vocabulário geral, só
 * se faltar; sentences = frases onde procurar exemplos.
 */
export function learnSession(group, { siblings = [], pool = [], sentences = [] } = {}) {
  const out = [];
  const found = new Map(group.map((v) => [v, sentenceFor(v, sentences)]));
  const distractors = siblings.length >= 4 ? siblings : [...siblings, ...pool];
  // 1. ensinar uma por vez, com perguntas fáceis logo depois (e relembrando a anterior)
  group.forEach((v, i) => {
    out.push(learnCard(v, i, group.length, found.get(v)));
    out.push(vocabExercise(v, 0, group, distractors)); // japonês → significado
    if (i > 0) out.push(vocabExercise(group[i - 1], 1, group, distractors)); // significado → japonês
  });
  out.push(vocabExercise(group[group.length - 1], 1, group, distractors));

  // 2. ouvir e escrever com as peças
  const practice = [];
  for (const v of group) { const sp = spellExercise(v); if (sp) practice.push(sp); }
  if (Speech.available) for (const v of shuffle(group).slice(0, 2)) practice.push(vocabExercise(v, 2, group, distractors));
  out.push(...shuffle(practice));

  // 3. usar a palavra numa frase: completar e montar
  let order = null;
  for (const v of shuffle(group.filter((x) => found.get(x))).slice(0, 3)) {
    const s = found.get(v);
    const ord = order ? null : sentenceOrder(v, s);
    if (ord) order = ord; else out.push(blankExercise(v, s, group, distractors));
  }
  if (order) out.push(order); // montar a frase inteira fica por último: é o mais difícil

  // 4. falar (pula sozinho sem microfone ou se você desligou)
  if (speakingAllowed()) {
    const sp = shuffle(group.filter((v) => { const r = clean(v.reading); return r.length >= 2 && Kana.isAllKana(r); }));
    if (sp[0]) out.push(speakExercise(sp[0], 'say'));
    if (sp[1]) out.push(speakExercise(sp[1], 'read'));
  }
  return out;
}

