// Prática de escrita com o dedo, em 3 níveis, conferindo a ordem e o sentido dos traços (dados do KanjiVG).
//   Fácil   — modelo com os números da ordem dos traços
//   Médio   — modelo apagado, sem números
//   Difícil — quadro vazio: escreva de memória
import * as Kana from './kana.js';
import { Speech } from './speech.js';
import { Store } from './store.js';
import { h, icons } from './ui.js';
import { BOX, loadStrokeData, checkDrawing, directionText } from './strokes.js';

const LEVELS = [
  ['easy', 'Fácil', 'Modelo com a ordem dos traços'],
  ['medium', 'Médio', 'Modelo sem números'],
  ['hard', 'Difícil', 'Quadro vazio: escreva de memória'],
];
const LEVEL_KEY = 'japhelp.trace.level';
const readLevel = () => { try { return localStorage.getItem(LEVEL_KEY) || 'easy'; } catch { return 'easy'; } };
const saveLevel = (v) => { try { localStorage.setItem(LEVEL_KEY, v); } catch { /* ignora */ } };

export function openTracing(units, index = 0, describe = null) {
  if (!units || units.length === 0) return;
  describe = describe || ((c) => (Kana.isAllKana(c) ? Kana.toRomaji(c) : ''));

  let level = LEVELS.some((l) => l[0] === readLevel()) ? readLevel() : 'easy';
  let data = null; // { "日": [caminhos] }
  let items = units.map((u) => ({ ch: u, label: describe(u) }));
  let i = Math.min(Math.max(index, 0), items.length - 1);
  let strokes = []; // traços do aluno, em unidades 0..109
  let current = null;
  let result = null; // resultado da conferência
  let hinted = false; // viu a animação antes de conferir (no difícil)
  let anim = null; // { stroke, t } durante a animação
  let showOrder = false; // números visíveis depois da animação, até o próximo traço

  const refOf = (it) => (data && data[it.ch]) || null;

  // ---------------------------------------------------------------- elementos
  const info = h('div.trace-info', { lang: 'ja' });
  const sub = h('div.trace-sub');
  const canvas = h('canvas.trace-canvas');
  const ctx = canvas.getContext('2d');
  const feedback = h('div.trace-feedback', { role: 'status', 'aria-live': 'polite' });
  const levelBar = h('div.segmented.trace-levels', LEVELS.map(([key, name]) =>
    h('button' + (key === level ? '.active' : ''), { type: 'button', 'data-level': key, onclick: () => setLevel(key) }, name)));
  const checkBtn = h('button.btn.small.primary', { type: 'button', onclick: () => verify() }, '✓ Conferir');
  const animBtn = h('button.btn.small', { type: 'button', onclick: () => animate() }, '▶ Ver ordem');

  const close = () => {
    window.removeEventListener('resize', resize);
    stopAnim();
    overlay.remove();
    if (history.state?.trace) history.back();
  };
  const overlay = h('div.trace-overlay',
    h('header.trace-top',
      h('button.icon-btn.ghost', { type: 'button', 'aria-label': 'Fechar', onclick: close }, icons.close),
      h('div.trace-title', 'Escrita — 書く練習')),
    levelBar,
    h('div.trace-head', info, sub),
    h('div.trace-canvas-wrap', canvas),
    feedback,
    h('div.btn-row.center.wrap.trace-actions',
      h('button.icon-btn', { type: 'button', 'aria-label': 'Anterior', onclick: () => move(-1) }, icons.back),
      h('button.icon-btn', { type: 'button', 'aria-label': 'Ouvir', onclick: () => Speech.speak(items[i].ch) }, icons.volume),
      h('button.icon-btn', { type: 'button', 'aria-label': 'Próximo', onclick: () => move(1) }, icons.next),
      h('button.btn.small', { type: 'button', onclick: undo }, 'Desfazer'),
      h('button.btn.small', { type: 'button', onclick: clear }, 'Limpar'),
      animBtn,
      checkBtn));

  // ---------------------------------------------------------------- navegação e estado
  function setLevel(key) {
    level = key;
    saveLevel(key);
    for (const b of levelBar.children) b.classList.toggle('active', b.dataset.level === key);
    clear();
  }

  function move(d) {
    i = (i + d + items.length) % items.length;
    show();
  }

  function show() {
    stopAnim();
    strokes = [];
    result = null;
    hinted = false;
    showOrder = false;
    const it = items[i];
    const ref = refOf(it);
    info.textContent = it.ch;
    const parts = [];
    if (it.label) parts.push(it.label);
    if (ref && level !== 'hard') parts.push(`${ref.length} ${ref.length === 1 ? 'traço' : 'traços'}`);
    parts.push(`${i + 1}/${items.length}`);
    sub.textContent = parts.join(' · ');
    if (level === 'hard' && it.label) {
      // de memória: mostra o som/significado, não o desenho
      info.textContent = it.label;
      sub.textContent = `Escreva o caractere de memória · ${i + 1}/${items.length}`;
    }
    checkBtn.hidden = !ref;
    animBtn.hidden = !ref;
    setFeedback(!ref ? 'Sem dados de ordem dos traços para este caractere: trace livremente por cima do modelo.'
      : level === 'easy' ? 'Siga os números: cada traço começa onde está o número.'
        : level === 'medium' ? 'Trace por cima do modelo na ordem certa. O app confere quando você terminar.'
          : 'Escreva de memória e toque em "Conferir".', 'neutral');
    draw();
    Speech.speak(it.ch); // no difícil o som ajuda a lembrar; o desenho continua escondido
  }

  /** Mostra o caractere no topo (no difícil ele fica escondido até conferir ou ver a ordem). */
  function revealTitle() {
    const it = items[i];
    if (level === 'hard') info.textContent = it.label ? `${it.ch}  ${it.label}` : it.ch;
  }

  function undo() {
    if (result) { result = null; }
    strokes.pop();
    draw();
  }

  function clear() {
    show();
  }

  function setFeedback(text, kind) {
    feedback.className = 'trace-feedback info info-' + kind;
    feedback.replaceChildren(...text.split('\n').flatMap((l, k) => (k ? [h('br'), l] : [l])));
  }

  // ---------------------------------------------------------------- conferência
  function verify() {
    const ref = refOf(items[i]);
    if (!ref) return;
    if (strokes.length === 0) { setFeedback('Desenhe primeiro. ✍️', 'warn'); return; }
    result = checkDrawing(ref, strokes, { normalize: true });
    revealTitle();
    const lines = [];
    if (result.ok) {
      lines.push(level === 'hard' && !hinted ? 'Perfeito, de memória! すばらしい！' : 'Certo! Ordem e sentido dos traços corretos. 👏');
      if (level !== 'easy' && !hinted) Store.addXp(1);
    } else {
      const okCount = result.results.filter((r) => r.ok).length;
      lines.push(`${okCount} de ${result.expected} traços certos.`);
      if (result.drawn !== result.expected) lines.push(`Você fez ${result.drawn} ${result.drawn === 1 ? 'traço' : 'traços'}; o certo são ${result.expected}.`);
      result.results.forEach((r, k) => {
        if (r.ok || lines.length > 5) return;
        const n = k + 1;
        if (r.issue === 'direction') lines.push(`Traço ${n}: sentido invertido — este vai ${directionText(result.refPoints[k])}.`);
        else if (r.issue === 'order') lines.push(`Traço ${n}: ordem trocada — esse é o traço nº ${r.matches + 1}.`);
        else if (r.issue === 'shape') lines.push(`Traço ${n}: forma ou posição diferente do modelo.`);
      });
      lines.push('Os números no quadro mostram a ordem certa. Toque em "Limpar" e tente de novo.');
    }
    setFeedback(lines.join('\n'), result.ok ? 'success' : 'warn');
    draw();
  }

  // ---------------------------------------------------------------- animação da ordem
  function animate() {
    const ref = refOf(items[i]);
    if (!ref) return;
    stopAnim();
    if (level === 'hard' && !result) hinted = true;
    revealTitle();
    strokes = [];
    result = null;
    const { pts } = geometryOf(items[i].ch, ref);
    setFeedback(level === 'hard' ? 'Dica: veja a ordem e o sentido dos traços. Quando você começar a escrever, o modelo some.'
      : 'Observe a ordem e o sentido de cada traço. Depois é a sua vez.', 'indigo');
    anim = { stroke: 0, t: 0, pts };
    const tick = () => {
      if (!anim) return;
      anim.t += 0.04;
      if (anim.t >= 1) { anim.stroke++; anim.t = 0; }
      if (anim.stroke >= pts.length) { anim = null; showOrder = true; draw(); return; }
      draw();
      anim.timer = setTimeout(tick, 16);
    };
    tick();
  }
  function stopAnim() {
    if (anim?.timer) clearTimeout(anim.timer);
    anim = null;
  }

  // ---------------------------------------------------------------- desenho
  let size = 300;
  function resize() {
    const wrap = canvas.parentElement;
    size = Math.max(180, Math.min(wrap.clientWidth, wrap.clientHeight || wrap.clientWidth));
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = canvas.style.height = size + 'px';
    canvas.width = canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  function strokePath(points, color, width, upto = 1) {
    if (!points.length) return;
    const n = Math.max(1, Math.round(points.length * upto));
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = ctx.lineJoin = 'round';
    if (n === 1) { ctx.beginPath(); ctx.arc(points[0][0], points[0][1], width / 2, 0, Math.PI * 2); ctx.fill(); return; }
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let k = 1; k < n; k++) ctx.lineTo(points[k][0], points[k][1]);
    ctx.stroke();
  }

  // pontos do modelo e posição dos números, calculados uma vez por caractere
  const geometry = new Map();
  function geometryOf(ch, ref) {
    if (geometry.has(ch)) return geometry.get(ch);
    const pts = checkDrawing(ref, []).refPoints;
    const r = 4.8;
    const placed = [];
    for (const p of pts) {
      // o número fica logo antes do começo do traço, no sentido contrário ao do traço
      const a = p[0];
      const b = p[Math.min(4, p.length - 1)];
      let vx = b[0] - a[0], vy = b[1] - a[1];
      const len = Math.hypot(vx, vy) || 1;
      vx /= len; vy /= len;
      if (vx === 0 && vy === 0) vy = 1;
      let best = null;
      for (const side of [0, 1, -1, 2, -2, 3, -3]) {
        const x = Math.min(BOX - r - 1, Math.max(r + 1, a[0] - vx * 6.5 - vy * side * 7));
        const y = Math.min(BOX - r - 1, Math.max(r + 1, a[1] - vy * 6.5 + vx * side * 7));
        const clash = placed.some((q) => Math.hypot(q[0] - x, q[1] - y) < 2 * r + 0.8);
        if (!clash) { best = [x, y]; break; }
        best ??= [x, y];
      }
      placed.push(best);
    }
    const g = { pts, numbers: placed };
    geometry.set(ch, g);
    return g;
  }

  function number(n, at, color, bg) {
    const r = 4.6;
    const [x, y] = at;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.fillStyle = color;
    ctx.font = `700 ${n >= 10 ? 5 : 6}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(n), x, y + 0.3);
  }

  function draw() {
    const it = items[i];
    const ref = refOf(it);
    const s = size / BOX;
    ctx.save();
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
    ctx.scale(s, s); // daqui em diante: unidades do KanjiVG (0..109)

    const guide = css('--trace-guide');
    const accent = css('--accent');
    const reveal = !!result || !!anim || showOrder; // depois de conferir (ou na animação), mostra o modelo em qualquer nível
    const geo = ref ? geometryOf(it.ch, ref) : null;
    if (ref) {
      if (level !== 'hard' || reveal) {
        ref.forEach((d) => {
          ctx.strokeStyle = guide;
          ctx.lineWidth = 4.2;
          ctx.lineCap = ctx.lineJoin = 'round';
          ctx.stroke(new Path2D(d));
        });
      }
      if (anim) {
        for (let k = 0; k < anim.stroke; k++) strokePath(geo.pts[k], accent, 4.2);
        if (anim.stroke < geo.pts.length) strokePath(geo.pts[anim.stroke], accent, 4.2, anim.t);
      }
    } else if (it.ch && level !== 'hard') {
      // sem dados: modelo pela fonte, como antes
      const px = (BOX * 0.66) / ([...it.ch].length > 1 ? 1.7 : 1);
      ctx.fillStyle = guide;
      ctx.font = `${px}px "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", "Noto Sans JP", serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(it.ch, BOX / 2, BOX / 2 + px * 0.04);
    }

    // traços do aluno (verde = certo, vermelho = errado depois de conferir)
    const ink = css('--ink');
    const width = Math.max(3.2, 6 / s);
    strokes.forEach((st, k) => {
      let color = ink;
      if (result) color = result.results[k]?.ok ? css('--success') : css('--error');
      strokePath(st, color, width);
    });

    // números por cima de tudo
    if (geo && anim) {
      for (let k = 0; k <= Math.min(anim.stroke, geo.pts.length - 1); k++) number(k + 1, geo.numbers[k], '#fff', accent);
    } else if (geo && (level === 'easy' || result || showOrder)) {
      geo.numbers.forEach((at, k) => number(k + 1, at, '#fff', result ? css('--indigo') : accent));
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- entrada pelo dedo
  const point = (e) => {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * BOX, ((e.clientY - r.top) / r.height) * BOX];
  };
  canvas.addEventListener('pointerdown', (e) => {
    showOrder = false;
    stopAnim();
    if (result) { // nova tentativa depois de conferir
      strokes = [];
      result = null;
    }
    canvas.setPointerCapture(e.pointerId);
    current = [point(e)];
    strokes.push(current);
    draw();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!current) return;
    const p = point(e);
    const last = current[current.length - 1];
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.6) return;
    current.push(p);
    draw();
  });
  const end = () => {
    if (!current) return;
    current = null;
    // nos níveis com modelo, confere sozinho quando a quantidade de traços fecha
    const ref = refOf(items[i]);
    if (ref && level !== 'hard' && strokes.length === ref.length) verify();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  // ---------------------------------------------------------------- abrir
  document.body.append(overlay);
  history.pushState({ trace: true }, '');
  const onPop = () => {
    window.removeEventListener('popstate', onPop);
    if (overlay.isConnected) { stopAnim(); history.replaceState(null, ''); overlay.remove(); }
  };
  window.addEventListener('popstate', onPop);
  window.addEventListener('resize', resize);
  setFeedback('Carregando a ordem dos traços…', 'neutral');
  setTimeout(resize, 0);

  loadStrokeData().then((d) => {
    data = d;
    // "きゃ" vira "き" e "ゃ": cada caractere tem a sua ordem de traços
    const expanded = [];
    let newIndex = 0;
    units.forEach((u, k) => {
      const chars = [...u];
      if (k === index) newIndex = expanded.length;
      if (chars.length > 1 && chars.every((c) => d[c])) chars.forEach((c) => expanded.push({ ch: c, label: describe(c) }));
      else expanded.push({ ch: u, label: describe(u) });
    });
    items = expanded;
    i = Math.min(newIndex, items.length - 1);
  }).catch(() => { /* sem dados (offline na primeira vez): traçado livre */ })
    .finally(() => { resize(); show(); });
}
