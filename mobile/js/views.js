// Telas do app. Cada função recebe parâmetros da rota e devolve um elemento.
import * as Kana from './kana.js';
import { Content, VocabItem, vocabItems } from './content.js';
import { Store, Intervals, parseDate, toIso } from './store.js';
import { Speech, Practice } from './speech.js';
import * as Ex from './exercises.js';
import { openTracing } from './trace.js';
import {
  h, icons, button, infoBox, progressBar, section, jpBlock, sentenceCard, vocabTile, charTile,
  statTile, lessonCard, toast, sheet, renderTheory, jpSpan,
} from './ui.js';
import { App } from './app.js';

const COLORS = { accent: '#d64545', indigo: '#34498c', success: '#27965a', warning: '#d68c14' };

const page = (...children) => h('div.page', ...children);
const title = (text, sub) => [h('h1.page-title', text), sub ? h('p.page-sub', sub) : null];
const row = (...items) => h('div.btn-row', ...items);

// ======================================================================
// INÍCIO
// ======================================================================
export function HomeView() {
  const d = Store.data;
  const hour = new Date().getHours();
  const greet = hour < 11 ? 'おはようございます！' : hour < 18 ? 'こんにちは！' : 'こんばんは！';
  const done = Object.values(d.Lessons).filter((l) => l.Completed).length;
  const total = Content.allLessons.length;
  const todayXp = Store.todayXp;
  const goal = Math.max(10, d.Settings.DailyGoalXp);
  const next = Content.nextRecommended();
  const due = Store.dueCount;
  const weak = Object.keys(d.Mistakes).length;

  return page(
    h('h1.greet', { lang: 'ja' }, greet),
    h('p.page-sub', 'Seu curso de japonês do zero ao avançado, focado em quem vai fazer intercâmbio.'),
    Content.errors.map((e) => infoBox('Erro ao carregar conteúdo: ' + e, 'error')),
    h('div.stats',
      statTile('🔥', String(d.Streak), d.Streak === 1 ? 'dia seguido' : 'dias seguidos', COLORS.accent),
      statTile('⭐', String(d.Xp), 'XP total', COLORS.warning),
      statTile('📘', `${done}/${total}`, 'lições concluídas', COLORS.indigo),
      statTile('🔁', String(due), 'revisões para hoje', COLORS.success)),
    h('div.goal' + (todayXp >= goal ? '.ok' : ''), todayXp >= goal ? `Meta diária cumprida! 🎉  ${todayXp}/${goal} XP` : `Meta diária: ${todayXp}/${goal} XP`),
    progressBar(todayXp / goal, todayXp >= goal ? COLORS.success : COLORS.warning),
    App.installPrompt ? h('button.btn.install', { type: 'button', onclick: () => App.install() }, '📲 Instalar o JapHelp no celular') : null,
    next ? [section('Continuar de onde parou'), lessonCard(next, { wide: true, onclick: () => App.go(`lesson/${next.id}`) })]
      : total > 0 ? infoBox('Você concluiu todas as lições! 🎌 Continue revisando no SRS e praticando kanji e frases. おめでとう！', 'success') : null,
    section('Prática rápida'),
    h('div.quick',
      h('button.btn.success', { type: 'button', onclick: () => App.go('review') }, `🔁 Revisar agora (${due})`),
      h('button.btn', { type: 'button', disabled: weak === 0, onclick: startWeakSpots }, `🎯 Pontos fracos (${weak})`),
      h('button.btn', { type: 'button', onclick: () => App.go('kana') }, 'あ Quiz de kana'),
      h('button.btn', { type: 'button', onclick: () => App.go('phrases') }, '💬 Frases do dia a dia')),
    Content.tips.length ? infoBox('💡 Dica do dia: ' + Content.tips[dayOfYear() % Content.tips.length], 'tip') : null,
    Speech.available && !Speech.hasJapaneseVoice && Speech.allVoices.length > 0
      ? infoBox('🔇 Nenhuma voz japonesa encontrada neste aparelho. Instale em Ajustes do sistema → Idioma → Texto para fala (Android: "Serviços de fala do Google" → instalar dados de voz → Japonês; iPhone: Acessibilidade → Conteúdo Falado → Vozes → Japonês).', 'error')
      : null,
    section('Progresso por nível'),
    Content.modules.map((m) => {
      const c = m.lessons.filter((l) => Store.isCompleted(l.id)).length;
      return h('div.level-progress',
        h('div.level-label', h('span', m.title), h('span.muted', `${c}/${m.lessons.length}`)),
        progressBar(m.lessons.length ? c / m.lessons.length : 0, m.color));
    }),
  );
}

function dayOfYear() {
  const now = new Date();
  return Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
}

export function startWeakSpots() {
  App.runExercises({
    title: 'Pontos fracos',
    generator: () => Ex.weakSpotExercises(Store.data.Mistakes),
    onComplete: (r) => { Store.addXp(r.correct * 2); return `+${r.correct * 2} XP`; },
  });
}

// ======================================================================
// CURSO
// ======================================================================
export function CourseView() {
  const next = Content.nextRecommended();
  return page(
    ...title('Curso de japonês', 'Siga os níveis em ordem. Cada lição tem teoria, vocabulário, exemplos com áudio e exercícios. Faça 70% ou mais para concluir.'),
    Content.modules.length === 0 ? infoBox('Nenhum conteúdo encontrado.', 'error') : null,
    Content.modules.map((m) => {
      const done = m.lessons.filter((l) => Store.isCompleted(l.id)).length;
      const open = next ? next.module === m : false;
      return h('details.module', { open, style: { '--mc': m.color } },
        h('summary',
          h('div.module-head',
            h('div.module-title', m.title),
            h('div.muted.small', `${m.level ? m.level + ' · ' : ''}${done}/${m.lessons.length} concluídas`),
            progressBar(m.lessons.length ? done / m.lessons.length : 0, m.color))),
        h('p.module-desc', m.description),
        h('div.lesson-list', m.lessons.map((l) => lessonCard(l, { onclick: () => App.go(`lesson/${l.id}`) }))));
    }),
  );
}

