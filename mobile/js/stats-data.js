// Cálculos das estatísticas (sem tela): XP por dia e revisões previstas.
import { parseDate, today } from './store.js';

const DAY = 86400000;
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const WEEKDAY = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const shortDate = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

/** XP de cada um dos últimos n dias (o último é hoje). */
export function xpHistory(data, n = 28, now = today()) {
  return Array.from({ length: n }, (_, i) => {
    const d = addDays(now, i - n + 1);
    return { date: d, value: data.DailyXp[dayKey(d)] || 0 };
  });
}

/** Revisões que vencem em cada um dos próximos n dias (hoje inclui as atrasadas). */
export function reviewForecast(data, n = 7, now = today()) {
  const counts = Array(n).fill(0);
  for (const s of Object.values(data.Srs)) {
    const due = parseDate(s.Due);
    if (Number.isNaN(+due)) continue;
    const idx = Math.floor((new Date(due.getFullYear(), due.getMonth(), due.getDate()) - now) / DAY);
    if (idx < n) counts[Math.max(0, idx)]++;
  }
  return counts.map((value, i) => ({ date: addDays(now, i), value }));
}

