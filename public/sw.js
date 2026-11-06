// Service worker do Publicar: mantém o app (e o player das telas) abrindo mesmo sem internet.
// A mídia das campanhas é guardada pelo próprio player (Cache API "publicar-midia-v1").
const CACHE = 'publicar-app-v1'

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/logo.png', '/manifest.webmanifest'])))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('publicar-app-') && k !== CACHE).map((k) => caches.delete(k)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return

  // Navegação: rede primeiro, cópia em cache como plano B (SPA → sempre index.html).
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copia = res.clone()
          caches.open(CACHE).then((c) => c.put('/', copia))
          return res
        })
        .catch(() => caches.match('/')),
    )
    return
  }

  // Arquivos estáticos com hash: cache primeiro.
  if (url.pathname.startsWith('/assets/') || /\.(png|svg|webmanifest)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copia = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copia))
            return res
          }),
      ),
    )
  }
})
