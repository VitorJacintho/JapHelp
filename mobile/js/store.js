// Progresso do aluno, salvo no aparelho (localStorage).
// Usa o mesmo formato do progress.json do desktop, para dar para importar/exportar entre os dois.

const KEY = 'japhelp.progress.v1';
export const Intervals = [0, 1, 2, 4, 7, 14, 30, 60, 120, 240];

const DEFAULT_SETTINGS = () => ({
  ShowRomaji: true,
  ShowReading: true,
  SpeechRate: -1,
  SpeechSpeed: 0.9,
  VoiceId: null,
  WebVoice: null,
  DailyGoalXp: 60,
  AutoPlayAudio: true,
  MaxReviewsPerSession: 40,
  JpTextScale: 1, // só no celular: tamanho do texto em japonês
  TapToDefine: true, // só no celular: tocar na palavra mostra o significado
});

const EMPTY = () => ({
  Lessons: {},
  Srs: {},
  DailyXp: {},
  Mistakes: {},
  KanjiGroupsDone: [],
  SpeakingBest: {},
  VocabDecksDone: [],
  Xp: 0,
  Streak: 0,
  BestStreak: 0,
  LastStudyDate: '0001-01-01T00:00:00',
  Settings: DEFAULT_SETTINGS(),
});

// ---------- datas no formato do .NET (hora local, sem fuso) ----------
const pad = (n, w = 2) => String(n).padStart(w, '0');
export function toIso(d) {
  return `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
export function parseDate(s) {
  if (!s) return new Date(0);
  const d = new Date(s);
  return isNaN(d) ? new Date(0) : d;
}
export function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const daysBetween = (a, b) => Math.round((startOfDay(a) - startOfDay(b)) / 86400000);
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const isDefaultDate = (d) => d.getFullYear() < 1900;

const listeners = new Set();

export const Store = {
  data: EMPTY(),

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = normalize(JSON.parse(raw));
    } catch {
      this.data = EMPTY();
    }
    this.checkStreakBroken();
  },

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* armazenamento cheio/bloqueado */ }
    listeners.forEach((f) => f());
  },

  onChange(f) { listeners.add(f); },

  reset() {
    const settings = this.data.Settings;
    this.data = EMPTY();
    this.data.Settings = settings;
    this.save();
  },

  exportJson() { return JSON.stringify(this.data, null, 2); },

  importJson(text) {
    const d = normalize(JSON.parse(text.replace(/^﻿/, '')));
    // mantém as preferências de voz deste aparelho
    d.Settings.WebVoice = this.data.Settings.WebVoice;
    this.data = d;
    this.checkStreakBroken();
    this.save();
  },

  get settings() { return this.data.Settings; },

  checkStreakBroken() {
    const last = parseDate(this.data.LastStudyDate);
    if (isDefaultDate(last)) return;
    if (daysBetween(today(), last) > 1) this.data.Streak = 0;
  },

  get todayXp() { return this.data.DailyXp[dayKey(today())] || 0; },

  addXp(amount) {
    if (amount <= 0) return;
    const d = this.data;
    d.Xp += amount;
    d.DailyXp[dayKey(today())] = this.todayXp + amount;
    const last = parseDate(d.LastStudyDate);
    if (isDefaultDate(last) || daysBetween(today(), last) !== 0) {
      d.Streak = !isDefaultDate(last) && daysBetween(today(), last) === 1 ? d.Streak + 1 : 1;
      d.BestStreak = Math.max(d.BestStreak, d.Streak);
      d.LastStudyDate = toIso(today());
    }
  },

  getLesson(id) {
    let lp = this.data.Lessons[id];
    if (!lp) {
      lp = { Completed: false, BestScore: 0, Attempts: 0, TheoryRead: false, LastDate: '0001-01-01T00:00:00' };
      this.data.Lessons[id] = lp;
    }
    return lp;
  },

  isCompleted(id) { return !!this.data.Lessons[id]?.Completed; },

  recordMistake(key) {
    if (!key) return;
    this.data.Mistakes[key] = (this.data.Mistakes[key] || 0) + 1;
  },

  recordHit(key) {
    if (!key) return;
    const n = this.data.Mistakes[key];
    if (n === undefined) return;
    if (n <= 1) delete this.data.Mistakes[key];
    else this.data.Mistakes[key] = n - 1;
  },

  // ---------- conjuntos (HashSet no desktop) ----------
  hasKanjiGroup(k) { return this.data.KanjiGroupsDone.includes(k); },
  addKanjiGroup(k) { if (this.hasKanjiGroup(k)) return false; this.data.KanjiGroupsDone.push(k); return true; },
  hasDeck(k) { return this.data.VocabDecksDone.includes(k); },
  addDeck(k) { if (this.hasDeck(k)) return false; this.data.VocabDecksDone.push(k); return true; },

  // ---------- SRS ----------
  addToSrs(v, kind = 'vocab') {
    if (this.data.Srs[v.key]) return;
    this.data.Srs[v.key] = {
      Key: v.key, Kind: kind, Front: v.jp, Reading: v.reading, Back: v.meaning, Extra: '',
      Box: 0, Due: toIso(today()), Reviews: 0, Lapses: 0,
    };
  },

  addKanjiToSrs(k) {
    const key = 'k:' + k.char;
    if (this.data.Srs[key]) return;
    this.data.Srs[key] = {
      Key: key, Kind: 'kanji', Front: k.char,
      Reading: [k.on, k.kun].filter((s) => s && s.trim()).join(' / '),
      Back: k.meaning,
      Extra: k.words.slice(0, 2).map((w) => `${w.jp}（${w.reading}）${w.meaning}`).join('   '),
      Box: 0, Due: toIso(today()), Reviews: 0, Lapses: 0,
    };
  },

  dueItems() {
    const now = new Date();
    return Object.values(this.data.Srs)
      .filter((s) => parseDate(s.Due) <= now)
      .sort((a, b) => parseDate(a.Due) - parseDate(b.Due) || a.Box - b.Box);
  },

  get dueCount() {
    const now = new Date();
    return Object.values(this.data.Srs).filter((s) => parseDate(s.Due) <= now).length;
  },

  /** grade: 0 = errei, 1 = difícil, 2 = bom, 3 = fácil */
  grade(item, grade) {
    item.Reviews++;
    if (grade === 0) {
      item.Lapses++;
      item.Box = Math.max(0, item.Box - 2);
      item.Due = toIso(new Date(Date.now() + 5 * 60000));
      return;
    }
    if (grade === 1) item.Box = Math.max(1, item.Box);
    else if (grade === 2) item.Box = Math.min(Intervals.length - 1, item.Box + 1);
    else item.Box = Math.min(Intervals.length - 1, item.Box + 2);
    let days = Intervals[item.Box];
    if (grade === 1) days = Math.max(1, Math.floor(days / 2));
    item.Due = toIso(addDays(today(), Math.max(1, days)));
  },
};

/** Completa campos que faltam (arquivos antigos ou vindos do desktop). */
function normalize(d) {
  const e = EMPTY();
  const out = { ...e, ...(d || {}) };
  out.Settings = { ...DEFAULT_SETTINGS(), ...(d?.Settings || {}) };
  for (const k of ['Lessons', 'Srs', 'DailyXp', 'Mistakes', 'SpeakingBest']) if (!out[k] || typeof out[k] !== 'object') out[k] = {};
  for (const k of ['KanjiGroupsDone', 'VocabDecksDone']) if (!Array.isArray(out[k])) out[k] = [];
  return out;
}
