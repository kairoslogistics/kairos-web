// Registro de gastos sin internet (Jesús, 27 oct. 2026): guarda la página para abrirla sin señal en la carretera.
// La página se pide primero a internet y, si no hay, se usa la guardada. Los gastos viven en el teléfono (localStorage).
const CACHE = 'kairos-gastos-v1', ARCHIVOS = ['/gastos/', '/gastos/manifest.webmanifest', '/gastos/icono-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(k => k.put('/gastos/', c)); return r; }).catch(() => caches.match('/gastos/')));
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
