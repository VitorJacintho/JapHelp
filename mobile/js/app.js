// Inicialização, navegação por abas e rotas (#/home, #/lesson/n0-01/vocab ...).
import { Content } from './content.js';
import { Store } from './store.js';
import { Speech, Practice } from './speech.js';
import { createRunner } from './runner.js';
import { h, infoBox } from './ui.js';
import * as V from './views.js';

const TABS = [
  ['home', '🏠', 'Início', ['home']],
  ['course', '📘', 'Curso', ['course', 'lesson']],
  ['review', '🔁', 'Revisar', ['review']],
  ['practice', '🎯', 'Praticar', ['practice', 'kana', 'kanji', 'vocab', 'phrases', 'dict', 'speak']],
  ['settings', '⚙️', 'Ajustes', ['settings']],
];

const ROUTES = {
  home: () => V.HomeView(),
  course: () => V.CourseView(),
  lesson: (id, tab) => V.LessonView(id, tab),
  review: () => V.ReviewView(),
  practice: () => V.PracticeView(),
  kana: () => V.KanaView(),
  kanji: (level) => V.KanjiView(level),
  vocab: (i) => V.VocabView(i),
  phrases: (i) => V.PhrasesView(i),
  dict: () => V.DictionaryView(),
  speak: () => V.SpeakingView(),
  settings: () => V.SettingsView(),
};

let viewEl;
let tabbar;
let runner = null;
let lastRoute = '';

const parseHash = () => {
  const parts = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/').filter(Boolean);
  return { name: parts[0] || 'home', args: parts.slice(1) };
};

export const App = {
  installPrompt: null,

  /** Navega para uma rota. replace = não cria entrada no histórico (troca de aba interna). */
  go(route, replace = false) {
    const hash = '#/' + route;
    if (location.hash === hash) { this.render(); return; }
    if (replace) location.replace(hash);
    else location.hash = hash;
  },

  render() {
    const { name, args } = parseHash();
    if (name === 'run') {
      if (!runner) { this.go('home', true); return; }
      document.body.classList.add('running');
      viewEl.replaceChildren(runner.el);
      return;
    }
    document.body.classList.remove('running');
    const route = ROUTES[name] ? name : 'home';
    const key = route + '/' + (args[0] || '');
    let el;
    try {
      el = ROUTES[route](...args);
    } catch (e) {
      console.error(e);
      el = h('div.page', infoBox('Erro ao abrir a tela: ' + e.message, 'error'));
    }
    viewEl.replaceChildren(el);
    if (key !== lastRoute) window.scrollTo(0, 0);
    lastRoute = key;
    for (const b of tabbar.children) b.classList.toggle('active', b.dataset.routes.split(',').includes(route));
  },

  /** Abre a tela de exercícios. Ao sair, volta para a tela de onde veio. */
  runExercises({ title, generator, onComplete }) {
    Speech.stop();
    runner = createRunner({
      title,
      generator,
      onComplete,
      onExit: () => {
        runner = null;
        if (parseHash().name === 'run') history.back();
        else this.render();
      },
    });
    location.hash = '#/run';
  },

  openSpeaking(name, items) {
    V.setSpeakingSource(name, items);
    this.go('speak');
  },

  async install() {
    if (!this.installPrompt) return;
    this.installPrompt.prompt();
    await this.installPrompt.userChoice;
    this.installPrompt = null;
    this.render();
  },
};

function onHashChange() {
  const { name } = parseHash();
  if (runner && name !== 'run') {
    if (runner.isActive() && !confirm('Sair agora? O progresso desta sessão será perdido.')) {
      history.pushState(null, '', '#/run');
      return;
    }
    runner = null;
    Speech.stop();
  }
  Practice.stopAll();
  if (name !== 'speak' && name !== 'run') Speech.stop();
  App.render();
}

async function boot() {
  viewEl = document.getElementById('view');
  tabbar = document.getElementById('tabbar');
  tabbar.replaceChildren(...TABS.map(([route, icon, label, routes]) =>
    h('button.tab-btn', { type: 'button', 'data-routes': routes.join(','), onclick: () => App.go(route) },
      h('span.tab-icon', icon), h('span.tab-label', label))));

  Store.load();
  Speech.init();
  await Content.load();
  document.getElementById('splash')?.remove();
  window.addEventListener('hashchange', onHashChange);
  if (parseHash().name === 'run') history.replaceState(null, '', '#/home');
  App.render();

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    App.installPrompt = e;
    const { name } = parseHash();
    if (name === 'home' || name === 'settings') App.render();
  });
  // a voz pode carregar depois: atualiza avisos de voz na tela inicial/ajustes
  window.speechSynthesis?.addEventListener?.('voiceschanged', () => {
    const { name } = parseHash();
    if (name === 'settings') App.render();
  });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

boot();
