// Treinos gerados: conjugação, números, partículas e ditado.
import { Store } from '../store.js';
import { Speech } from '../speech.js';
import { h, icons, infoBox } from '../ui.js';
import { page } from './common.js';
import * as Drills from '../drills.js';
import { App } from '../app.js';

function run(title, generator) {
  App.runExercises({
    title,
    generator,
    onComplete: (r) => { Store.addXp(r.correct * 2); return `+${r.correct * 2} XP`; },
  });
}

export function DrillsView() {
  const item = (icon, name, desc, onclick, disabled = false) => h('button.menu-item', { type: 'button', onclick, disabled },
    h('span.menu-icon', { lang: 'ja' }, icon), h('span.menu-text', h('strong', name), h('small', desc)), h('span.chev', '›'));
  return page(
    h('div.sub-head', h('button.icon-btn.ghost', { type: 'button', 'aria-label': 'Voltar', onclick: () => App.go('practice') }, icons.back),
      h('h1.page-title', 'Treinos')),
    h('p.page-sub', 'Exercícios criados na hora a partir do vocabulário e das frases do curso — cada rodada é diferente.'),
    h('div.menu',
      item('活', 'Conjugação', 'Verbos e adjetivos: ます, dicionário, て, た, ない', () => run('Conjugação', () => Drills.conjugationDrill(12))),
      item('円', 'Preços', 'Ouvir e ler valores em ienes', () => run('Preços', () => Drills.numbersDrill(12, ['price']))),
      item('時', 'Horas e datas', '4:30, 20 de abril… com as leituras irregulares', () => run('Horas e datas', () => Drills.numbersDrill(12, ['time', 'date']))),
      item('は', 'Partículas', 'Complete as frases do curso com は, が, を, に, で…', () => run('Partículas', () => Drills.particleDrill(12))),
      item('組', 'Montar frases', 'Coloque as palavras das frases do curso na ordem certa', () => run('Montar frases', () => Drills.orderDrill(10))),
      item('耳', 'Ditado', 'Ouça uma frase curta e escreva', () => run('Ditado', () => Drills.dictationDrill(10)), !Speech.available)),
    !Speech.available ? infoBox('O ditado e as questões de ouvir precisam da voz japonesa do aparelho.', 'warn') : null,
  );
}