// ======================================================================
// LIÇÃO
// ======================================================================
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
      const furi = Store.settings.ShowReading && hasReading && Kana.containsKanji(p[0]) ? reading.replaceAll(' ', '') : null;
      return h('div.card.reading-para', { onclick: () => Speech.speak(p[0]) },
        furi ? h('div.jp-reading', { lang: 'ja' }, furi) : null,
        h('div.reading-jp', { lang: 'ja' }, p[0]));
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

// ======================================================================
// REVISÃO (SRS)
// ======================================================================
const review = { queue: [], pos: 0, revealed: false, reverse: false, reviewed: 0, lapsed: new Set(), active: false, finished: false };

export function ReviewView() {
  if (review.active) return reviewCard();
  if (review.finished) return reviewFinish();
  const all = Object.values(Store.data.Srs);
  const due = Store.dueCount;
  if (all.length === 0) {
    return page(...title('Revisão espaçada (SRS)', 'O app mostra cada palavra pouco antes de você esquecê-la.'),
      infoBox('Sua revisão está vazia. Conclua lições (70%+), decks de vocabulário ou grupos de kanji para adicionar itens automaticamente. Em Frases úteis você também pode adicionar frases.', 'indigo'));
  }
  let nextDue = null;
  if (due === 0) nextDue = all.map((s) => parseDate(s.Due)).sort((a, b) => a - b)[0];
  return page(
    ...title('Revisão espaçada (SRS)', 'O app mostra cada palavra pouco antes de você esquecê-la. Revisar todo dia é o segredo para memorizar milhares de palavras.'),
    h('div.stats',
      statTile('🔁', String(due), 'para revisar agora', COLORS.success),
      statTile('🌱', String(all.filter((s) => s.Box <= 2).length), 'aprendendo', COLORS.warning),
      statTile('🌳', String(all.filter((s) => s.Box > 5).length), 'maduros (30+ dias)', COLORS.indigo),
      statTile('📚', String(all.length), 'itens no total', COLORS.accent)),
    h('div.stack',
      h('button.btn.primary.big', { type: 'button', disabled: due === 0, onclick: () => startReview(false) }, `Japonês → português (${due})`),
      h('button.btn.big', { type: 'button', disabled: due === 0, onclick: () => startReview(true) }, `Português → japonês (${due})`)),
    nextDue ? infoBox(`Nada pendente agora. 🎉 Próxima revisão: ${nextDue.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}. Enquanto isso, faça um treino livre ou avance no curso.`, 'success') : null,
    section('Treino livre'),
    h('p.muted.small', 'Múltipla escolha, áudio e escrita com itens aleatórios da sua coleção (não altera o agendamento).'),
    button('▶ Treino livre (20 questões)', startPractice),
    infoBox('Como avaliar cada cartão:\n• Errei — não lembrei: volta em alguns minutos.\n• Difícil — lembrei com esforço: intervalo curto.\n• Bom — lembrei normalmente: intervalo aumenta.\n• Fácil — sabia de cara: intervalo aumenta bastante.', 'neutral'),
  );
}

function startReview(reverse) {
  review.reverse = reverse;
  review.queue = Ex.shuffle(Store.dueItems().slice(0, Store.settings.MaxReviewsPerSession));
  review.pos = 0;
  review.reviewed = 0;
  review.lapsed = new Set();
  review.revealed = false;
  review.active = true;
  review.finished = false;
  App.render();
}

const kindName = (k) => (k === 'kanji' ? 'kanji' : k === 'frase' ? 'frase' : 'vocabulário');

function reviewCard() {
  if (review.pos >= review.queue.length) return finishReview();
  const cur = review.queue[review.pos];
  const s = Store.settings;
  const showJp = !review.reverse;
  const front = showJp
    ? jpBlock(cur.Front, { size: cur.Kind === 'kanji' ? 'xxl' : cur.Front.length > 12 ? 'sm' : 'lg', speak: cur.Kind === 'kanji' ? null : cur.Front })
    : h('div.card.review-back', cur.Back);
  const answer = h('div');
  const revealBtn = h('button.btn.primary.big.wide', { type: 'button' }, 'Mostrar resposta');
  revealBtn.onclick = () => {
    review.revealed = true;
    revealBtn.remove();
    const lines = [];
    if (review.reverse) lines.push(cur.Front);
    if (cur.Reading && cur.Reading !== cur.Front) lines.push(cur.Reading);
    if (s.ShowRomaji && cur.Kind !== 'kanji' && Kana.isAllKana(cur.Reading.replaceAll(' ', ''))) lines.push(Kana.toRomaji(cur.Reading));
    if (!review.reverse) lines.push(cur.Back);
    if (cur.Extra) lines.push(cur.Extra);
    if (cur.Kind !== 'kanji') Speech.speak(cur.Front);
    const names = ['Errei', 'Difícil', 'Bom', 'Fácil'];
    const kinds = ['danger', 'warning', 'success', 'indigo'];
    answer.append(
      h('div.info.info-indigo.review-answer', { lang: 'ja' }, lines.flatMap((l, i) => (i ? [h('br'), l] : [l]))),
      h('div.grade-row', names.map((n, g) => h('button.btn.grade.' + kinds[g], { type: 'button', onclick: () => gradeCard(cur, g) },
        h('span', n), h('small', nextIntervalText(cur, g))))));
  };
  if (showJp && cur.Kind !== 'kanji' && s.AutoPlayAudio) setTimeout(() => Speech.speak(cur.Front), 150);
  return page(
    h('div.review-top',
      h('button.icon-btn.ghost', { type: 'button', 'aria-label': 'Encerrar revisão', onclick: finishReview }, icons.close),
      h('div.muted', `Restam ${review.queue.length - review.pos} · ${kindName(cur.Kind)}`)),
    progressBar(review.pos / review.queue.length),
    h('div.review-front', front),
    h('p.muted.center', showJp ? 'Você lembra o significado e a leitura?' : 'Como se diz isso em japonês? Fale em voz alta antes de virar.'),
    revealBtn,
    answer,
  );
}

