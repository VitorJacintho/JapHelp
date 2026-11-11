// Simulado JLPT: escolha do nível, regras e melhores notas.
import { Store } from '../store.js';
import { Speech } from '../speech.js';
import { h, icons, infoBox, section } from '../ui.js';
import { page } from './common.js';
import { EXAMS, SECTIONS, buildExam, verdict, bestScores, saveScore } from '../exam.js';
import { App } from '../app.js';

function start(level) {
  const cfg = EXAMS[level];
  App.runExercises({
    title: `Simulado JLPT ${level}`,
    generator: () => buildExam(level),
    exam: { seconds: cfg.minutes * 60 },
    onComplete: (r) => {
      saveScore(level, r.percent);
      const v = verdict(r);
      const xp = Math.round(r.correct * 1.5);
      Store.addXp(xp);
      const msg = v.pass
        ? `Aprovado no simulado ${level}! 🎉 (+${xp} XP)`
        : `Ainda não deu: ${v.weak.length ? 'reforce ' + v.weak.join(', ') : 'faltou chegar a 60% no total'}. (+${xp} XP)`;
      const unanswered = r.total - r.answered;
      return unanswered > 0 ? `${msg} · ${unanswered} sem resposta (o tempo acabou)` : msg;
    },
  });
}

export function ExamView() {
  const best = bestScores();
  return page(
    h('div.sub-head', h('button.icon-btn.ghost', { type: 'button', 'aria-label': 'Voltar', onclick: () => App.go('practice') }, icons.back),
      h('h1.page-title', 'Simulado JLPT')),
    h('p.page-sub', 'Uma prova no estilo do JLPT, montada com o conteúdo do curso: a correção só aparece no fim, com a nota de cada seção.'),
    Object.entries(EXAMS).map(([level, cfg]) => {
      const b = best[level];
      return h('div.card.exam-card',
        h('div.exam-card-head', h('strong.exam-level', level), h('span.muted', `${cfg.minutes} minutos`)),
        h('div.small.muted', SECTIONS.filter((s) => s !== 'Audição' || Speech.available).join(' · ')),
        b ? h('div.small', `Melhor nota: ${b.best}% · última: ${b.last}% (${b.count}×)`) : h('div.small.muted', 'Você ainda não fez este simulado.'),
        h('button.btn.primary', { type: 'button', onclick: () => start(level) }, `▶ Começar simulado ${level}`));
    }),
    section('Como funciona'),
    infoBox('• Cerca de 30 questões em 4 seções: vocabulário e kanji, gramática, leitura e audição.\n' +
      '• Não há correção durante a prova e os erros não voltam no fim.\n' +
      '• Quando o tempo acaba, as questões que faltam contam como erro.\n' +
      '• Aprovado = 60% no total e pelo menos 40% em cada seção, como no JLPT.\n' +
      '• É uma estimativa: as questões seguem o estilo do JLPT, mas não são da prova oficial.', 'neutral'),
    !Speech.available ? infoBox('Sem voz japonesa no aparelho, a seção de audição fica de fora.', 'warn') : null,
  );
}
