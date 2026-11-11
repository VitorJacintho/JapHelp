// Ordem dos traços (dados do KanjiVG) e conferência do que o aluno desenhou.
// Coordenadas do KanjiVG: caixa de 109 x 109, cada traço é um caminho SVG na ordem certa.
// KanjiVG © Ulrich Apel — CC BY-SA 3.0 (https://kanjivg.tagaini.net).

export const BOX = 109;
const SAMPLES = 24;

let dataPromise = null;
/** Carrega data/tracos.json uma vez: { "日": ["M...", ...], ... }. */
export function loadStrokeData(url = new URL('../data/tracos.json', import.meta.url).href) {
  dataPromise ??= fetch(url).then((r) => {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).catch((e) => { dataPromise = null; throw e; });
  return dataPromise;
}

// ---------------------------------------------------------------- caminhos SVG → pontos
const TOKEN = /[MmLlHhVvCcSsQqTtZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;

/** Converte um caminho SVG (M, L, H, V, C, S, Q, T, Z) em pontos ao longo do traço, a cada ~step unidades. */
export function pathPoints(d, step = 1.5) {
  const tok = d.match(TOKEN) || [];
  const pts = [];
  let i = 0;
  let cmd = '';
  let x = 0, y = 0, sx = 0, sy = 0;
  let ctrl = null; // último ponto de controle (para S/T)
  const num = () => {
    const v = parseFloat(tok[i++]);
    if (Number.isNaN(v)) throw new Error('caminho inválido');
    return v;
  };
  const add = (px, py) => pts.push([px, py]);
  const line = (nx, ny) => {
    const n = Math.max(1, Math.ceil(Math.hypot(nx - x, ny - y) / step));
    for (let k = 1; k <= n; k++) add(x + ((nx - x) * k) / n, y + ((ny - y) * k) / n);
    x = nx; y = ny;
  };
  const cubic = (x1, y1, x2, y2, nx, ny) => {
    const len = Math.hypot(x1 - x, y1 - y) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(nx - x2, ny - y2);
    const n = Math.max(2, Math.ceil(len / step));
    for (let k = 1; k <= n; k++) {
      const t = k / n, u = 1 - t;
      add(u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * nx,
        u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * ny);
    }
    ctrl = [x2, y2];
    x = nx; y = ny;
  };
  const quad = (x1, y1, nx, ny) => {
    cubic(x + (2 / 3) * (x1 - x), y + (2 / 3) * (y1 - y), nx + (2 / 3) * (x1 - nx), ny + (2 / 3) * (y1 - ny), nx, ny);
    ctrl = [x1, y1];
  };
  while (i < tok.length) {
    if (/[a-zA-Z]/.test(tok[i])) cmd = tok[i++];
    const rel = cmd === cmd.toLowerCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    switch (cmd.toUpperCase()) {
      case 'M': {
        x = num() + ox; y = num() + oy; sx = x; sy = y;
        add(x, y);
        cmd = rel ? 'l' : 'L'; // pares seguintes são linhas
        ctrl = null;
        break;
      }
      case 'L': { const nx = num() + ox, ny = num() + oy; line(nx, ny); ctrl = null; break; }
      case 'H': { line(num() + ox, y); ctrl = null; break; }
      case 'V': { line(x, num() + oy); ctrl = null; break; }
      case 'C': {
        const x1 = num() + ox, y1 = num() + oy, x2 = num() + ox, y2 = num() + oy, nx = num() + ox, ny = num() + oy;
        cubic(x1, y1, x2, y2, nx, ny);
        break;
      }
      case 'S': {
        const [x1, y1] = ctrl ? [2 * x - ctrl[0], 2 * y - ctrl[1]] : [x, y];
        const x2 = num() + ox, y2 = num() + oy, nx = num() + ox, ny = num() + oy;
        cubic(x1, y1, x2, y2, nx, ny);
        break;
      }
      case 'Q': { const x1 = num() + ox, y1 = num() + oy; quad(x1, y1, num() + ox, num() + oy); break; }
      case 'T': {
        const [x1, y1] = ctrl ? [2 * x - ctrl[0], 2 * y - ctrl[1]] : [x, y];
        quad(x1, y1, num() + ox, num() + oy);
        break;
      }
      case 'Z': { line(sx, sy); ctrl = null; break; }
      default: i++; // token inesperado: pula
    }
  }
  return pts;
}

export const pathLength = (pts) => pts.reduce((s, p, k) => (k ? s + Math.hypot(p[0] - pts[k - 1][0], p[1] - pts[k - 1][1]) : 0), 0);

/** Reamostra a linha em n pontos igualmente espaçados (para comparar traços com quantidades de pontos diferentes). */
export function resample(pts, n = SAMPLES) {
  if (pts.length === 0) return [];
  if (pts.length === 1) return Array.from({ length: n }, () => [...pts[0]]);
  const total = pathLength(pts);
  if (total === 0) return Array.from({ length: n }, () => [...pts[0]]);
  const out = [[...pts[0]]];
  const step = total / (n - 1);
  let acc = 0;
  let k = 1;
  let prev = pts[0];
  while (out.length < n - 1 && k < pts.length) {
    const cur = pts[k];
    const seg = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
    if (acc + seg >= step && seg > 0) {
      const t = (step - acc) / seg;
      const p = [prev[0] + (cur[0] - prev[0]) * t, prev[1] + (cur[1] - prev[1]) * t];
      out.push(p);
      prev = p;
      acc = 0;
    } else {
      acc += seg;
      prev = cur;
      k++;
    }
  }
  while (out.length < n) out.push([...pts[pts.length - 1]]);
  return out;
}

// ---------------------------------------------------------------- conferência
function bbox(strokes) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of strokes) for (const [x, y] of s) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

const meanDist = (a, b) => a.reduce((s, p, k) => s + Math.hypot(p[0] - b[k][0], p[1] - b[k][1]), 0) / a.length;

/** Sentido do traço em palavras ("de cima para baixo", "da esquerda para a direita"...). */
export function directionText(pts) {
  const [a, b] = [pts[0], pts[pts.length - 1]];
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const parts = [];
  if (Math.abs(dy) > 8) parts.push(dy > 0 ? 'de cima para baixo' : 'de baixo para cima');
  if (Math.abs(dx) > 8) parts.push(dx > 0 ? 'da esquerda para a direita' : 'da direita para a esquerda');
  return parts.join(', ') || 'curto';
}

/**
 * Confere o desenho do aluno.
 * @param refPaths caminhos SVG do KanjiVG (na ordem certa)
 * @param userStrokes traços do aluno em coordenadas 0..109 (listas de [x, y])
 * @param opts.normalize ajusta posição/tamanho do desenho ao modelo (no modo de memória o aluno pode desenhar menor ou de lado)
 * @returns { ok, expected, drawn, results: [{ ok, issue, matches }], score }
 *   issue: null | 'direction' | 'order' | 'shape' | 'extra'
 */
export function checkDrawing(refPaths, userStrokes, { normalize = true, tolerance = 15 } = {}) {
  const ref = refPaths.map((d) => pathPoints(d));
  const refR = ref.map((p) => resample(p));
  let user = userStrokes.filter((s) => s.length > 0).map((s) => s.map((p) => [...p]));
  if (normalize && user.length) {
    const rb = bbox(ref);
    const ub = bbox(user);
    const rd = Math.max(rb.w, rb.h, 10);
    const ud = Math.max(ub.w, ub.h, 10);
    // escala limitada: desenho muito menor/maior que o modelo não vira "certo" só por ser ampliado
    const sc = Math.min(2.5, Math.max(0.4, rd / ud));
    user = user.map((s) => s.map(([x, y]) => [rb.cx + (x - ub.cx) * sc, rb.cy + (y - ub.cy) * sc]));
  }
  const userR = user.map((p) => resample(p));
  const refLen = ref.map(pathLength);

  const results = userR.map((u, i) => {
    if (i >= refR.length) return { ok: false, issue: 'extra', matches: -1 };
    const short = refLen[i] < 14; // pontinhos: o sentido não importa
    const fwd = meanDist(u, refR[i]);
    const rev = meanDist([...u].reverse(), refR[i]);
    const own = short ? Math.min(fwd, rev) : fwd;
    // o traço mais parecido com outro do modelo (para detectar ordem trocada)
    let best = -1;
    let bestD = Infinity;
    refR.forEach((r, j) => {
      if (j === i) return;
      const dd = Math.min(meanDist(u, r), refLen[j] < 14 ? meanDist([...u].reverse(), r) : Infinity);
      if (dd < bestD) { bestD = dd; best = j; }
    });
    // traços vizinhos e parecidos (部首 pequenos): só é "ordem trocada" se encaixa claramente melhor no outro
    const clearlyOther = bestD <= tolerance && own > 7 && bestD < own * 0.5;
    if (own <= tolerance && !clearlyOther) return { ok: true, issue: null, matches: i };
    if (rev <= tolerance && rev < bestD) return { ok: false, issue: 'direction', matches: i };
    if (bestD <= tolerance) return { ok: false, issue: 'order', matches: best };
    return { ok: false, issue: 'shape', matches: -1 };
  });
  const good = results.filter((r) => r.ok).length;
  return {
    ok: results.length === ref.length && good === ref.length,
    expected: ref.length,
    drawn: results.length,
    results,
    score: ref.length ? good / Math.max(ref.length, results.length) : 0,
    refPoints: ref,
  };
}