function nextIntervalText(item, grade) {
  if (grade === 0) return 'agora';
  const box = grade === 1 ? Math.max(1, item.Box) : grade === 2 ? Math.min(Intervals.length - 1, item.Box + 1) : Math.min(Intervals.length - 1, item.Box + 2);
  let days = Intervals[box];
  if (grade === 1) days = Math.max(1, Math.floor(days / 2));
  days = Math.max(1, days);
  return days === 1 ? '1 dia' : days < 30 ? `${days} dias` : `${Math.floor(days / 30)} mês(es)`;
}

function gradeCard(cur, grade) {
  Store.grade(cur, grade);
  review.reviewed++;
  if (grade === 0) {
    Store.recordMistake(cur.Key);
    review.lapsed.add(cur);
    review.queue.push(cur);
  }
  review.pos++;
  review.revealed = false;
  Store.save();
  App.render();
}

function finishReview() {
  Speech.stop();
  const xp = review.reviewed;
  Store.addXp(xp);
  Store.save();
  review.active = false;
  review.finished = true;
  review.lastXp = xp;
  setTimeout(() => App.render(), 0);
  return reviewFinish();
}

function reviewFinish() {
  return page(h('div.finish',
    h('div.finish-face.ok', { lang: 'ja' }, 'おつかれさまでした！'),
    h('div.finish-extra', `${review.reviewed} cartões revisados · +${review.lastXp ?? 0} XP`),
    h('button.btn.primary', { type: 'button', onclick: () => { review.finished = false; App.render(); } }, 'Voltar')));
}

function startPractice() {
  const srs = Object.values(Store.data.Srs);
  const items = srs.filter((s) => s.Kind !== 'kanji').map((s) => new VocabItem(s.Front, s.Reading, s.Back, 'srs'));
  const kanji = srs.filter((s) => s.Kind === 'kanji').map((s) => Content.kanji.find((k) => k.char === s.Front)).filter(Boolean);
  App.runExercises({
    title: 'Treino livre',
    generator: () => {
      const list = [];
      if (items.length >= 2) list.push(...Ex.vocabDrill(items, Math.min(16, items.length), Content.allVocab));
      if (kanji.length >= 2) list.push(...Ex.kanjiDrill(Ex.shuffle(kanji).slice(0, 4)).slice(0, 6));
      return Ex.shuffle(list).slice(0, 20);
    },
    onComplete: (r) => { Store.addXp(r.correct); return `+${r.correct} XP`; },
  });
}

// ======================================================================
// PRATICAR (menu)
// ======================================================================
export function PracticeView() {
  const item = (icon, name, desc, route) => h('button.menu-item', { type: 'button', onclick: () => App.go(route) },
    h('span.menu-icon', { lang: 'ja' }, icon), h('span.menu-text', h('strong', name), h('small', desc)), h('span.chev', '›'));
  const weak = Object.keys(Store.data.Mistakes).length;
  return page(
    ...title('Praticar'),
    h('div.menu',
      item('あ', 'Hiragana & Katakana', 'Tabelas, quiz e escrita por traçado', 'kana'),
      item('漢', 'Kanji', `${Content.kanji.length} kanji: N5, N4, N3 e placas`, 'kanji'),
      item('語', 'Vocabulário', `${Content.decks.reduce((n, d) => n + d.items.length, 0)} palavras em ${Content.decks.length} decks`, 'vocab'),
      item('話', 'Frases úteis', `${Content.phrases.reduce((n, c) => n + c.phrases.length, 0)} frases para situações reais`, 'phrases'),
      item('声', 'Treino de fala', 'Ouvir, gravar, comparar e verificar a pronúncia', 'speak'),
      item('辞', 'Dicionário', 'Busca em português, romaji ou japonês', 'dict')),
    weak > 0 ? h('button.btn.wide', { type: 'button', onclick: startWeakSpots }, `🎯 Treinar pontos fracos (${weak})`) : null,
  );
}

// ======================================================================
// KANA
// ======================================================================
const kanaState = { katakana: false, groups: new Set([0, 1]) };
const rowUnits = (i) => Kana.GojuonRows[i][1].filter((k) => k);
const KANA_GROUPS = [
  ['あ い う え お (vogais)', () => rowUnits(0)],
  ['か行  k', () => rowUnits(1)],
  ['さ行  s', () => rowUnits(2)],
  ['た行  t', () => rowUnits(3)],
  ['な行  n', () => rowUnits(4)],
  ['は行  h', () => rowUnits(5)],
  ['ま行  m', () => rowUnits(6)],
  ['や・ら・わ・ん', () => [...rowUnits(7), ...rowUnits(8), ...rowUnits(9), ...rowUnits(10)]],
  ['Dakuten: が ざ だ ば ぱ', () => Kana.DakutenRows.flatMap((r) => r[1]).filter((k) => k !== 'ぢ' && k !== 'づ')],
  ['Combinações: きゃ しゃ ちゃ…', () => Kana.YoonRows.flatMap((r) => r[1])],
];

