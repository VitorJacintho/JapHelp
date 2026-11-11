// Tela inicial.
import { Content } from '../content.js';
import { Store } from '../store.js';
import { Speech } from '../speech.js';
import * as Ex from '../exercises.js';
import { h, infoBox, progressBar, section, statTile, lessonCard, toast } from '../ui.js';
import { COLORS, page } from './common.js';
import { Backup } from '../backup.js';
import { App } from '../app.js';

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
    Backup.shouldRemind ? backupReminder() : null,
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

function backupReminder() {
  const last = Backup.lastBackup;
  const text = last
    ? `💾 Seu último backup foi em ${last.toLocaleDateString('pt-BR')}. Guarde uma cópia nova do progresso.`
    : '💾 Seu progresso fica só neste aparelho. Se o celular for trocado ou os dados do navegador forem limpos, ele se perde. Guarde uma cópia (Drive, WhatsApp, e-mail...).';
  return h('div.info.info-warn.backup-reminder',
    h('div', text),
    h('div.btn-row',
      h('button.btn.small.primary', {
        type: 'button',
        onclick: async () => {
          const r = await Backup.export();
          if (r !== 'cancelled') { toast(r === 'shared' ? 'Backup feito!' : 'Arquivo salvo em Downloads.'); App.render(); }
        },
      }, 'Fazer backup agora'),
      h('button.btn.small', { type: 'button', onclick: () => { Backup.snooze(7); App.render(); } }, 'Lembrar depois')));
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
