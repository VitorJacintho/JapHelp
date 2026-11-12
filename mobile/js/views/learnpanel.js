// Painel "Aprender as palavras" (lição e deck): grupos de palavras com ✓ nos aprendidos.
import { Store } from '../store.js';
import { h, section } from '../ui.js';
import { wordGroups, learnSession, GROUP_SIZE } from '../learn.js';
import { App } from '../app.js';

const doneKey = (key, i) => `learn:${key}:${i + 1}`;
// guardado em VocabDecksDone: o app de PC preserva essa lista, então o progresso vai e volta no backup
export const isGroupDone = (key, i) => Store.hasDeck(doneKey(key, i));

export function startLearnGroup(key, title, groups, i, { pool = [], sentences = [] } = {}) {
  const group = groups[i];
  App.runExercises({
    title: `${title} · grupo ${i + 1}`,
    generator: () => learnSession(group, { siblings: groups.flat(), pool, sentences }),
    onComplete: (r) => {
      let xp = r.correct * 2;
      if (r.percent < 60) {
        Store.addXp(xp);
        return `+${xp} XP · Faça 60% ou mais para marcar o grupo como aprendido.`;
      }
      if (Store.addDeck(doneKey(key, i))) xp += 10;
      for (const v of group) Store.addToSrs(v);
      Store.addXp(xp);
      const next = i + 1 < groups.length ? ` Próximo: grupo ${i + 2}.` : ' Você passou por todas as palavras!';
      return `+${xp} XP · Grupo aprendido — as palavras entraram na revisão.${next}`;
    },
  });
}

/** Lista de grupos com ✓ nos aprendidos. */
export function learnPanel(key, title, items, { pool = [], sentences = [], intro = true } = {}) {
  const groups = wordGroups(items);
  if (!groups.length) return null;
  const done = groups.filter((_, i) => isGroupDone(key, i)).length;
  const nextIdx = groups.findIndex((_, i) => !isGroupDone(key, i));
  return h('div.learn-panel',
    section(`🧠 Aprender as palavras (${done}/${groups.length})`),
    intro ? h('p.muted.small', `Grupos de ${GROUP_SIZE} palavras, com calma: o app apresenta cada palavra, pergunta logo depois e vai subindo — reconhecer, escrever com as letras, usar numa frase e falar.`) : null,
    h('div.menu', groups.map((g, i) => {
      const ok = isGroupDone(key, i);
      return h('button.menu-item' + (ok ? '.done' : '') + (i === nextIdx ? '.next' : ''), { type: 'button', onclick: () => startLearnGroup(key, title, groups, i, { pool, sentences }) },
        h('span.menu-icon', ok ? '✓' : String(i + 1)),
        h('span.menu-text', h('strong', `Grupo ${i + 1}` + (i === nextIdx ? ' · comece aqui' : '')),
          h('small', { lang: 'ja' }, g.map((v) => v.jp).join('・'))),
        h('span.chev', '›'));
    })));
}
