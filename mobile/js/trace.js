// Prática de escrita: traçar com o dedo por cima do caractere.
import * as Kana from './kana.js';
import { Speech } from './speech.js';
import { h, icons } from './ui.js';

export function openTracing(chars, index = 0, describe = null) {
  if (!chars || chars.length === 0) return;
  describe = describe || ((c) => (Kana.isAllKana(c) ? Kana.toRomaji(c) : ''));
  let i = Math.min(Math.max(index, 0), chars.length - 1);
  let strokes = [];
  let current = null;
  let showGuide = true;

  const info = h('div.trace-info', { lang: 'ja' });
  const canvas = h('canvas.trace-canvas');
  const guideBtn = h('button.btn.small', { type: 'button' }, 'Ocultar modelo');
  const ctx = canvas.getContext('2d');

  const close = () => {
    window.removeEventListener('resize', resize);
    overlay.remove();
    history.state?.trace && history.back();
  };
  const overlay = h('div.trace-overlay',
    h('header.trace-top',
      h('button.icon-btn.ghost', { type: 'button', 'aria-label': 'Fechar', onclick: close }, icons.close),
      h('div.trace-title', 'Prática de escrita — 書く練習')),
    info,
    h('div.trace-canvas-wrap', canvas),
    h('div.btn-row.center.wrap',
      h('button.icon-btn', { type: 'button', 'aria-label': 'Anterior', onclick: () => move(-1) }, icons.back),
      h('button.icon-btn', { type: 'button', 'aria-label': 'Ouvir', onclick: () => Speech.speak(chars[i]) }, icons.volume),
      h('button.icon-btn', { type: 'button', 'aria-label': 'Próximo', onclick: () => move(1) }, icons.next),
      h('button.btn.small', { type: 'button', onclick: () => { strokes.pop(); draw(); } }, 'Desfazer'),
      h('button.btn.small', { type: 'button', onclick: () => { strokes = []; draw(); } }, 'Limpar'),
      guideBtn),
    h('p.trace-tip', 'Regras gerais: de cima para baixo, da esquerda para a direita; horizontais antes de verticais; ' +
      'o traço que atravessa tudo costuma vir por último. Escreva cada caractere 5 vezes dizendo o som em voz alta.'));

  guideBtn.onclick = () => {
    showGuide = !showGuide;
    guideBtn.textContent = showGuide ? 'Ocultar modelo' : 'Mostrar modelo';
    draw();
  };

  function move(d) {
    i = (i + d + chars.length) % chars.length;
    show();
  }

  function show() {
    const c = chars[i];
    info.textContent = `${c}   ${describe(c)}   (${i + 1}/${chars.length})`;
    strokes = [];
    draw();
    Speech.speak(c);
  }

  let size = 300;
  function resize() {
    const wrap = canvas.parentElement;
    size = Math.max(200, Math.min(wrap.clientWidth, wrap.clientHeight || wrap.clientWidth));
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = canvas.style.height = size + 'px';
    canvas.width = canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

  function draw() {
    const c = chars[i];
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = css('--card');
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = css('--border');
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, size - 2, size - 2);
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = css('--trace-grid');
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, size / 2); ctx.lineTo(size, size / 2);
    ctx.moveTo(size / 2, 0); ctx.lineTo(size / 2, size);
    ctx.stroke();
    ctx.setLineDash([]);
    if (showGuide && c) {
      const px = (size * 0.66) / (c.length > 1 ? 1.7 : 1);
      ctx.fillStyle = css('--trace-guide');
      ctx.font = `${px}px "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", "Noto Sans JP", serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(c, size / 2, size / 2 + px * 0.04);
    }
    ctx.strokeStyle = ctx.fillStyle = css('--ink');
    ctx.lineWidth = Math.max(6, size / 34);
    ctx.lineCap = ctx.lineJoin = 'round';
    for (const s of strokes) {
      if (s.length === 1) {
        ctx.beginPath(); ctx.arc(s[0][0], s[0][1], ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill();
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(s[0][0], s[0][1]);
      for (let k = 1; k < s.length; k++) ctx.lineTo(s[k][0], s[k][1]);
      ctx.stroke();
    }
  }

  const point = (e) => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    current = [point(e)];
    strokes.push(current);
    draw();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!current) return;
    current.push(point(e));
    draw();
  });
  const end = () => { current = null; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  document.body.append(overlay);
  history.pushState({ trace: true }, '');
  const onPop = () => { window.removeEventListener('popstate', onPop); if (overlay.isConnected) { history.replaceState(null, ''); overlay.remove(); } };
  window.addEventListener('popstate', onPop);
  window.addEventListener('resize', resize);
  setTimeout(() => { resize(); show(); }, 0);
}
