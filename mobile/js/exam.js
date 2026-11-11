// Simulado JLPT (N5 e N4): monta uma prova com 4 seções a partir do conteúdo do curso.
// É uma estimativa: as questões seguem o estilo do JLPT, mas não são as da prova oficial.
import { Content, vocabItems } from './content.js';
import { Speech } from './speech.js';
import * as Ex from './exercises.js';
import { particleDrill, orderDrill, numbersDrill, lessonSentences } from './drills.js';

export const EXAMS = {
  N5: { modules: ['n1', 'n2'], deck: 'N5', kanji: 'N5', reading: ['n7-01', 'n7-02'], listening: [], minutes: 25 },
  N4: { modules: ['n3'], deck: 'N4', kanji: 'N4', reading: ['n7-02', 'n7-03', 'n7-04'], listening: ['n7-08'], minutes: 30 },
};

export const SECTIONS = ['Vocabulário e kanji', 'Gramática', 'Leitura', 'Audição'];
const PASS_TOTAL = 60; // % para "aprovado" (estimativa)
const PASS_SECTION = 40; // mínimo por seção, como no JLPT

const pick = (list, n) => Ex.shuffle(list).slice(0, n);
const tag = (list, section) => list.map((e) => ({ ...e, section }));

function lessonsOf(cfg) {
  return Content.modules.filter((m) => cfg.modules.includes(m.id)).flatMap((m) => m.lessons);
}

/** Exercícios escritos pelos autores, já com o texto de leitura anexado (como na lição). */
function authored(lessons) {
  return lessons.flatMap((l) => {
    const list = l.exercises.map(Ex.fromDef).filter(Boolean);
    if (l.text.length) {
      const passage = l.text.filter((t) => t.length > 0).map((t) => t[0]).join('\n');
      for (const e of list) if (e.type !== 'listen' && e.japanese == null) e.passage = passage;
    }
    return list;
  });
}

export function buildExam(level) {
  const cfg = EXAMS[level];
  const lessons = lessonsOf(cfg);
  const words = [...lessons.flatMap(vocabItems), ...Content.decks.filter((d) => d.level === cfg.deck).flatMap((d) => d.items)];
  const kanji = Content.kanji.filter((k) => k.level === cfg.kanji && k.words.length);
  const allWords = kanji.flatMap((k) => k.words);

  // 1. vocabulário e kanji: leitura de palavras com kanji + significado nos dois sentidos
  const vocab = [];
  for (const k of pick(kanji, 4)) {
    const w = k.words[0];
    const wrong = Ex.distinctBy(Ex.shuffle(allWords.filter((o) => o.reading !== w.reading)), (o) => o.reading).slice(0, 3).map((o) => o.reading);
    const ex = Ex.makeExercise({
      type: 'choice', prompt: 'Como se lê a palavra destacada?', japanese: w.jp, optionsJapanese: true,
      statKey: 'k:' + k.char, speakText: w.jp, audioRevealsAnswer: true, explanation: `${w.jp} = ${w.reading} — ${w.meaning}`,
    });
    const opts = Ex.shuffle([w.reading, ...wrong]);
    ex.options = opts;
    ex.answer = opts.indexOf(w.reading);
    vocab.push(ex);
  }
  pick(words, 8).forEach((v, i) => vocab.push(Ex.vocabExercise(v, i % 2 === 0 ? 0 : 1, words, words)));

  // 2. gramática: questões das lições + partículas + ordem das palavras
  const sentences = lessons.flatMap(lessonSentences);
  const grammar = [
    ...pick(authored(lessons).filter((e) => e.type === 'choice' && !e.passage), 5),
    ...particleDrill(3, sentences),
    ...orderDrill(2, sentences),
  ];

  // 3. leitura: textos do módulo "Leitura e escuta" do nível
  const readingLessons = cfg.reading.map((id) => Content.findLesson(id)).filter(Boolean);
  const reading = pick(authored(readingLessons).filter((e) => e.passage && e.type === 'choice'), 4);

  // 4. audição: questões de ouvir das lições + preços, horas e datas
  let listening = [];
  if (Speech.available) {
    const listenLessons = [...lessons, ...cfg.listening.map((id) => Content.findLesson(id)).filter(Boolean)];
    listening = pick(authored(listenLessons).filter((e) => e.type === 'listen'), 4);
    listening.push(...numbersDrill(6).filter((e) => e.type === 'listen').slice(0, 6 - listening.length));
  }

  return [
    ...tag(vocab, SECTIONS[0]),
    ...tag(grammar, SECTIONS[1]),
    ...tag(reading, SECTIONS[2]),
    ...tag(listening, SECTIONS[3]),
  ];
}

/** Resultado: aprovado se a nota total e cada seção passam do mínimo (estimativa). */
export function verdict(result) {
  const weak = (result.sections || []).filter((s) => s.percent < PASS_SECTION).map((s) => s.name);
  const pass = result.percent >= PASS_TOTAL && weak.length === 0;
  return { pass, weak };
}

// ---------------------------------------------------------------- melhores notas (só neste aparelho)
const KEY = 'japhelp.simulado.v1';
export function bestScores() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
export function saveScore(level, percent) {
  const all = bestScores();
  const prev = all[level];
  all[level] = { best: Math.max(prev?.best || 0, percent), last: percent, date: new Date().toISOString().slice(0, 10), count: (prev?.count || 0) + 1 };
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* ignora */ }
}
