// Quadro de escrita com o dedo: desenha o modelo (KanjiVG), recebe os traços, confere e anima a ordem.
// Usado pela tela de escrita (trace.js) e pelos cartões de escrita da revisão (SRS).
//   níveis: 'easy' (modelo + números), 'medium' (modelo sem números), 'hard' (quadro vazio)
import { h } from './ui.js';
import { BOX, checkDrawing, directionText } from './strokes.js';

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

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

/** Texto explicando o resultado da conferência. */
export function describeResult(result, { fromMemory = false } = {}) {
  if (result.ok) {
    return { kind: 'success', text: fromMemory ? 'Perfeito, de memória! すばらしい！' : 'Certo! Ordem e sentido dos traços corretos. 👏' };
  }
  const lines = [];
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
  lines.push('Os números no quadro mostram a ordem certa.');
  return { kind: 'warn', text: lines.join('\n') };
}

/**
 * Cria um quadro. onStrokeEnd(board) é chamado ao terminar cada traço.
 * O quadro se ajusta ao tamanho do elemento pai (chame resize() quando ele mudar).
 */
export function createBoard({ level = 'easy', onStrokeEnd = null } = {}) {
  const canvas = h('canvas.trace-canvas');
  const ctx = canvas.getContext('2d');
  const st = {
    ch: '',
    ref: null, // caminhos do KanjiVG ou null (sem dados: modelo pela fonte, sem conferência)
    level,
    strokes: [], // traços do aluno, em unidades 0..109
    current: null,
    result: null,
    anim: null,
    showOrder: false, // números visíveis depois da animação, até o próximo traço
    size: 300,
  };

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
    const { size, ref, anim, result } = st;
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
    const reveal = !!result || !!anim || st.showOrder; // depois de conferir (ou na animação), mostra o modelo em qualquer nível
    const geo = ref ? geometryOf(st.ch, ref) : null;
    if (ref) {
      if (st.level !== 'hard' || reveal) {
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
    } else if (st.ch && st.level !== 'hard') {
      // sem dados: modelo pela fonte
      const px = (BOX * 0.66) / ([...st.ch].length > 1 ? 1.7 : 1);
      ctx.fillStyle = guide;
      ctx.font = `${px}px "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", "Noto Sans JP", serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(st.ch, BOX / 2, BOX / 2 + px * 0.04);
    }

    // traços do aluno (verde = certo, vermelho = errado depois de conferir)
    const ink = css('--ink');
    const width = Math.max(3.2, 6 / s);
    st.strokes.forEach((line, k) => {
      let color = ink;
      if (result) color = result.results[k]?.ok ? css('--success') : css('--error');
      strokePath(line, color, width);
    });

    // números por cima de tudo
    if (geo && anim) {
      for (let k = 0; k <= Math.min(anim.stroke, geo.pts.length - 1); k++) number(k + 1, geo.numbers[k], '#fff', accent);
    } else if (geo && (st.level === 'easy' || result || st.showOrder)) {
      geo.numbers.forEach((at, k) => number(k + 1, at, '#fff', result ? css('--indigo') : accent));
    }
    ctx.restore();
  }

  function stopAnim() {
    if (st.anim?.timer) clearTimeout(st.anim.timer);
    st.anim = null;
  }

  // ---------------------------------------------------------------- entrada pelo dedo
  const point = (e) => {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * BOX, ((e.clientY - r.top) / r.height) * BOX];
  };
  canvas.addEventListener('pointerdown', (e) => {
    st.showOrder = false;
    stopAnim();
    if (st.result) { st.strokes = []; st.result = null; } // nova tentativa depois de conferir
    canvas.setPointerCapture?.(e.pointerId);
    st.current = [point(e)];
    st.strokes.push(st.current);
    draw();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!st.current) return;
    const p = point(e);
    const last = st.current[st.current.length - 1];
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.6) return;
    st.current.push(p);
    draw();
  });
  const end = () => {
    if (!st.current) return;
    st.current = null;
    onStrokeEnd?.(board);
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  const board = {
    el: canvas,
    get ch() { return st.ch; },
    get ref() { return st.ref; },
    get level() { return st.level; },
    get strokeCount() { return st.strokes.length; },
    get result() { return st.result; },
    get animating() { return !!st.anim; },

    /** Troca o caractere (ref = caminhos do KanjiVG, ou null) e limpa o quadro. */
    setChar(ch, ref) {
      stopAnim();
      st.ch = ch;
      st.ref = ref || null;
      st.strokes = [];
      st.result = null;
      st.showOrder = false;
      draw();
    },
    setLevel(lv) { st.level = lv; this.clear(); },
    clear() { stopAnim(); st.strokes = []; st.result = null; st.showOrder = false; draw(); },
    undo() { st.result = null; st.strokes.pop(); draw(); },

    /** Confere o desenho. Devolve o resultado (ou null sem dados/sem traços). */
    check() {
      if (!st.ref || st.strokes.length === 0) return null;
      st.result = checkDrawing(st.ref, st.strokes, { normalize: true });
      draw();
      return st.result;
    },

    /** Anima a ordem dos traços; onDone ao terminar. */
    animate(onDone) {
      if (!st.ref) return;
      stopAnim();
      st.strokes = [];
      st.result = null;
      const { pts } = geometryOf(st.ch, st.ref);
      st.anim = { stroke: 0, t: 0 };
      const tick = () => {
        if (!st.anim) return;
        st.anim.t += 0.04;
        if (st.anim.t >= 1) { st.anim.stroke++; st.anim.t = 0; }
        if (st.anim.stroke >= pts.length) { st.anim = null; st.showOrder = true; draw(); onDone?.(); return; }
        draw();
        st.anim.timer = setTimeout(tick, 16);
      };
      tick();
    },

    /** Ajusta o quadro ao espaço do elemento pai (ou ao tamanho dado). */
    resize(fixed) {
      const wrap = canvas.parentElement;
      const size = fixed || (wrap ? Math.min(wrap.clientWidth, wrap.clientHeight || wrap.clientWidth) : 300);
      st.size = Math.max(160, size);
      const dpr = window.devicePixelRatio || 1;
      canvas.style.width = canvas.style.height = st.size + 'px';
      canvas.width = canvas.height = Math.round(st.size * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    },

    destroy() { stopAnim(); },
  };
  return board;
}
