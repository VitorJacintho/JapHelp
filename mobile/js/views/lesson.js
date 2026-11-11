// Lição: teoria, texto, vocabulário, exemplos, diálogo e exercícios.
import * as Kana from '../kana.js';
import { Content, VocabItem, vocabItems } from '../content.js';
import { Store, toIso } from '../store.js';
import { Speech } from '../speech.js';
import * as Ex from '../exercises.js';
import { openTracing } from '../trace.js';
import { h, icons, button, infoBox, section, sentenceCard, vocabTile, charTile, renderTheory, jpText, tappableJp } from '../ui.js';
import { COLORS, page, row } from './common.js';
import { App } from '../app.js';

const lessonState = { showTranslation: false };

export function LessonView(id, tab) {
  const lesson = Content.findLesson(id);
  if (!lesson) return page(infoBox('Lição não encontrada.', 'error'), button('Voltar ao curso', () => App.go('course')));
  const color = lesson.module.color || COLORS.accent;
  const tabs = [['theory', '📖 Teoria']];
  if (lesson.text.length) tabs.push(['text', '📰 Texto']);
  if (lesson.vocab.length || (lesson.kana && lesson.kana.trim())) tabs.push(['vocab', `🈁 Vocabulário (${lesson.vocab.length})`]);
  if (lesson.examples.length) tabs.push(['examples', `💬 Exemplos (${lesson.examples.length})`]);
  if (lesson.dialog.length) tabs.push(['dialog', '🎭 Diálogo']);
  tabs.push(['exercises', '✏️ Exercícios']);
  if (!tabs.some((t) => t[0] === tab)) tab = 'theory';

  const nextLesson = Content.nextLesson(lesson);
  const go = (t) => App.go(`lesson/${lesson.id}/${t}`, true);
  const content = {
    theory: () => lessonTheory(lesson, tabs, go, color),
    text: () => lessonText(lesson),
    vocab: () => lessonVocab(lesson, color),
    examples: () => lessonExamples(lesson),
    dialog: () => lessonDialog(lesson, color),
    exercises: () => lessonExercises(lesson, color),
  }[tab]();

  return h('div.page.lesson', { style: { '--mc': color } },
    h('header.lesson-head',
      h('button.icon-btn.ghost', { type: 'button', 'aria-label': 'Voltar ao curso', onclick: () => App.go('course') }, icons.back),
      h('div',
        h('div.lesson-meta', `${lesson.module.title} · Lição ${lesson.index + 1} de ${lesson.module.lessons.length}`),
        h('h1.lesson-title', lesson.title),
        h('div.lesson-sub', { lang: 'ja' }, lesson.subtitle))),
    h('nav.tabs', tabs.map(([k, label]) => h('button.tab' + (k === tab ? '.active' : ''), { type: 'button', onclick: () => go(k) }, label))),
    h('div.lesson-content', content),
    nextLesson ? h('button.btn.next-lesson', { type: 'button', onclick: () => App.go(`lesson/${nextLesson.id}`) }, `Próxima lição: ${nextLesson.title}  ›`) : null,
  );
}

function lessonTheory(lesson, tabs, go, color) {
  const lp = Store.getLesson(lesson.id);
  if (!lp.TheoryRead) { lp.TheoryRead = true; Store.save(); }
  const nextKey = tabs.length > 1 ? tabs[1][0] : 'exercises';
  return [
    h('div.card', renderTheory(lesson.theory)),
    h('button.btn.primary.wide', { type: 'button', style: { background: color }, onclick: () => go(nextKey) }, 'Continuar  →'),
  ];
}

function speakPracticeButton(text, lessonTitle, items) {
  return h('button.btn', { type: 'button', onclick: () => App.openSpeaking('Lição: ' + lessonTitle, items) }, '🎙 ' + text);
}

function lessonText(lesson) {
  const paras = lesson.text.filter((t) => t.length > 0);
  const items = paras.filter((p) => p.length >= 3).map((p) => new VocabItem(p[0], p[1], p[2], lesson.id));
  const toggle = () => { lessonState.showTranslation = !lessonState.showTranslation; App.render(); };
  return [
    lesson.textTitle ? h('h2.text-title', { lang: 'ja' }, lesson.textTitle) : null,
    h('p.muted', 'Leia primeiro sem tradução. Tente entender a ideia geral, depois os detalhes. Só então confira a tradução.'),
    row(
      Speech.available ? button('🔊 Ouvir o texto', () => Speech.speakQueue(paras.map((p) => p[0]))) : null,
      button(lessonState.showTranslation ? 'Ocultar tradução' : 'Mostrar tradução', toggle),
      speakPracticeButton('Treinar leitura em voz alta', lesson.title, items)),
    paras.map((p) => {
      const hasReading = p.length > 1 && p[1] && p[1].trim();
      const reading = hasReading ? p[1] : p[0];
      if (lessonState.showTranslation && p.length >= 3) return sentenceCard(p[0], reading, p[2]);
      const furi = Store.settings.ShowReading && hasReading && Kana.containsKanji(p[0]) ? reading : null;
      const main = (Store.settings.TapToDefine ? tappableJp : jpText)('div.reading-jp', p[0], furi);
      return h('div.card.reading-para', { onclick: () => Speech.speak(p[0]) },
        furi && !main.furigana ? h('div.jp-reading', { lang: 'ja' }, furi.replaceAll(' ', '')) : null,
        main);
    }),
  ];
}

