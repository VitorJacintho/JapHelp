// Treino de fala.
import * as Kana from '../kana.js';
import { Content, VocabItem } from '../content.js';
import { Store } from '../store.js';
import { Speech, Practice } from '../speech.js';
import { h, icons, button, infoBox, jpBlock, jpSpan } from '../ui.js';
import { page, title } from './common.js';
import { App } from '../app.js';

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