export function KanaView() {
  const conv = (k) => (kanaState.katakana ? Kana.toKatakana(k) : k);
  const selectedUnits = () => [...new Set([...kanaState.groups].sort((a, b) => a - b).flatMap((i) => KANA_GROUPS[i][1]().map(conv)))];
  const allUnits = [];
  const tables = [];
  const addSection = (name, rows, cols) => {
    tables.push(section(name));
    const grid = h('div.kana-table', { style: { '--cols': cols } });
    for (const [, kanas] of rows) {
      for (const k of kanas) {
        const ch = k ? conv(k) : '';
        if (ch) allUnits.push(ch);
        grid.append(charTile(ch, ch ? Kana.toRomaji(ch) : '', {
          weak: Store.data.Mistakes['kana:' + ch] || 0,
          onclick: () => Speech.speak(ch),
          onlong: () => openTracing(allUnits, allUnits.indexOf(ch)),
        }));
      }
    }
    tables.push(grid);
  };
  addSection('Básicos (gojūon)', Kana.GojuonRows, 5);
  addSection('Com dakuten ゛ e handakuten ゜', Kana.DakutenRows, 5);
  addSection('Combinações (yōon)', Kana.YoonRows, 3);
  if (kanaState.katakana) {
    const ext = ['ファ', 'フィ', 'フェ', 'フォ', 'ティ', 'ディ', 'トゥ', 'ウィ', 'ウェ', 'ウォ', 'シェ', 'ジェ', 'チェ', 'ヴァ', 'ヴ'];
    tables.push(section('Katakana para sons estrangeiros'),
      h('div.kana-table', { style: { '--cols': 3 } }, ext.map((e) => charTile(e, Kana.toRomaji(e), { onclick: () => Speech.speak(e) }))));
  }

  const weakKana = Object.entries(Store.data.Mistakes).filter(([k]) => k.startsWith('kana:')).sort((a, b) => b[1] - a[1]).map(([k]) => k.slice(5));
  const startQuiz = () => {
    const units = selectedUnits();
    if (!units.length) { toast('Marque pelo menos um grupo.'); return; }
    App.runExercises({
      title: 'Quiz de kana',
      generator: () => Ex.kanaDrill(units, 20),
      onComplete: (r) => { Store.addXp(r.correct); return `+${r.correct} XP`; },
    });
  };
  const startWeak = () => {
    const weak = weakKana.slice(0, 15);
    App.runExercises({
      title: 'Kana que você mais erra',
      generator: () => Ex.kanaDrill(weak, Math.max(10, weak.length * 2)),
      onComplete: (r) => { Store.addXp(r.correct); return `+${r.correct} XP`; },
    });
  };

  return page(
    ...title('Hiragana & Katakana'),
    h('div.segmented',
      h('button' + (!kanaState.katakana ? '.active' : ''), { type: 'button', lang: 'ja', onclick: () => { kanaState.katakana = false; App.render(); } }, 'ひらがな Hiragana'),
      h('button' + (kanaState.katakana ? '.active' : ''), { type: 'button', lang: 'ja', onclick: () => { kanaState.katakana = true; App.render(); } }, 'カタカナ Katakana')),
    h('details.card.quiz-box', { open: true },
      h('summary', h('strong', 'Quiz de kana'), h('span.muted.small', ' — marque os grupos')),
      h('div.chips', KANA_GROUPS.map(([name], i) => {
        const chip = h('button.chip' + (kanaState.groups.has(i) ? '.on' : ''), { type: 'button', lang: 'ja' }, name);
        chip.onclick = () => {
          if (kanaState.groups.has(i)) kanaState.groups.delete(i); else kanaState.groups.add(i);
          chip.classList.toggle('on');
        };
        return chip;
      })),
      row(
        button('Todos', () => { KANA_GROUPS.forEach((_, i) => kanaState.groups.add(i)); App.render(); }, 'btn small'),
        button('Nenhum', () => { kanaState.groups.clear(); App.render(); }, 'btn small')),
      h('div.stack',
        h('button.btn.primary', { type: 'button', onclick: startQuiz }, '▶ Começar quiz (20)'),
        h('button.btn', { type: 'button', disabled: weakKana.length === 0, onclick: startWeak }, `🎯 Kana que mais erro (${weakKana.length})`),
        h('button.btn', { type: 'button', onclick: () => { const u = selectedUnits(); if (u.length) openTracing(u, 0); else toast('Marque pelo menos um grupo.'); } }, '✍️ Praticar escrita do grupo'))),
    h('p.muted.small', 'Toque em um kana para ouvir · segure para traçar · ponto laranja = você costuma errar.'),
    tables,
    infoBox('Dica: aprenda 1 linha por dia. Treine até reconhecer cada kana em menos de 2 segundos — isso faz toda a diferença para ler placas, cardápios e estações no Japão.', 'neutral'),
  );
}

// ======================================================================
// KANJI
// ======================================================================
const levelName = (l) => ({ N5: 'N5 · iniciante', N4: 'N4 · básico', N3: 'N3 · intermediário' }[l] || l);
const levelOrder = (l) => ({ N5: 0, N4: 1, N3: 2, N2: 3 }[l] ?? 9);

export function KanjiView(level) {
  const levels = [...new Set(Content.kanji.map((k) => k.level))].sort((a, b) => levelOrder(a) - levelOrder(b));
  if (!levels.includes(level)) level = levels[0] || '';
  const items = Content.kanji.filter((k) => k.level === level);
  const groups = new Map();
  for (const k of items) { if (!groups.has(k.group)) groups.set(k.group, []); groups.get(k.group).push(k); }

  return page(
    ...title('Kanji', 'Estude um grupo por vez: veja os detalhes, trace cada kanji e faça o quiz. Com 70%+ os kanji entram na revisão (SRS).'),
    Content.kanji.length === 0 ? infoBox('Nenhum kanji encontrado.', 'error') : null,
    h('div.pills', levels.map((l) => h('button.pill' + (l === level ? '.active' : ''), { type: 'button', onclick: () => App.go('kanji/' + l, true) }, levelName(l)))),
    [...groups.entries()].map(([g, set]) => {
      const gkey = `${level}:${g}`;
      const done = Store.hasKanjiGroup(gkey);
      const describe = (c) => set.find((x) => x.char === c)?.meaning || '';
      return h('div.kanji-group',
        h('div.group-head',
          h('h3.section' + (done ? '.done' : ''), `${done ? '✓ ' : ''}Grupo ${g + 1}`),
          h('div.btn-row',
            button('▶ Quiz', () => startKanjiQuiz(set, gkey), 'btn small'),
            button('✍️ Traçar', () => openTracing(set.map((k) => k.char), 0, describe), 'btn small'))),
        h('div.char-grid', set.map((k, i) => charTile(k.char, k.meaning.split(/[;,]/)[0].trim(), {
          big: true,
          weak: Store.data.Mistakes['k:' + k.char] || 0,
          onclick: () => showKanjiDetail(k),
          onlong: () => openTracing(set.map((x) => x.char), i, describe),
        }))));
    }),
  );
}

