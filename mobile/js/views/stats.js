// Estatísticas: XP por dia, revisões previstas, estágios do SRS e o que você mais erra.
import * as Kana from '../kana.js';
import { Content } from '../content.js';
import { Store, today } from '../store.js';
import { Speech } from '../speech.js';
import { h, icons, infoBox, section, statTile } from '../ui.js';
import { COLORS, page, title } from './common.js';
import { App } from '../app.js';
import { xpHistory, reviewForecast, WEEKDAY, shortDate } from '../stats-data.js';

/** Descreve uma chave de erro ("kana:か", "k:日", "v:食べる|たべる"). */
function describeMistake(key) {
  if (key.startsWith('kana:')) { const c = key.slice(5); return { jp: c, kind: 'kana', meaning: Kana.toRomaji(c) }; }
  if (key.startsWith('k:')) {
    const c = key.slice(2);
    return { jp: c, kind: 'kanji', meaning: Content.kanji.find((k) => k.char === c)?.meaning || '' };
  }
  if (key.startsWith('v:')) {
    const [jp, reading] = key.slice(2).split('|');
    const srs = Store.data.Srs[key];
    const v = srs ? { meaning: srs.Back } : Content.allVocab.find((x) => x.jp === jp) || Content.phraseItems().find((x) => x.jp === jp);
    return { jp, reading: reading !== jp ? reading : null, kind: 'palavra', meaning: v?.meaning || '' };
  }
  return { jp: key, kind: '', meaning: '' };
}

/**
 * Gráfico de barras de uma série (cor única; sem legenda — o título nomeia a série).
 * Toque/passe o mouse numa barra para ver o valor; tabela com todos os valores logo abaixo.
 */
function barChart({ label, points, unit, format, reference = null, referenceLabel = '', labelIdx = [] }) {
  const max = Math.max(1, reference || 0, ...points.map((p) => p.value));
  const caption = h('div.chart-caption', { 'aria-live': 'polite' }, ' ');
  const showPoint = (p) => { caption.textContent = `${format(p.date)} · ${p.value} ${unit}`; };
  let selected = null;
  const bars = points.map((p, i) => {
    const bar = h('button.chart-col', {
      type: 'button',
      style: { '--h': `${(p.value / max) * 100}%` },
      'aria-label': `${format(p.date)}: ${p.value} ${unit}`,
      onclick: () => { selected?.classList.remove('sel'); selected = bar; bar.classList.add('sel'); showPoint(p); },
      onpointerenter: () => showPoint(p),
    },
    labelIdx.includes(i) && p.value > 0 ? h('span.chart-val', String(p.value)) : null,
    h('span.chart-bar', { style: { height: `${(p.value / max) * 100}%` } }));
    return bar;
  });
  const ticks = [0, Math.floor((points.length - 1) / 2), points.length - 1];
  return h('figure.chart',
    h('figcaption.chart-title', label),
    caption,
    h('div.chart-plot', { role: 'group', 'aria-label': label },
      reference ? h('div.chart-ref', { style: { bottom: `${(reference / max) * 100}%` } }, h('span', referenceLabel)) : null,
      h('div.chart-cols', { style: { '--n': points.length } }, bars)),
    h('div.chart-axis', { style: { '--n': points.length } },
      points.map((p, i) => h('span', ticks.includes(i) ? (i === points.length - 1 && label.includes('XP') ? 'hoje' : format(p.date)) : ''))),
    h('details.chart-table',
      h('summary', 'Ver em tabela'),
      h('table', h('tbody', points.map((p) => h('tr', h('td', format(p.date)), h('td.num', `${p.value} ${unit}`)))))));
}

export function StatsView() {
  const d = Store.data;
  const hist = xpHistory(d, 28);
  const last7 = hist.slice(-7).reduce((s, p) => s + p.value, 0);
  const activeDays = hist.filter((p) => p.value > 0).length;
  const goal = Math.max(10, d.Settings.DailyGoalXp);
  const goalDays = hist.filter((p) => p.value >= goal).length;
  const forecast = reviewForecast(d, 7);
  const srs = Object.values(d.Srs);
  const learning = srs.filter((s) => s.Box <= 2).length;
  const young = srs.filter((s) => s.Box > 2 && s.Box <= 5).length;
  const mature = srs.filter((s) => s.Box > 5).length;
  const mistakes = Object.entries(d.Mistakes).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const done = Object.values(d.Lessons).filter((l) => l.Completed).length;

  const maxIdx = hist.reduce((b, p, i) => (p.value > hist[b].value ? i : b), 0);
  const fMax = forecast.reduce((b, p, i) => (p.value > forecast[b].value ? i : b), 0);

  return page(
    h('div.sub-head', h('button.icon-btn.ghost', { type: 'button', 'aria-label': 'Voltar', onclick: () => App.go('home') }, icons.back),
      h('h1.page-title', 'Estatísticas')),
    h('div.stats',
      statTile('🔥', String(d.Streak), d.Streak === 1 ? 'dia seguido' : 'dias seguidos', COLORS.accent),
      statTile('⭐', String(last7), 'XP nos últimos 7 dias', COLORS.warning),
      statTile('📅', `${activeDays}/28`, 'dias com estudo', COLORS.indigo),
      statTile('🎯', `${goalDays}/28`, 'dias com a meta cumprida', COLORS.success)),
    barChart({
      label: 'XP por dia — últimas 4 semanas',
      points: hist,
      unit: 'XP',
      format: (dt) => `${WEEKDAY[dt.getDay()]} ${shortDate(dt)}`,
      reference: goal,
      referenceLabel: `meta ${goal}`,
      labelIdx: [maxIdx, hist.length - 1],
    }),
    srs.length ? [
      barChart({
        label: 'Revisões previstas — próximos 7 dias',
        points: forecast,
        unit: forecast.some((p) => p.value === 1) ? 'cartão(ões)' : 'cartões',
        format: (dt) => (+dt === +today() ? 'hoje' : `${WEEKDAY[dt.getDay()]} ${shortDate(dt)}`),
        labelIdx: [0, fMax],
      }),
      h('p.muted.small', '"Hoje" inclui as revisões atrasadas. Revisar um pouco todo dia evita acumular.'),
      section('Sua coleção na revisão'),
      h('div.stats.three',
        statTile('🌱', String(learning), 'aprendendo (até 2 dias)', COLORS.warning),
        statTile('🌿', String(young), 'jovens (4 a 14 dias)', COLORS.success),
        statTile('🌳', String(mature), 'maduros (30+ dias)', COLORS.indigo)),
    ] : infoBox('Sua revisão (SRS) ainda está vazia: conclua lições, decks ou grupos de kanji para começar.', 'indigo'),
    section('O que você mais erra'),
    mistakes.length
      ? [
        h('p.muted.small', 'Toque para ouvir. Os erros diminuem quando você acerta; treine em Praticar → Pontos fracos.'),
        h('div.dict-list', mistakes.map(([key, n]) => {
          const m = describeMistake(key);
          return h('button.dict-row.mistake-row', { type: 'button', onclick: () => Speech.speak(m.jp) },
            h('div.dict-jp', { lang: 'ja' }, m.jp, m.reading ? h('span.dict-reading', m.reading) : null),
            h('div.dict-meaning', m.meaning),
            h('div.dict-src', `${m.kind} · errou ${n}×`));
        })),
      ]
      : infoBox('Nenhum erro registrado ainda. 👏', 'success'),
    h('p.muted.small.center', `${done} lições concluídas · ${d.Xp} XP no total`),
  );
}
