// Service worker: deixa o app e o conteúdo disponíveis offline.
// Ao mudar arquivos do app, aumente VERSION para os celulares baixarem a nova versão.
const VERSION = 'japhelp-v1';

const APP_FILES = [
  './',
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/app.js',
  './js/content.js',
  './js/exercises.js',
  './js/kana.js',
  './js/runner.js',
  './js/speech.js',
  './js/store.js',
  './js/trace.js',
  './js/ui.js',
  './js/views.js',
];

const CONTENT_FILES = [
  'curso_0_fundamentos.json', 'curso_1_primeiros_passos.json', 'curso_2_basico.json', 'curso_3_pre_intermediario.json',
  'curso_4_intermediario.json', 'curso_5_avancado.json', 'curso_6_vida_no_japao.json', 'curso_7_leitura_escuta.json',
  'kanji.txt', 'kanji_n3.txt', 'vocab_n4.txt', 'vocab_n5.txt', 'frases.json', 'dicas.txt',
].map((f) => '../Content/' + f);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll([...APP_FILES, ...CONTENT_FILES])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Responde do cache na hora e atualiza em segundo plano (o conteúdo novo aparece na próxima abertura).
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached || (req.mode === 'navigate' ? cache.match('./index.html') : Response.error()));
      if (cached) {
        event.waitUntil(network.catch(() => {}));
        return cached;
      }
      return network;
    }),
  );
});