function showKanjiDetail(k) {
  const dash = (s) => (s && s.trim() ? s : '—');
  sheet(h('div.kanji-detail',
    h('div.kanji-big', { lang: 'ja' }, k.char),
    h('div.kanji-meaning', k.meaning),
    infoBox(`音読み on'yomi (leitura chinesa):  ${dash(k.on)}\n訓読み kun'yomi (leitura japonesa):  ${dash(k.kun)}`, 'indigo'),
    row(
      Speech.available ? button('🔊 Ouvir', () => Speech.speak(k.words[0]?.jp ?? k.char)) : null,
      button('✍️ Traçar', () => openTracing([k.char], 0, () => k.meaning))),
    k.words.length ? [section('Palavras com este kanji'), h('div.cards', k.words.map((w) => sentenceCard(w.jp, w.reading, w.meaning)))] : null,
    infoBox("On'yomi (katakana) costuma aparecer em palavras compostas de 2+ kanji (ex.: 日本). Kun'yomi (hiragana) aparece quando o kanji está sozinho ou com okurigana (ex.: 食べる).", 'neutral')));
}

function startKanjiQuiz(set, gkey) {
  App.runExercises({
    title: 'Quiz de kanji',
    generator: () => Ex.kanjiDrill(set),
    onComplete: (r) => {
      let xp = r.correct * 2;
      let msg = `+${xp} XP`;
      if (r.percent >= 70) {
        if (Store.addKanjiGroup(gkey)) xp += 15;
        for (const k of set) Store.addKanjiToSrs(k);
        msg = `+${xp} XP · Grupo concluído! Os kanji entraram na sua revisão.`;
      }
      Store.addXp(xp);
      return msg;
    },
  });
}

// ======================================================================
// VOCABULÁRIO
// ======================================================================
export function VocabView(idx) {
  if (idx != null && Content.decks[+idx]) return deckView(Content.decks[+idx]);
  const byLevel = new Map();
  Content.decks.forEach((d, i) => { const k = d.level || 'Outros'; if (!byLevel.has(k)) byLevel.set(k, []); byLevel.get(k).push([d, i]); });
  return page(
    ...title('Decks de vocabulário', 'Faça o quiz de um deck com 70% ou mais para concluí-lo — as palavras entram na revisão espaçada.'),
    Content.decks.length === 0 ? infoBox('Nenhum deck encontrado.', 'error') : null,
    [...byLevel.entries()].map(([lvl, decks]) => [
      section(lvl),
      h('div.menu', decks.map(([d, i]) => {
        const done = Store.hasDeck(d.key);
        const inSrs = d.items.filter((v) => Store.data.Srs[v.key]).length;
        return h('button.menu-item' + (done ? '.done' : ''), { type: 'button', onclick: () => App.go('vocab/' + i) },
          h('span.menu-icon', { lang: 'ja' }, d.icon),
          h('span.menu-text', h('strong', (done ? '✓ ' : '') + d.name), h('small', `${d.items.length} palavras · ${inSrs} na revisão`)),
          h('span.chev', '›'));
      })),
    ]),
  );
}

function deckView(deck) {
  const inSrs = deck.items.filter((v) => Store.data.Srs[v.key]).length;
  const done = Store.hasDeck(deck.key);
  return page(
    h('div.sub-head', h('button.icon-btn.ghost', { type: 'button', 'aria-label': 'Voltar', onclick: () => App.go('vocab') }, icons.back),
      h('h1.page-title', { lang: 'ja' }, `${deck.icon}  ${deck.name}`)),
    h('p.muted', `${deck.level} · ${deck.items.length} palavras · ${inSrs} na sua revisão${done ? ' · ✓ deck concluído' : ''}`),
    h('div.stack',
      h('button.btn.primary', { type: 'button', onclick: () => startDeckQuiz(deck) }, '▶ Quiz (20 questões)'),
      row(
        h('button.btn', { type: 'button', disabled: inSrs >= deck.items.length, onclick: () => { deck.items.forEach((v) => Store.addToSrs(v)); Store.save(); toast('Palavras adicionadas à revisão.'); App.render(); } }, '＋ Adicionar à revisão'),
        Speech.available ? button('🔊 Ouvir todas', () => Speech.speakQueue(deck.items.map((i) => i.jp))) : null,
        button('🎙 Treinar fala', () => App.openSpeaking('Deck: ' + deck.name, deck.items)))),
    h('p.muted.small', 'Toque numa palavra para ouvir.'),
    h('div.vocab-grid', deck.items.map((v) => vocabTile(v))),
  );
}

function startDeckQuiz(deck) {
  const pool = [...Content.decks.flatMap((d) => d.items), ...Content.allVocab];
  App.runExercises({
    title: 'Deck: ' + deck.name,
    generator: () => {
      const m = Store.data.Mistakes;
      const ordered = deck.items
        .map((v) => [v, m[v.key] || 0, Store.data.Srs[v.key] ? 1 : 0, Math.random()])
        .sort((a, b) => b[1] - a[1] || a[2] - b[2] || a[3] - b[3])
        .slice(0, 20).map((x) => x[0]);
      return Ex.shuffle(Ex.vocabDrill(ordered, ordered.length, pool));
    },
    onComplete: (r) => {
      let xp = r.correct * 2;
      let msg = `+${xp} XP`;
      if (r.percent >= 70) {
        if (Store.addDeck(deck.key)) xp += 15;
        deck.items.forEach((v) => Store.addToSrs(v));
        msg = `+${xp} XP · Deck concluído! As palavras entraram na sua revisão.`;
      }
      Store.addXp(xp);
      return msg;
    },
  });
}

// ======================================================================
// FRASES
// ======================================================================
const phraseState = { query: '' };

