// Carrega o conteúdo do curso da pasta Content/ (a mesma usada pelo app desktop).
import * as Kana from './kana.js';
import { Store } from './store.js';

// Na web não dá para listar a pasta: novos arquivos precisam entrar aqui (e no sw.js).
export const CONTENT_BASE = '../Content/';
export const COURSE_FILES = [
  'curso_0_fundamentos.json',
  'curso_1_primeiros_passos.json',
  'curso_2_basico.json',
  'curso_3_pre_intermediario.json',
  'curso_4_intermediario.json',
  'curso_5_avancado.json',
  'curso_6_vida_no_japao.json',
  'curso_7_leitura_escuta.json',
];
export const KANJI_FILES = ['kanji.txt', 'kanji_n3.txt'];
export const VOCAB_FILES = ['vocab_n4.txt', 'vocab_n5.txt'];
export const OTHER_FILES = ['frases.json', 'dicas.txt'];
export const ALL_FILES = [...COURSE_FILES, ...KANJI_FILES, ...VOCAB_FILES, ...OTHER_FILES];

export class VocabItem {
  constructor(jp, readingRaw, meaning, source) {
    this.jp = jp;
    this.readingRaw = readingRaw || '';
    this.meaning = meaning;
    this.source = source;
  }
  get reading() { return this.readingRaw.trim() ? this.readingRaw : this.jp; }
  get romaji() { return Kana.toRomaji(this.reading); }
  get key() { return 'v:' + this.jp + '|' + this.reading; }
  get hasKanji() { return Kana.containsKanji(this.jp); }
}

const levelOrder = (l) => ({ N5: 0, N4: 1, N3: 2, N2: 3 }[l] ?? 9);

export const Content = {
  modules: [],
  kanji: [],
  decks: [],
  phrases: [],
  tips: [],
  errors: [],

  async load() {
    this.errors = [];
    const fetchText = async (name) => {
      const r = await fetch(CONTENT_BASE + name);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return (await r.text()).replace(/^﻿/, '');
    };
    const results = await Promise.all(ALL_FILES.map(async (f) => {
      try { return [f, await fetchText(f)]; } catch (e) { this.errors.push(`${f}: ${e.message}`); return [f, null]; }
    }));
    const files = Object.fromEntries(results);

    // ---- módulos
    this.modules = [];
    for (const f of COURSE_FILES) {
      if (files[f] == null) continue;
      try {
        const mod = parseJson(files[f]);
        mod.lessons = mod.lessons || [];
        mod.lessons.forEach((l, i) => {
          l.module = mod;
          l.index = i;
          l.theory = l.theory || [];
          l.vocab = l.vocab || [];
          l.examples = l.examples || [];
          l.dialog = l.dialog || [];
          l.exercises = l.exercises || [];
          l.text = l.text || [];
        });
        this.modules.push(mod);
      } catch (e) {
        this.errors.push(`${f}: ${e.message}`);
      }
    }
    this.modules.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    // ---- kanji
    this.kanji = [];
    const counters = {};
    for (const f of KANJI_FILES) if (files[f] != null) this._loadKanji(f, files[f], counters);

    // ---- decks
    this.decks = [];
    for (const f of [...VOCAB_FILES].sort()) if (files[f] != null) this._loadDecks(f, files[f]);
    this.decks = this.decks
      .map((d, i) => [d, i])
      .sort((a, b) => levelOrder(a[0].level) - levelOrder(b[0].level) || a[1] - b[1])
      .map((x) => x[0]);

    // ---- frases
    this.phrases = [];
    if (files['frases.json'] != null) {
      try {
        this.phrases = parseJson(files['frases.json']).map((c) => ({
          name: c.name || '',
          icon: c.icon || '話',
          phrases: c.phrases || [],
          get items() { return this.phrases.filter((p) => p.length >= 3).map((p) => new VocabItem(p[0], p[1], p[2], 'frases:' + this.name)); },
        }));
      } catch (e) {
        this.errors.push('frases.json: ' + e.message);
      }
    }

    // ---- dicas
    this.tips = files['dicas.txt'] != null
      ? files['dicas.txt'].split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('//'))
      : ['Estude um pouco todos os dias: 15 minutos diários valem mais que 3 horas no domingo.'];
  },

  _loadKanji(file, text, counters) {
    let level = 'N5';
    text.split(/\r?\n/).forEach((raw, idx) => {
      const line = raw.trim();
      if (!line || line.startsWith('//')) return;
      if (line.startsWith('#')) { level = line.replace(/^#+/, '').trim(); return; }
      try {
        const p = line.split('|');
        const k = {
          char: p[0].trim(),
          level,
          on: (p[1] || '').trim(),
          kun: (p[2] || '').trim(),
          meaning: (p[3] || '').trim(),
          words: [],
          group: 0,
        };
        if (p.length > 4) {
          for (const w of p[4].split(';').filter((x) => x)) {
            const wp = w.split(':');
            if (wp.length >= 3) k.words.push(new VocabItem(wp[0].trim(), wp[1].trim(), wp[2].trim(), 'kanji:' + k.char));
          }
        }
        const n = counters[level] || 0;
        k.group = Math.floor(n / 10);
        counters[level] = n + 1;
        this.kanji.push(k);
      } catch (e) {
        this.errors.push(`${file} linha ${idx + 1}: ${e.message}`);
      }
    });
  },

  _loadDecks(file, text) {
    let deck = null;
    text.split(/\r?\n/).forEach((raw, idx) => {
      const line = raw.trim();
      if (!line || line.startsWith('//')) return;
      if (line.startsWith('#')) {
        const h = line.replace(/^#+/, '').split('|').map((s) => s.trim());
        deck = { name: h[0], icon: h[1] || '語', level: h[2] || '', items: [] };
        deck.key = deck.level + ':' + deck.name;
        this.decks.push(deck);
        return;
      }
      const p = line.split('|');
      if (!deck || p.length < 3) {
        this.errors.push(`${file} linha ${idx + 1}: formato inválido`);
        return;
      }
      deck.items.push(new VocabItem(p[0].trim(), p[1].trim(), p[2].trim(), 'deck:' + deck.name));
    });
  },

  get allLessons() { return this.modules.flatMap((m) => m.lessons); },
  get allVocab() { return this.allLessons.flatMap(vocabItems); },
  findLesson(id) { return this.allLessons.find((l) => l.id === id); },
  nextRecommended() { return this.allLessons.find((l) => !Store.isCompleted(l.id)); },
  nextLesson(l) {
    const all = this.allLessons;
    const i = all.indexOf(l);
    return i >= 0 && i + 1 < all.length ? all[i + 1] : null;
  },
  phraseItems() { return this.phrases.flatMap((c) => c.items); },
};

export const vocabItems = (lesson) => lesson.vocab.filter((v) => v.length >= 3).map((v) => new VocabItem(v[0], v[1], v[2], lesson.id));

/** JSON tolerante como o do desktop: aceita comentários // e vírgulas sobrando. */
function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    let out = '';
    let inStr = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inStr) {
        out += c;
        if (c === '\\') { out += text[++i] ?? ''; continue; }
        if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') { inStr = true; out += c; continue; }
      if (c === '/' && text[i + 1] === '/') { while (i < text.length && text[i] !== '\n') i++; out += '\n'; continue; }
      if (c === '/' && text[i + 1] === '*') { i = text.indexOf('*/', i + 2); if (i < 0) break; i++; continue; }
      out += c;
    }
    return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
  }
}
