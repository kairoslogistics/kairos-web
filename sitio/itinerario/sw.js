// Itinerario sin internet (Elise, 4 nov. 2026): guarda la página para abrirla sin señal en la carretera.
// La página se pide primero a internet y, si no hay, se usa la guardada (una sola copia, sin importar el código de la dirección).
// No hay start_url en el manifiesto a propósito: el acceso directo abre la dirección con el código (?codigo=…).
const CACHE = 'kairos-itinerario-v1', ARCHIVOS = ['/itinerario/', '/itinerario/manifest.webmanifest', '/img/icono/favicon.svg', '/img/icono/icono-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('kairos-itinerario') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(k => k.put('/itinerario/', c)); } return r; }).catch(() => caches.match('/itinerario/')));
    return;
  }
  if (u.pathname.startsWith('/img/')) e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(x => { if (x.ok) { const c = x.clone(); caches.open(CACHE).then(k => k.put(e.request, c)); } return x; })));
});
