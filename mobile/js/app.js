// Inicialização, navegação por abas e rotas (#/home, #/lesson/n0-01/vocab ...).
import { Content } from './content.js';
import { Store } from './store.js';
import { Speech, Practice } from './speech.js';
import { createRunner } from './runner.js';
import { Backup } from './backup.js';
import { h, infoBox } from './ui.js';
import * as V from './views/index.js';

const TABS = [
  ['home', '🏠', 'Início', ['home', 'stats']],
  ['course', '📘', 'Curso', ['course', 'lesson']],
  ['review', '🔁', 'Revisar', ['review']],
  ['practice', '🎯', 'Praticar', ['practice', 'kana', 'kanji', 'vocab', 'phrases', 'dict', 'speak', 'drills', 'mywords', 'exam']],
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
  stats: () => V.StatsView(),
  drills: () => V.DrillsView(),
  exam: () => V.ExamView(),
  mywords: () => V.MyWordsView(),
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
  runExercises({ title, generator, onComplete, exam = null }) {
    Speech.stop();
    runner = createRunner({
      title,
      generator,
      onComplete,
      exam,
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

  /** Aplica o tamanho do texto em japonês escolhido em Ajustes. */
  applyTextScale() {
    const v = Number(Store.settings.JpTextScale) || 1;
    document.documentElement.style.setProperty('--jp-scale', String(Math.min(1.6, Math.max(0.9, v))));
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
  App.applyTextScale();
  Store.onChange(() => App.applyTextScale()); // importar progresso pode trazer outro tamanho
  Backup.protect();
  let asked = false; // pede proteção uma vez quando surgir o primeiro progresso
  Store.onChange(() => { if (!asked && Backup.persisted === false && Backup.hasProgress) { asked = true; Backup.protect(); } });
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

  if (new URLSearchParams(location.search).has('nosw')) {
    // Para desenvolver: /mobile/?nosw desliga o cache offline e sempre carrega os arquivos novos.
    navigator.serviceWorker?.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
  } else if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    // updateViaCache 'none': a conferência de versão nova nunca usa o cache HTTP (o GitHub manda max-age=600)
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(watchUpdates).catch(() => {});
  }
}

// ---------------- versão nova ----------------
// O service worker novo baixa tudo e fica esperando; o aluno decide quando trocar (para não perder uma sessão no meio).
let updating = false;

function watchUpdates(reg) {
  const offer = (worker) => showUpdateBar(worker);
  if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
  reg.addEventListener('updatefound', () => {
    const worker = reg.installing;
    worker?.addEventListener('statechange', () => {
      // sem controller = primeira instalação, não é atualização
      if (worker.state === 'installed' && navigator.serviceWorker.controller) offer(worker);
    });
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (updating) location.reload();
  });
  // Confere se há versão nova ao voltar para o app e a cada hora.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') reg.update().catch(() => {});
  });
  setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
}

/** Ajustes → "Procurar atualização": 'ready' (aviso na tela), 'downloading', 'latest' ou 'offline'. */
export async function checkForUpdate() {
  const reg = await navigator.serviceWorker?.getRegistration();
  if (!reg) return 'offline';
  try { await reg.update(); } catch { return 'offline'; }
  if (reg.waiting && navigator.serviceWorker.controller) { showUpdateBar(reg.waiting); return 'ready'; }
  if (reg.installing) return 'downloading'; // o aviso aparece sozinho quando terminar de baixar
  return 'latest';
}

function showUpdateBar(worker) {
  document.getElementById('update-bar')?.remove();
  const bar = h('div.update-bar', { id: 'update-bar', role: 'status' },
    h('span', '✨ Nova versão do JapHelp disponível.'),
    h('button.btn.small.primary', {
      type: 'button',
      onclick: () => {
        if (runner?.isActive() && !confirm('Atualizar agora? A sessão de exercícios em andamento será perdida.')) return;
        updating = true;
        bar.querySelector('button').disabled = true;
        worker.postMessage({ type: 'SKIP_WAITING' });
        setTimeout(() => location.reload(), 3000); // garantia, se o controllerchange não vier
      },
    }, 'Atualizar'),
    h('button.icon-btn.ghost.small', { type: 'button', 'aria-label': 'Depois', onclick: () => bar.remove() }, '✕'));
  document.body.append(bar);
}

boot();
