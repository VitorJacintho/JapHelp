// Proteção do progresso: pede armazenamento persistente, lembra de fazer backup e exporta pelo
// menu de compartilhar do celular (Drive, WhatsApp, e-mail...) ou baixando o arquivo.
import { Store, toIso } from './store.js';

const KEY = 'japhelp.backup.v1'; // dados deste aparelho, fora do progress.json
const DAY = 86400000;
export const REMIND_AFTER_DAYS = 14;

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
function write(v) {
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* sem armazenamento: ignora */ }
}

export const Backup = {
  /** true = o navegador prometeu não apagar; false = pode apagar se faltar espaço; null = não suportado/desconhecido. */
  persisted: null,

  get lastBackup() {
    const d = read().last;
    return d ? new Date(d) : null;
  },

  /** Só vale a pena lembrar/pedir proteção depois que há algo a perder. */
  get hasProgress() {
    const d = Store.data;
    return d.Xp >= 30 || Object.keys(d.Srs).length > 0 || Object.values(d.Lessons).some((l) => l.Completed);
  },

  get shouldRemind() {
    if (!this.hasProgress) return false;
    const s = read();
    const now = Date.now();
    if (s.snoozeUntil && now < s.snoozeUntil) return false;
    return !s.last || now - Date.parse(s.last) > REMIND_AFTER_DAYS * DAY;
  },

  snooze(days = 7) {
    write({ ...read(), snoozeUntil: Date.now() + days * DAY });
  },

  /** Pede ao navegador para não apagar os dados do app (no iPhone e no Android vale mais com o app instalado). */
  async protect() {
    const st = navigator.storage;
    if (!st?.persisted) return;
    try {
      this.persisted = await st.persisted();
      if (!this.persisted && st.persist && this.hasProgress) this.persisted = await st.persist();
    } catch { /* ignora */ }
  },

  /** Exporta o progresso. Devolve 'shared', 'downloaded' ou 'cancelled'. */
  async export() {
    const json = Store.exportJson();
    const name = `japhelp-progresso-${toIso(new Date()).slice(0, 10)}`;
    // Alguns Androids não compartilham .json; .txt sempre passa (a importação aceita os dois).
    const files = [
      new File([json], name + '.json', { type: 'application/json' }),
      new File([json], name + '.txt', { type: 'text/plain' }),
    ];
    const touch = window.matchMedia?.('(pointer: coarse)').matches;
    if (touch && navigator.share && navigator.canShare) {
      for (const f of files) {
        if (!navigator.canShare({ files: [f] })) continue;
        try {
          await navigator.share({ files: [f], title: 'Progresso do JapHelp' });
          this.markDone();
          return 'shared';
        } catch (e) {
          if (e.name === 'AbortError') return 'cancelled';
          break; // outro erro: cai para o download
        }
      }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(files[0]);
    a.download = files[0].name;
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    this.markDone();
    return 'downloaded';
  },

  markDone() {
    write({ ...read(), last: new Date().toISOString(), snoozeUntil: null });
  },
};
