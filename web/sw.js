/* GPlanSiS|Writer — service worker (PWA).
   - HTML (navegação): rede primeiro; sem rede, a última cópia do shell.
   - Estáticos do próprio domínio: cache primeiro (os links de CSS/JS levam ?v=<versão>).
   - NUNCA toca em /api/*, em métodos que não sejam GET nem em outros domínios.
   VERSION é trocada a cada publicação (deploy/vps/publicar.sh); caches de versões antigas são apagados. */
'use strict';
const VERSION = '__V__';
const CACHE = 'writer-shell-' + VERSION;
const SHELL = '/';
const PRECACHE = [
  SHELL,
  '/writer.css?v=' + VERSION, '/plataforma.css?v=' + VERSION, '/tema.js?v=' + VERSION,
  '/writer.js?v=' + VERSION, '/plataforma.js?v=' + VERSION, '/pwa.js?v=' + VERSION,
  '/icon.svg', '/icon-32.png', '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png',
  '/apple-touch-icon.png', '/manifest.webmanifest'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith('writer-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return;
  if (url.pathname === '/sw.js') return;

  if (req.mode === 'navigate') {
    // o servidor devolve o mesmo index.html para qualquer rota (try_files): guarda-se uma cópia só, em "/"
    e.respondWith(fetch(req).then(res => {
      if (res.ok && res.type === 'basic') { const cp = res.clone(); caches.open(CACHE).then(c => c.put(SHELL, cp)); }
      return res;
    }).catch(() => caches.match(SHELL, { cacheName: CACHE }).then(r => r || caches.match(SHELL)).then(r => r || Response.error())));
    return;
  }

  e.respondWith(caches.match(req, { cacheName: CACHE }).then(hit => hit || fetch(req).then(res => {
    if (res.ok && res.type === 'basic' && !req.headers.has('range')) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
    return res;
  })));
});