export function PhrasesView(idx) {
  if (idx != null && Content.phrases[+idx]) return phraseCategory(Content.phrases[+idx]);
  const results = h('div');
  const input = h('input.search', { type: 'search', placeholder: 'Buscar frase (português, romaji ou japonês)…', value: phraseState.query, enterkeyhint: 'search' });
  const list = h('div.menu', Content.phrases.map((c, i) => h('button.menu-item', { type: 'button', onclick: () => App.go('phrases/' + i) },
    h('span.menu-icon', { lang: 'ja' }, c.icon),
    h('span.menu-text', h('strong', c.name), h('small', `${c.phrases.length} frases`)),
    h('span.chev', '›'))));
  const update = () => {
    phraseState.query = input.value;
    const q = input.value.trim();
    list.hidden = q.length >= 2;
    if (q.length < 2) { results.replaceChildren(); return; }
    const fq = Kana.fold(q);
    const kq = Kana.toHiragana(Kana.romajiToHiragana(q.toLowerCase())).replaceAll(' ', '');
    const lower = q.toLowerCase().replaceAll(' ', '');
    const hits = Content.phrases.flatMap((c) => c.phrases.filter((p) => p.length >= 3).map((p) => [c, p]))
      .filter(([, p]) => Kana.fold(p[2]).includes(fq) || p[0].includes(q) || Kana.toHiragana(p[1]).replaceAll(' ', '').includes(kq) ||
        Kana.toRomaji(p[1]).replaceAll(' ', '').includes(lower))
      .slice(0, 60);
    results.replaceChildren(h('h3.section', `${hits.length} resultado(s) para "${q}"`),
      h('div.cards', hits.map(([c, p]) => sentenceCard(p[0], p[1], `${p[2]}   ·   [${c.name}]`))));
  };
  input.addEventListener('input', update);
  setTimeout(update, 0);
  return page(
    ...title('Frases úteis para o Japão'),
    Content.phrases.length === 0 ? infoBox('Nenhuma frase encontrada.', 'error') : null,
    input,
    results,
    list,
  );
}

function phraseCategory(cat) {
  const items = cat.items;
  const addBtn = h('button.btn', { type: 'button' }, '＋ Adicionar à revisão');
  addBtn.onclick = () => {
    items.forEach((v) => Store.addToSrs(v, 'frase'));
    Store.save();
    addBtn.textContent = '✓ Adicionadas à revisão';
    addBtn.disabled = true;
  };
  return page(
    h('div.sub-head', h('button.icon-btn.ghost', { type: 'button', 'aria-label': 'Voltar', onclick: () => App.go('phrases') }, icons.back),
      h('h1.page-title', { lang: 'ja' }, `${cat.icon}  ${cat.name}`)),
    h('div.stack',
      h('button.btn.primary', { type: 'button', onclick: () => startPhraseQuiz(cat) }, '▶ Quiz desta situação'),
      row(addBtn,
        Speech.available ? button('🔊 Ouvir todas', () => Speech.speakQueue(items.map((i) => i.jp))) : null,
        button('🎙 Treinar fala', () => App.openSpeaking('Frases úteis: ' + cat.name, items)))),
    h('div.cards', cat.phrases.filter((p) => p.length >= 3).map((p) =>
      sentenceCard(p[0], p[1], p.length >= 4 && p[3] && p[3].trim() ? `${p[2]}\n💡 ${p[3]}` : p[2]))),
  );
}

function startPhraseQuiz(cat) {
  const items = cat.items;
  App.runExercises({
    title: 'Frases: ' + cat.name,
    generator: () => Ex.phraseDrill(items, Math.min(15, items.length)),
    onComplete: (r) => { Store.addXp(r.correct * 2); return `+${r.correct * 2} XP`; },
  });
}

// ======================================================================
// DICIONÁRIO
// ======================================================================
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
      h('div.dict-jp', { lang: 'ja' }, e.v.jp, e.v.hasKanji ? h('span.dict-reading', e.v.reading) : null),
      h('div.dict-romaji', e.v.romaji),
      h('div.dict-meaning', e.v.meaning),
      h('div.dict-src', e.src))));
  };
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(fill, 180); });
  fill();
  return page(...title('Dicionário do curso'), input, count, list);
}

// ======================================================================
// TREINO DE FALA
// ======================================================================
const speakState = { custom: null, sourceIdx: 0, index: 0 };

export function setSpeakingSource(name, items) {
  speakState.custom = items && items.length ? { name, items } : null;
  speakState.sourceIdx = 0;
  speakState.index = 0;
}

function speakingSources() {
  const sources = [];
  if (speakState.custom) sources.push(speakState.custom);
  for (const m of Content.modules) {
    const seen = new Set();
    const list = m.lessons.flatMap((l) => [
      ...l.examples.filter((e) => e.length >= 3).map((e) => new VocabItem(e[0], e[1], e[2], l.id)),
      ...l.dialog.filter((d) => d.length >= 4).map((d) => new VocabItem(d[1], d[2], d[3], l.id)),
    ]).filter((v) => (seen.has(v.jp) ? false : seen.add(v.jp)));
    if (list.length) sources.push({ name: 'Frases de ' + m.title, items: list });
  }
  for (const c of Content.phrases) sources.push({ name: 'Frases úteis: ' + c.name, items: c.items });
  return sources;
}

