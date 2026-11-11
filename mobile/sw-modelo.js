// Service worker: deixa o app e o conteúdo disponíveis offline.
// Este é o modelo: o gerar.ps1 troca a marca abaixo pela versão e pela lista de arquivos e salva como sw.js.
/* GERADO */

self.addEventListener('install', (event) => {
  // cache: 'reload' ignora o cache HTTP do navegador, para a versão nova vir mesmo nova.
  const files = [...APP_FILES, ...CONTENT_FILES].map((u) => new Request(u, { cache: 'reload' }));
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(files)));
  // Sem skipWaiting aqui: a versão nova espera o aluno tocar em "Atualizar" (ver app.js).
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('japhelp-') && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Responde do cache na hora e confere a rede em segundo plano.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  event.respondWith((async () => {
    // A página de testes sempre usa os arquivos atuais, nunca o cache.
    const client = event.clientId ? await self.clients.get(event.clientId) : null;
    if (new URL(req.url).pathname.includes('/testes/') || (client && new URL(client.url).pathname.includes('/testes/'))) return fetch(req);
    return caches.open(VERSION).then(async (cache) => {
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
    });
  })());
});
