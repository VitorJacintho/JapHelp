// Áudio: voz japonesa do celular (Web Speech), gravação da própria voz e reconhecimento de fala.
import { similarity, speechScore } from './speechmatch.js';
import { Store } from './store.js';

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
let voices = [];
let current = null;
const finishedListeners = new Set();

function refreshVoices() {
  if (!synth) return;
  voices = synth.getVoices();
  pickVoice(Store.settings.WebVoice);
}

const isJa = (v) => /^ja([-_]|$)/i.test(v.lang);

function pickVoice(preferred) {
  const ja = voices.filter(isJa);
  current = ja.find((v) => v.voiceURI === preferred)
    || ja.find((v) => /google/i.test(v.name))
    || ja.find((v) => /kyoko|o-ren|otoya|nanami|haruka|ayumi/i.test(v.name))
    || ja[0]
    || null;
}

const clean = (t) => (t || '').replaceAll('〜', '').replaceAll('～', '').replace(/_{2,}/g, '、').replaceAll('〇〇', 'なになに').trim();

export const Speech = {
  init() {
    if (!synth) return;
    refreshVoices();
    synth.addEventListener?.('voiceschanged', refreshVoices);
  },

  /** Há sintetizador. Mesmo sem voz japonesa listada, o sistema costuma ter uma para ja-JP. */
  get available() { return !!synth; },
  get hasJapaneseVoice() { return voices.some(isJa); },
  get japaneseVoices() { return voices.filter(isJa); },
  get allVoices() { return voices; },
  get voiceName() { return current ? current.name : '(padrão do sistema)'; },
  get currentVoiceUri() { return current?.voiceURI ?? null; },

  selectVoice(uri) {
    pickVoice(uri);
    Store.settings.WebVoice = current?.voiceURI ?? null;
    Store.save();
  },

  get speed() { return Math.min(1.5, Math.max(0.5, Store.settings.SpeechSpeed || 0.9)); },

  utter(text, slow) {
    const u = new SpeechSynthesisUtterance(clean(text));
    u.lang = current?.lang?.replace('_', '-') || 'ja-JP';
    if (current) u.voice = current;
    u.rate = this.speed * (slow ? 0.6 : 1);
    return u;
  },

  speak(text, slow = false) {
    if (!synth || !clean(text)) return;
    synth.cancel();
    const u = this.utter(text, slow);
    u.onend = u.onerror = () => finishedListeners.forEach((f) => f());
    synth.speak(u);
  },

  speakQueue(lines) {
    if (!synth) return;
    synth.cancel();
    for (const l of lines) if (clean(l)) synth.speak(this.utter(l, false));
  },

  speakAndWait(text, slow = false) {
    return new Promise((resolve) => {
      if (!synth || !clean(text)) return resolve();
      synth.cancel();
      const u = this.utter(text, slow);
      const timer = setTimeout(resolve, 15000);
      u.onend = u.onerror = () => { clearTimeout(timer); resolve(); };
      synth.speak(u);
    });
  },

  stop() { synth?.cancel(); },
};

// =================== treino de fala ===================
const Recognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

let recorder = null;
let recordedUrl = null;
let player = null;

export const Practice = {
  get canRecord() { return !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder); },
  get canRecognize() { return !!Recognition; },
  get isRecording() { return recorder?.state === 'recording'; },
  get hasRecording() { return !!recordedUrl; },

  async startRecording() {
    if (!this.canRecord) return 'Este navegador não permite gravar áudio.';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recordedUrl) URL.revokeObjectURL(recordedUrl);
        recordedUrl = URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
        recorder._done?.();
      };
      recorder.start();
      return '';
    } catch (e) {
      return e?.name === 'NotAllowedError'
        ? 'Sem permissão para usar o microfone. Libere o microfone para este site nas configurações do navegador.'
        : 'Não consegui abrir o microfone (' + (e?.message || e) + ').';
    }
  },

  stopRecording() {
    return new Promise((resolve) => {
      if (!recorder || recorder.state !== 'recording') return resolve();
      recorder._done = resolve;
      recorder.stop();
    });
  },

  playRecording() {
    return new Promise((resolve) => {
      if (!recordedUrl) return resolve();
      player?.pause();
      player = new Audio(recordedUrl);
      player.onended = player.onerror = () => resolve();
      player.play().catch(() => resolve());
    });
  },

  stopAll() {
    if (this.isRecording) recorder.stop();
    player?.pause();
  },

  /** Ouve o microfone e compara com a frase esperada. */
  recognize(expected, reading) {
    return new Promise((resolve) => {
      if (!Recognition) {
        resolve({ ok: false, heard: '', score: 0, message: 'Este navegador não tem reconhecimento de fala. No Android use o Chrome; no iPhone, o Safari.' });
        return;
      }
      const rec = new Recognition();
      rec.lang = 'ja-JP';
      rec.interimResults = false;
      rec.maxAlternatives = 5;
      rec.continuous = false;
      let done = false;
      const finish = (r) => { if (!done) { done = true; resolve(r); } };
      rec.onresult = (e) => {
        let best = { heard: '', score: 0 };
        const res = e.results[0];
        for (let i = 0; i < res.length; i++) {
          const heard = res[i].transcript || '';
          const score = speechScore(heard, expected, reading);
          if (score > best.score || !best.heard) best = { heard, score };
        }
        finish({ ok: best.heard.length > 0, heard: best.heard, score: best.score, message: best.heard ? '' : 'Não ouvi nada. Fale mais perto do microfone.' });
      };
      rec.onerror = (e) => finish({ ok: false, heard: '', score: 0, message: describeError(e.error) });
      rec.onend = () => finish({ ok: false, heard: '', score: 0, message: 'Não ouvi nada a tempo. Toque e fale logo em seguida.' });
      try { rec.start(); } catch (e) { finish({ ok: false, heard: '', score: 0, message: 'Erro no reconhecimento: ' + e.message }); }
    });
  },
};

function describeError(code) {
  return {
    'no-speech': 'Não ouvi nada a tempo. Toque e fale logo em seguida.',
    'audio-capture': 'Microfone indisponível.',
    'not-allowed': 'Sem permissão para usar o microfone/reconhecimento. Libere nas configurações do navegador.',
    'service-not-allowed': 'O reconhecimento de fala está bloqueado neste navegador.',
    network: 'Falha de rede: o reconhecimento de fala precisa de internet.',
    'language-not-supported': 'Reconhecimento em japonês não suportado neste aparelho.',
    aborted: 'Cancelado.',
  }[code] || 'Não foi possível reconhecer (' + code + ').';
}


export { similarity };