function lessonVocab(lesson, color) {
  const out = [];
  if (lesson.kana && lesson.kana.trim()) {
    const units = Kana.splitUnits(lesson.kana);
    out.push(section('Kana desta lição'),
      h('p.muted.small', 'Toque para ouvir · segure para praticar a escrita.'),
      h('div.char-grid', units.map((u, i) => charTile(u, Kana.toRomaji(u), { big: true, onclick: () => Speech.speak(u), onlong: () => openTracing(units, i) }))),
      button('✍️ Praticar escrita destes kana', () => openTracing(units, 0)));
  }
  const items = vocabItems(lesson);
  if (items.length) {
    out.push(section('Palavras'),
      row(Speech.available ? button('▶ Ouvir todas', () => Speech.speakQueue(items.map((i) => i.jp))) : null),
      h('p.muted.small', 'Toque numa palavra para ouvir.'),
      h('div.vocab-grid', items.map((v) => vocabTile(v, color))));
  }
  return out;
}

function lessonExamples(lesson) {
  const ex = lesson.examples.filter((e) => e.length >= 3);
  return [
    h('p.muted', 'Leia em voz alta junto com o áudio (shadowing). Toque no cartão para ouvir; 🐢 = devagar.'),
    speakPracticeButton('Treinar a fala com estes exemplos', lesson.title, ex.map((e) => new VocabItem(e[0], e[1], e[2], lesson.id))),
    h('div.cards', ex.map((e) => sentenceCard(e[0], e[1], e[2]))),
  ];
}

function lessonDialog(lesson, color) {
  const lines = lesson.dialog.filter((d) => d.length >= 4);
  const speakers = [...new Set(lines.map((l) => l[0]))];
  const palette = [COLORS.indigo, COLORS.accent, COLORS.success, COLORS.warning];
  return [
    row(
      Speech.available ? h('button.btn.primary', { type: 'button', style: { background: color }, onclick: () => Speech.speakQueue(lines.map((l) => l[1])) }, '▶ Ouvir o diálogo inteiro') : null,
      speakPracticeButton('Treinar as falas', lesson.title, lines.map((l) => new VocabItem(l[1], l[2], l[3], lesson.id)))),
    h('p.muted.small', 'Dica: depois de entender, cubra a tradução e tente fazer o papel de uma das pessoas.'),
    h('div.cards', lines.map((l) => sentenceCard(l[1], l[2], l[3], { speaker: l[0], speakerColor: palette[speakers.indexOf(l[0]) % palette.length] }))),
  ];
}

function lessonExercises(lesson, color) {
  const lp = Store.data.Lessons[lesson.id];
  const parts = [];
  if (lesson.kana && lesson.kana.trim()) parts.push('leitura e reconhecimento de kana');
  if (lesson.vocab.length) parts.push('vocabulário (significado, áudio e escrita)');
  if (lesson.exercises.length) parts.push(`${lesson.exercises.length} exercícios de gramática e situações reais`);
  return [
    h('h2', 'Hora de praticar!'),
    h('p.muted', 'Esta sessão mistura ' + parts.join(', ') + '. Questões erradas voltam no final para você fixar.'),
    lp && lp.Attempts > 0
      ? infoBox(lp.Completed ? `✓ Lição concluída. Melhor resultado: ${lp.BestScore}% em ${lp.Attempts} tentativa(s).`
        : `Melhor resultado até agora: ${lp.BestScore}% — faça 70% para concluir.`, lp.Completed ? 'success' : 'warn')
      : null,
    h('button.btn.primary.big.wide', { type: 'button', style: { background: color }, onclick: () => startLessonExercises(lesson) }, '▶  Começar exercícios'),
    infoBox('Como os exercícios funcionam:\n' +
      '• Múltipla escolha: toque na opção e depois em Verificar.\n' +
      '• Digitar: escreva em romaji (ex.: "taberu") e o app converte para かな. Com teclado japonês, pode digitar direto.\n' +
      '• Montar frase: toque nas peças na ordem certa — ótimo para treinar a ordem das palavras.\n' +
      '• Ouvir: escute (ou ouça devagar) e escolha o que ouviu.', 'neutral'),
  ];
}

function startLessonExercises(lesson) {
  App.runExercises({
    title: lesson.title,
    generator: () => Ex.forLesson(lesson),
    onComplete: (r) => {
      const lp = Store.getLesson(lesson.id);
      const wasCompleted = lp.Completed;
      lp.Attempts++;
      lp.LastDate = toIso(new Date());
      lp.BestScore = Math.max(lp.BestScore, r.percent);
      let xp = r.correct * 2;
      let msg;
      if (r.percent >= 70) {
        lp.Completed = true;
        xp += wasCompleted ? 5 : 25;
        for (const v of vocabItems(lesson)) Store.addToSrs(v);
        msg = wasCompleted ? `+${xp} XP` : `Lição concluída! +${xp} XP · O vocabulário entrou na sua revisão (SRS).`;
      } else {
        msg = `+${xp} XP · Faça 70% ou mais para concluir a lição.`;
      }
      Store.addXp(xp);
      return msg;
    },
  });
}
