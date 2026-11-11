// Furigana: põe a leitura pequena em cima de cada kanji (<ruby>), como nos livros japoneses.
// O conteúdo traz a frase e a leitura inteira em kana ("日本語を話します" / "にほんごを はなします");
// aqui as partes em kana servem de âncora para descobrir a leitura de cada trecho de kanji.
import * as Kana from './kana.js';
import { Store } from './store.js';

// Ajustes → "Esconder a furigana dos kanji que você já domina": kanji maduros na revisão (caixa 5+, 14+ dias)
let known = null;
Store.onChange(() => { known = null; });
export function hideReading(text) {
  if (!Store.settings.HideKnownFurigana) return false;
  known ??= new Set(Object.values(Store.data.Srs).filter((s) => s.Kind === 'kanji' && s.Box >= 5).map((s) => s.Front));
  const kanji = [...text].filter(Kana.isKanji);
  return kanji.length > 0 && kanji.every((c) => known.has(c));
}

const isLatin = (c) => /[A-Za-z0-9Ａ-Ｚａ-ｚ０-９]/.test(c);
const needsReading = (c) => Kana.isKanji(c) || c === 'ヶ' || c === '〆' || isLatin(c);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const noSpace = (s) => s.replace(/[\s　]/g, '');

/** Divide a frase em trechos [{ text, reading }] (reading = null onde não precisa). null se não der para alinhar. */
export function alignFurigana(jp, reading) {
  if (!jp || !reading) return null;
  const orig = noSpace(reading);
  const target = Kana.toHiragana(orig); // mesmo tamanho que orig: dá para recortar a leitura original (katakana em "Suica")
  // trechos: k = kanji/número/latim (precisa de leitura), a = kana (âncora), o = outros (pontuação, espaço)
  const chars = [...jp];
  const runs = [];
  chars.forEach((c, i) => {
    let kind = needsReading(c) ? 'k' : Kana.isKana(c) ? 'a' : 'o';
    // "Wi-Fi", "U.S.": hífen/ponto entre letras faz parte da palavra
    if (kind === 'o' && /[-.・]/.test(c) && isLatin(chars[i - 1] || '') && isLatin(chars[i + 1] || '')) kind = 'k';
    const last = runs[runs.length - 1];
    if (last && last.kind === kind) last.text += c;
    else runs.push({ kind, text: c });
  });
  if (!runs.some((r) => r.kind === 'k')) return null;
  const pattern = runs.map((r) => {
    if (r.kind === 'k') return '([^、。，．！？!?,.「」『』（）()]+?)'; // leitura de kanji nunca tem pontuação
    if (r.kind === 'a') return escapeRe(Kana.toHiragana(noSpace(r.text)));
    const t = noSpace(r.text);
    return t ? `(?:${escapeRe(t)})?` : '';
  }).join('');
  let m;
  try { m = new RegExp(`^${pattern}$`, 'du').exec(target); } catch { m = null; }
  if (!m) return null;
  const sameLength = orig.length === target.length;
  let g = 1;
  return runs.map((r) => {
    if (r.kind !== 'k') return { text: r.text, reading: null };
    const idx = m.indices?.[g];
    let rd = m[g++];
    if (idx && sameLength && /[A-Za-zＡ-Ｚａ-ｚ]/.test(r.text)) rd = orig.slice(idx[0], idx[1]);
    return { text: r.text, reading: Kana.toHiragana(rd) === Kana.toHiragana(r.text) ? null : rd };
  });
}

/**
 * Elementos prontos para pôr dentro de um nó: <ruby>漢字<rt>かんじ</rt></ruby> + texto.
 * Se não der para alinhar, a leitura vai inteira em cima da palavra (só em textos curtos); senão devolve null.
 */
export function furiganaNodes(jp, reading) {
  const parts = alignFurigana(jp, reading);
  const ruby = (text, rt) => {
    const r = document.createElement('ruby');
    r.append(text);
    const t = document.createElement('rt');
    t.textContent = rt;
    r.append(t);
    return r;
  };
  if (!parts) {
    if (!Kana.containsKanji(jp) || !reading || [...jp].length > 6) return null;
    return [ruby(jp, noSpace(reading))];
  }
  return parts.map((p) => (p.reading && !hideReading(p.text) ? ruby(p.text, p.reading) : p.text));
}