export function SpeakingView() {
  const sources = speakingSources();
  const src = sources[Math.min(speakState.sourceIdx, sources.length - 1)] || { name: 'vazio', items: [] };
  const n = src.items.length;
  speakState.index = n ? Math.min(Math.max(speakState.index, 0), n - 1) : 0;
  const cur = n ? src.items[speakState.index] : null;
  const s = Store.settings;

  const select = h('select.select', { 'aria-label': 'Fonte das frases' },
    sources.map((x, i) => h('option', { value: String(i), selected: i === speakState.sourceIdx }, `${x.name} (${x.items.length})`)));
  select.onchange = () => { speakState.sourceIdx = +select.value; speakState.index = 0; Practice.stopAll(); App.render(); };
  const step = (d) => { Practice.stopAll(); speakState.index = (speakState.index + d + n) % n; App.render(); };

  const result = h('div.info.speak-result', { hidden: true });
  const show = (text, kind) => {
    result.hidden = false;
    result.className = 'info speak-result info-' + kind;
    result.replaceChildren(...text.split('\n').flatMap((l, i) => (i ? [h('br'), jpSpan(l)] : [jpSpan(l)])));
  };

  let busy = false;
  const recBtn = h('button.btn.danger', { type: 'button', disabled: !Practice.canRecord }, Practice.isRecording ? '⏹ Parar' : '🎙 Gravar');
  const mineBtn = h('button.btn.success', { type: 'button', disabled: !Practice.hasRecording }, '▶ Minha voz');
  const cmpBtn = h('button.btn.success', { type: 'button', disabled: !Practice.hasRecording || !Speech.available }, '⇄ Comparar');
  const checkBtn = h('button.btn.warning', { type: 'button', disabled: !Practice.canRecognize }, '✓ Verificar pronúncia');

  recBtn.onclick = async () => {
    if (!Practice.isRecording) {
      Speech.stop();
      const err = await Practice.startRecording();
      if (err) { show('Não consegui gravar: ' + err, 'error'); return; }
      recBtn.textContent = '⏹ Parar';
      show('🎙 Gravando... fale a frase e toque em "Parar".', 'accent');
    } else {
      await Practice.stopRecording();
      recBtn.textContent = '🎙 Gravar';
      mineBtn.disabled = false;
      cmpBtn.disabled = !Speech.available;
      show('Gravação pronta. Toque em "Minha voz" ou "Comparar".', 'success');
    }
  };
  mineBtn.onclick = () => Practice.playRecording();
  cmpBtn.onclick = async () => {
    if (busy) return;
    busy = true;
    try {
      show('▶ Modelo...', 'indigo');
      await Speech.speakAndWait(cur.jp);
      await new Promise((r) => setTimeout(r, 350));
      show('▶ Sua voz...', 'success');
      await Practice.playRecording();
      show('O ritmo e a melodia ficaram parecidos? Se não, ouça de novo e repita.', 'neutral');
    } finally { busy = false; }
  };
  checkBtn.onclick = async () => {
    if (busy) return;
    busy = true;
    try {
      Speech.stop();
      show('🎙 Fale a frase agora...', 'accent');
      const o = await Practice.recognize(cur.jp, cur.reading);
      if (!o.ok) { show(o.message, 'error'); return; }
      const pct = Math.round(o.score * 100);
      const prev = Store.data.SpeakingBest[cur.key] || 0;
      if (pct > prev) Store.data.SpeakingBest[cur.key] = pct;
      if (pct >= 70) Store.addXp(2);
      Store.save();
      const verdict = pct >= 90 ? 'Excelente! すばらしい！' : pct >= 70 ? 'Muito bem! Deu para entender.'
        : pct >= 45 ? 'Quase — ouça o modelo devagar e tente de novo.' : 'Não reconheci bem. Fale mais devagar e claramente.';
      const lines = [`${verdict}  (${pct}%)`];
      if (o.heard) lines.push('O celular entendeu: ' + o.heard);
      lines.push('Esperado: ' + cur.jp);
      if (o.message) lines.push(o.message);
      show(lines.join('\n'), pct >= 70 ? 'success' : pct >= 45 ? 'warn' : 'error');
    } finally { busy = false; }
  };

  const warnings = [];
  if (!Practice.canRecord) warnings.push('• Este navegador não permite gravar áudio.');
  if (!Practice.canRecognize) warnings.push('• "Verificar pronúncia" precisa de reconhecimento de fala (Chrome no Android, Safari no iPhone) e de internet.');

  return page(
    ...title('Treino de fala', 'Shadowing: ouça o modelo, repita em voz alta, grave e compare. Falar é o que destrava a conversa no Japão.'),
    select,
    n ? h('div.speak-nav',
      h('button.icon-btn', { type: 'button', 'aria-label': 'Anterior', onclick: () => step(-1) }, icons.back),
      h('span.muted', `${speakState.index + 1} / ${n}`),
      h('button.icon-btn', { type: 'button', 'aria-label': 'Próxima', onclick: () => step(1) }, icons.next),
      button('🔀 Aleatória', () => { speakState.index = Math.floor(Math.random() * n); Practice.stopAll(); App.render(); }, 'btn small')) : null,
    cur ? [
      jpBlock(cur.jp, {
        size: cur.jp.length > 18 ? 'sm' : 'md',
        reading: cur.hasKanji && s.ShowReading ? cur.reading.replaceAll(' ', '') : null,
        romaji: s.ShowRomaji ? Kana.toRomaji(cur.reading) : null,
      }),
      infoBox(cur.meaning, 'indigo'),
      Store.data.SpeakingBest[cur.key] != null
        ? h('div.small' + (Store.data.SpeakingBest[cur.key] >= 80 ? '.ok-text' : '.warn-text'), `Sua melhor nota nesta frase: ${Store.data.SpeakingBest[cur.key]}%`) : null,
      h('div.speak-actions',
        h('button.btn.indigo', { type: 'button', onclick: () => Speech.speak(cur.jp) }, '🔊 Ouvir'),
        h('button.btn.indigo-soft', { type: 'button', onclick: () => Speech.speak(cur.jp, true) }, '🐢 Devagar'),
        recBtn, mineBtn, cmpBtn, checkBtn),
      result,
    ] : infoBox('Nenhuma frase nesta fonte.', 'neutral'),
    warnings.length ? infoBox(warnings.join('\n'), 'error') : null,
    infoBox('Como treinar (5 minutos por dia já fazem diferença):\n' +
      '1. Ouça a frase 2–3 vezes, primeiro devagar, prestando atenção na melodia.\n' +
      '2. Repita junto com o áudio (shadowing), imitando ritmo e entonação — não só as sílabas.\n' +
      '3. Grave sozinho e use "Comparar": o app toca o modelo e logo depois a sua voz.\n' +
      '4. Use "Verificar pronúncia" para ver se o celular entende o que você disse.\n' +
      'Atenção às vogais longas (おばさん × おばあさん) e ao っ (きて × きって): é onde brasileiros mais erram.', 'neutral'),
  );
}

