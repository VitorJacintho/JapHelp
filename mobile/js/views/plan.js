// Plano do dia: quatro tarefas curtas na tela inicial, cada uma com ✓ quando feita.
import { Content } from '../content.js';
import { Store, toIso, today } from '../store.js';
import { h } from '../ui.js';
import { openTracing } from '../trace.js';
import * as Drills from '../drills.js';
import { App } from '../app.js';

const KEY = 'japhelp.plano.v1'; // só deste aparelho: { date, drill, write }
const todayKey = () => toIso(today()).slice(0, 10);

function readFlags() {
  try {
    const f = JSON.parse(localStorage.getItem(KEY)) || {};
    return f.date === todayKey() ? f : { date: todayKey() };
  } catch { return { date: todayKey() }; }
}
function setFlag(name) {
  const f = readFlags();
  f[name] = true;
  try { localStorage.setItem(KEY, JSON.stringify(f)); } catch { /* ignora */ }
}

const DRILLS = [
  ['Conjugação', () => Drills.conjugationDrill(10)],
  ['Partículas', () => Drills.particleDrill(10)],
  ['Preços, horas e datas', () => Drills.numbersDrill(10)],
  ['Ditado', () => Drills.dictationDrill(8)],
];

const dayNumber = () => Math.floor(today() / 86400000);

/** Kanji para escrever hoje: os da revisão primeiro (vencidos ou com mais erros), senão os do começo do curso. */
export function writingSet(n = 5) {
  const d = Store.data;
  const inSrs = Object.values(d.Srs).filter((s) => s.Kind === 'kanji')
    .sort((a, b) => (d.Mistakes['k:' + b.Front] || 0) - (d.Mistakes['k:' + a.Front] || 0) || (a.Due < b.Due ? -1 : 1))
    .map((s) => s.Front);
  const list = [...new Set(inSrs)];
  if (list.length < n) {
    // complementa com os kanji do nível atual, em ordem, a partir de um ponto que muda a cada dia
    const pool = Content.kanji.filter((k) => !list.includes(k.char));
    const start = pool.length ? (dayNumber() * n) % Math.min(pool.length, 60) : 0;
    for (let i = 0; i < pool.length && list.length < n; i++) list.push(pool[(start + i) % pool.length].char);
  }
  return list.slice(0, n);
}

export function dailyPlan() {
  const flags = readFlags();
  const d = Store.data;
  const due = Store.dueCount;
  const hasSrs = Object.keys(d.Srs).length > 0;
  const next = Content.nextRecommended();
  const lessonDone = Object.values(d.Lessons).some((l) => (l.LastDate || '').startsWith(todayKey()));
  const [drillName, drillGen] = DRILLS[dayNumber() % DRILLS.length];
  const kanji = writingSet(5);
  const meaning = (c) => Content.kanji.find((k) => k.char === c)?.meaning || '';

  const tasks = [
    hasSrs ? {
      icon: '🔁', done: due === 0, title: due === 0 ? 'Revisões em dia' : `Revisar ${due} ${due === 1 ? 'cartão' : 'cartões'}`,
      sub: 'Revisão espaçada (SRS)', go: () => App.go('review'),
    } : null,
    next ? {
      icon: '📘', done: lessonDone, title: lessonDone ? 'Exercícios de uma lição feitos hoje' : `Lição: ${next.title}`,
      sub: `${next.module.title} · teoria e exercícios`, go: () => App.go(`lesson/${next.id}`),
    } : null,
    {
      icon: '🎯', done: !!flags.drill, title: `Treino do dia: ${drillName}`, sub: 'Muda a cada dia',
      go: () => App.runExercises({
        title: 'Treino do dia: ' + drillName,
        generator: drillGen,
        onComplete: (r) => { setFlag('drill'); Store.addXp(r.correct * 2); return `+${r.correct * 2} XP · treino do dia feito ✓`; },
      }),
    },
    kanji.length ? {
      icon: '✍️', done: !!flags.write, title: `Escrever 5 kanji: ${kanji.join(' ')}`, sub: 'Use o nível que preferir; no Difícil vale XP',
      go: () => { setFlag('write'); openTracing(kanji, 0, meaning); setTimeout(() => App.render(), 300); },
    } : null,
  ].filter(Boolean);

  const doneCount = tasks.filter((t) => t.done).length;
  return h('div.plan',
    h('div.plan-head', h('strong', 'Plano de hoje'), h('span.muted.small', doneCount === tasks.length ? 'tudo feito! 🎉' : `${doneCount} de ${tasks.length}`)),
    tasks.map((t) => h('button.plan-item' + (t.done ? '.done' : ''), { type: 'button', onclick: t.go },
      h('span.plan-check', t.done ? '✓' : t.icon),
      h('span.plan-text', h('span.plan-title', { lang: 'ja' }, t.title), h('small', t.sub)),
      h('span.chev', '›'))));
}
