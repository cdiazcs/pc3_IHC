/* Solo shell público conocido. Los datos personales siguen fuera de CacheStorage. */
const CACHE = 'agrovoz-shell-v7-pwa';
const URLS = ['./', './index.html', './styles.css', './app.js', './modules/llm-client.js', './modules/personalization.js', './modules/voice-commands.js', './modules/rooms-client.js', './manifest.webmanifest', './icons/leaf.svg', './icons/icon-192.png', './icons/icon-512.png'];
const ROOT = new URL('./', self.location.href || self.location.origin + '/sw.js');
const PUBLIC_SHELL = new Set(URLS.map(path => new URL(path, ROOT).href));
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(URLS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key =>
    key !== CACHE && (key.startsWith('agrovoz-shell-') || /^agrovozv\d+(?:-|$)/.test(key))
  ).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  url.hash = ''; // La navegación SPA conserva fragmentos; no son recursos distintos.
  if (request.method !== 'GET' || url.origin !== ROOT.origin || url.search ||
      url.pathname.startsWith('/api/') || request.headers.has('Authorization') ||
      !PUBLIC_SHELL.has(url.href)) return;
  event.respondWith(fetch(request, {cache:'no-cache'}).then(async response => {
    // No guardar respuestas marcadas privadas, opacas o redirigidas.
    const control = response.headers.get('Cache-Control') || '';
    if (response.ok && response.type !== 'opaque' && !response.redirected && !/private|no-store/i.test(control)) {
      const cache = await caches.open(CACHE);await cache.put(request, response.clone());
    }
    return response;
  }).catch(async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response('Recurso no disponible sin conexión. Vuelve a conectar y recarga AgroVoz.', {
      status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}
    });
  }));
});
