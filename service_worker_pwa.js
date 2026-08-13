const CACHE_NAME = 'portal-estoques-v4.2';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => caches.delete(cache))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Ignora cache para index.html, solicitacao_estoque.html e navegação de página para garantir que as atualizações cheguem na hora
  if (event.request.mode === 'navigate' || event.request.url.includes('index.html') || event.request.url.includes('solicitacao_estoque.html')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }
  
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
