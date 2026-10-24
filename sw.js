// Service worker de Historial Mitre (Fase 7: app instalable y consulta sin conexión).
// La versión llega en la URL (sw.js?v=APP_VERSION): al subir APP_VERSION cambia la caché sola.
// Los datos sin conexión salen de lo que la app guarda en el navegador (js/api.js); acá se guarda la "cáscara":
// la página, el CSS, los scripts, el escudo y las librerías.
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE = 'cdm-' + VERSION;

self.addEventListener('install', (ev) => {
  ev.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Los archivos de la app salen del propio index.html (los que llevan ?v=)
    const html = await (await fetch('index.html', { cache: 'no-store' })).text();
    const propios = [...html.matchAll(/(?:src|href)="([^"]+\?v=[^"]+)"/g)].map((m) => m[1]);
    await cache.addAll(['./', 'index.html', 'assets/escudo.png', 'assets/escudo-192.png', 'assets/icono-192.png', 'manifest.webmanifest'].concat(propios));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil((async () => {
    const nombres = await caches.keys();
    await Promise.all(nombres.filter((n) => n.startsWith('cdm-') && n !== CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // La base (Supabase) no pasa por acá: la app maneja sus datos y su modo sin conexión.
  if (url.hostname.endsWith('supabase.co')) return;

  // Páginas: primero la red (para tener siempre la última versión); sin red, la guardada.
  if (req.mode === 'navigate') {
    ev.respondWith(fetch(req).then((r) => {
      const copia = r.clone();
      caches.open(CACHE).then((c) => c.put('index.html', copia));
      return r;
    }).catch(() => caches.match('index.html')));
    return;
  }

  // Archivos con versión, imágenes, fuentes y librerías: primero lo guardado.
  const guardable = url.origin === self.location.origin || /cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com/.test(url.hostname);
  if (!guardable) return;
  ev.respondWith(caches.match(req).then((guardado) => guardado || fetch(req).then((r) => {
    if (r.ok || r.type === 'opaque') {
      const copia = r.clone();
      caches.open(CACHE).then((c) => c.put(req, copia));
    }
    return r;
  })));
});
