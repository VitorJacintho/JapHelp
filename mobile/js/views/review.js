// Revisão espaçada (SRS) e treino livre.
import * as Kana from '../kana.js';
import { Content, VocabItem } from '../content.js';
import { Store, Intervals, parseDate } from '../store.js';
import { Speech } from '../speech.js';
import * as Ex from '../exercises.js';
import { h, icons, button, infoBox, progressBar, section, jpBlock, statTile, toast } from '../ui.js';
import { COLORS, page, title } from './common.js';
import { loadStrokeData } from '../strokes.js';
import { createBoard, describeResult } from '../board.js';
import { App } from '../app.js';

const review = { queue: [], pos: 0, revealed: false, reverse: false, write: false, strokes: null, reviewed: 0, lapsed: new Set(), active: false, finished: false };

export function ReviewView() {
  if (review.active) return reviewCard();
  if (review.finished) return reviewFinish();
  const all = Object.values(Store.data.Srs);
  const due = Store.dueCount;
  const dueKanji = Store.dueItems().filter((s) => s.Kind === 'kanji').length;
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
      h('button.btn.big', { type: 'button', disabled: due === 0, onclick: () => startReview(true) }, `Português → japonês (${due})`),
      h('button.btn.big', { type: 'button', disabled: dueKanji === 0, onclick: () => startReview(true, true) }, `✍️ Escrever os kanji (${dueKanji})`)),
    dueKanji > 0 ? h('p.muted.small', 'Escrever: o app mostra o significado e a leitura, você escreve o kanji de memória e ele confere a ordem e o sentido dos traços. No modo Português → japonês, os kanji também viram cartões de escrita.') : null,
    nextDue ? infoBox(`Nada pendente agora. 🎉 Próxima revisão: ${nextDue.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}. Enquanto isso, faça um treino livre ou avance no curso.`, 'success') : null,
    section('Treino livre'),
    h('p.muted.small', 'Múltipla escolha, áudio e escrita com itens aleatórios da sua coleção (não altera o agendamento).'),
    button('▶ Treino livre (20 questões)', startPractice),
    infoBox('Como avaliar cada cartão:\n• Errei — não lembrei: volta em alguns minutos.\n• Difícil — lembrei com esforço: intervalo curto.\n• Bom — lembrei normalmente: intervalo aumenta.\n• Fácil — sabia de cara: intervalo aumenta bastante.', 'neutral'),
  );
}

async function startReview(reverse, write = false) {
  // ordem dos traços: no sentido português → japonês, os kanji viram cartões de escrita
  if (reverse) review.strokes = await loadStrokeData().catch(() => null);
  review.reverse = reverse;
  review.write = write;
  let due = Store.dueItems();
  if (write) due = due.filter((s) => s.Kind === 'kanji' && review.strokes?.[s.Front]);
  if (write && due.length === 0) { toast('Não consegui carregar a ordem dos traços. Tente de novo com internet.'); return; }
  review.queue = Ex.shuffle(due.slice(0, Store.settings.MaxReviewsPerSession));
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
  if (review.reverse && cur.Kind === 'kanji' && review.strokes?.[cur.Front]) return writeCard(cur, review.strokes[cur.Front]);
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
    answer.append(
      h('div.info.info-indigo.review-answer', { lang: 'ja' }, lines.flatMap((l, i) => (i ? [h('br'), l] : [l]))),
      gradeButtons(cur));
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

const GRADE_NAMES = ['Errei', 'Difícil', 'Bom', 'Fácil'];
const GRADE_KINDS = ['danger', 'warning', 'success', 'indigo'];

/** Botões de avaliação; suggested = nota sugerida (destacada). */
function gradeButtons(cur, suggested = null) {
  return h('div.grade-row', GRADE_NAMES.map((n, g) => h('button.btn.grade.' + GRADE_KINDS[g] + (g === suggested ? '.suggested' : ''),
    { type: 'button', onclick: () => gradeCard(cur, g) }, h('span', n), h('small', nextIntervalText(cur, g)))));
}

/** Cartão de escrita: mostra significado e leitura; o aluno escreve o kanji de memória e o app confere. */
function writeCard(cur, ref) {
  let hinted = false;
  const feedback = h('div.trace-feedback.info.info-neutral', 'Escreva o kanji de memória e toque em "Conferir".');
  const after = h('div');
  const board = createBoard({ level: 'hard' });
  const wrap = h('div.review-board', board.el);
  const setFeedback = (text, kind) => {
    feedback.className = 'trace-feedback info info-' + kind;
    feedback.replaceChildren(...text.split('\n').flatMap((l, k) => (k ? [h('br'), l] : [l])));
  };
  const finish = (result) => {
    // sugestão: certo sem dica = Bom; certo com dica = Difícil; errado = Errei (o aluno pode escolher outra)
    const suggested = result?.ok ? (hinted ? 1 : 2) : 0;
    actions.hidden = true;
    after.replaceChildren(
      h('div.info.info-indigo.review-answer', { lang: 'ja' },
        h('span.review-kanji', cur.Front), h('br'), cur.Reading, cur.Extra ? [h('br'), h('small', cur.Extra)] : null),
      h('p.muted.small.center', 'Como foi? (a sugestão está destacada)'),
      gradeButtons(cur, suggested));
  };
  const check = () => {
    if (board.strokeCount === 0) { setFeedback('Desenhe primeiro. ✍️', 'warn'); return; }
    const result = board.check();
    const { kind, text } = describeResult(result, { fromMemory: !hinted });
    setFeedback(text, kind);
    finish(result);
  };
  const actions = h('div.btn-row.center.wrap.trace-actions',
    h('button.btn.small', { type: 'button', onclick: () => board.undo() }, 'Desfazer'),
    h('button.btn.small', { type: 'button', onclick: () => board.clear() }, 'Limpar'),
    h('button.btn.small', {
      type: 'button',
      onclick: () => {
        hinted = true;
        setFeedback('Dica: veja a ordem dos traços. Quando você começar a escrever, o modelo some.', 'indigo');
        board.animate();
      },
    }, '💡 Dica'),
    h('button.btn.small', { type: 'button', onclick: () => { setFeedback('Não lembrou — tudo bem. Veja o kanji e a ordem dos traços.', 'warn'); board.animate(); finish(null); } }, 'Não sei'),
    h('button.btn.small.primary', { type: 'button', onclick: check }, '✓ Conferir'));
  setTimeout(() => {
    board.resize(Math.min(320, wrap.clientWidth || 300));
    board.setChar(cur.Front, ref);
  }, 0);
  return page(
    h('div.review-top',
      h('button.icon-btn.ghost', { type: 'button', 'aria-label': 'Encerrar revisão', onclick: finishReview }, icons.close),
      h('div.muted', `Restam ${review.queue.length - review.pos} · escrever kanji`)),
    progressBar(review.pos / review.queue.length),
    h('div.card.review-back', cur.Back, h('div.review-reading', { lang: 'ja' }, cur.Reading)),
    wrap,
    feedback,
    actions,
    after,
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
