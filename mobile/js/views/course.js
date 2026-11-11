// Lista de módulos e lições.
import { Content } from '../content.js';
import { Store } from '../store.js';
import { h, infoBox, progressBar, lessonCard } from '../ui.js';
import { page, title } from './common.js';
import { App } from '../app.js';

export function CourseView() {
  const next = Content.nextRecommended();
  return page(
    ...title('Curso de japonês', 'Siga os níveis em ordem. Cada lição tem teoria, vocabulário, exemplos com áudio e exercícios. Faça 70% ou mais para concluir.'),
    Content.modules.length === 0 ? infoBox('Nenhum conteúdo encontrado.', 'error') : null,
    Content.modules.map((m) => {
      const done = m.lessons.filter((l) => Store.isCompleted(l.id)).length;
      const open = next ? next.module === m : false;
      return h('details.module', { open, style: { '--mc': m.color } },
        h('summary',
          h('div.module-head',
            h('div.module-title', m.title),
            h('div.muted.small', `${m.level ? m.level + ' · ' : ''}${done}/${m.lessons.length} concluídas`),
            progressBar(m.lessons.length ? done / m.lessons.length : 0, m.color))),
        h('p.module-desc', m.description),
        h('div.lesson-list', m.lessons.map((l) => lessonCard(l, { onclick: () => App.go(`lesson/${l.id}`) }))));
    }),
  );
}