// ======================================================================
// AJUSTES
// ======================================================================
export function SettingsView() {
  const s = Store.settings;
  const toggle = (label, key, note) => {
    const input = h('input', { type: 'checkbox', checked: !!s[key] });
    input.onchange = () => { s[key] = input.checked; Store.save(); };
    return h('label.toggle', h('span', label, note ? h('small', note) : null), input, h('span.switch'));
  };
  const number = (label, key, min, max, stepv) => {
    const input = h('input.num', { type: 'number', min, max, step: stepv, value: String(s[key]), inputmode: 'numeric' });
    input.onchange = () => { s[key] = Math.min(max, Math.max(min, parseInt(input.value, 10) || min)); input.value = s[key]; Store.save(); };
    return h('label.field', h('span', label), input);
  };

  const ja = Speech.japaneseVoices;
  const voiceSelect = h('select.select', { 'aria-label': 'Voz' },
    h('option', { value: '' }, '(automática)'),
    ja.map((v) => h('option', { value: v.voiceURI, selected: v.voiceURI === Speech.currentVoiceUri }, `${v.name}${v.localService ? '' : ' (online)'}`)));
  voiceSelect.onchange = () => { Speech.selectVoice(voiceSelect.value || null); Speech.speak('こんにちは。わたしの こえは どうですか。'); };
  const speedLabel = h('span', `Velocidade: ${Speech.speed.toFixed(2)}×`);
  const speed = h('input.range', { type: 'range', min: '50', max: '150', step: '5', value: String(Math.round(Speech.speed * 100)) });
  speed.oninput = () => { s.SpeechSpeed = +speed.value / 100; speedLabel.textContent = `Velocidade: ${s.SpeechSpeed.toFixed(2)}×`; };
  speed.onchange = () => Store.save();

  const fileInput = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
  fileInput.onchange = async () => {
    const f = fileInput.files[0];
    if (!f) return;
    try {
      const text = await f.text();
      if (!confirm('Substituir o progresso deste aparelho pelo do arquivo?')) return;
      Store.importJson(text);
      toast('Progresso importado!');
      App.render();
    } catch (e) {
      alert('Arquivo inválido: ' + e.message);
    }
  };
  const exportProgress = () => {
    const blob = new Blob([Store.exportJson()], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: 'progress.json' });
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };

  return page(
    ...title('Ajustes'),
    section('Exibição'),
    h('div.card.settings',
      toggle('Mostrar romaji junto do japonês', 'ShowRomaji', 'Recomendado: desligue depois do Nível 0 — o romaji vira muleta.'),
      toggle('Mostrar leitura em kana (furigana)', 'ShowReading'),
      toggle('Tocar áudio automaticamente', 'AutoPlayAudio')),
    section('Metas'),
    h('div.card.settings',
      number('Meta diária de XP', 'DailyGoalXp', 10, 500, 10),
      number('Máx. de cartões por revisão', 'MaxReviewsPerSession', 10, 300, 10)),
    section('Voz (áudio em japonês)'),
    h('div.card.settings',
      Speech.hasJapaneseVoice
        ? infoBox(`✓ ${ja.length} voz(es) japonesa(s). Em uso: ${Speech.voiceName}`, 'success')
        : infoBox('Nenhuma voz japonesa listada. O app tenta usar a voz padrão do sistema para japonês.\n' +
          'Android: Configurações → Sistema → Idiomas → Saída de conversão de texto em voz → Serviços de fala do Google → Instalar dados de voz → Japonês.\n' +
          'iPhone: Ajustes → Acessibilidade → Conteúdo Falado → Vozes → Japonês.', 'warn'),
      ja.length ? h('label.field', h('span', 'Voz'), voiceSelect) : null,
      h('label.field.col', speedLabel, speed),
      button('🔊 Testar', () => Speech.speak('こんにちは。いっしょに日本語を勉強しましょう。')),
      h('p.muted.small', 'Dica: comece em 0,8× para aprender e suba até 1,1× para treinar o ouvido para a velocidade real.')),
    section('Diagnóstico'),
    infoBox(
      'Vozes japonesas: ' + (ja.length ? ja.map((v) => v.name).join(', ') : 'nenhuma') + '\n' +
      'Gravação pelo microfone: ' + (Practice.canRecord ? '✓ disponível' : '✗ indisponível') + '\n' +
      'Reconhecimento de fala: ' + (Practice.canRecognize ? '✓ disponível (precisa de internet)' : '✗ indisponível neste navegador') + '\n' +
      `Conteúdo: ${Content.allLessons.length} lições · ${Content.kanji.length} kanji · ${Content.phrases.reduce((n, c) => n + c.phrases.length, 0)} frases`, 'neutral'),
    section('Seu progresso'),
    h('p.muted.small', 'O progresso fica salvo neste aparelho. Exporte para guardar uma cópia ou levar para outro aparelho. ' +
      'Também dá para importar o progress.json do app de PC (%APPDATA%\\JapHelp\\progress.json) e vice-versa.'),
    h('div.stack',
      button('⬇ Exportar progresso', exportProgress),
      button('⬆ Importar progresso', () => fileInput.click()),
      fileInput,
      App.installPrompt ? button('📲 Instalar o app', () => App.install()) : null,
      h('button.btn.danger', {
        type: 'button',
        onclick: () => {
          if (confirm('Isso apaga lições concluídas, XP, sequência e toda a revisão (SRS). Não dá para desfazer. Continuar?')) {
            Store.reset();
            App.go('home');
          }
        },
      }, '🗑 Zerar todo o progresso')),
    h('p.muted.small.center', 'JapHelp · funciona offline depois do primeiro acesso.'),
  );
}
