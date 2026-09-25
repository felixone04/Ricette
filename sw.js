// Incrementa la versione ad ogni rilascio: i client vecchi riceveranno i nuovi file
const CACHE_PREFIX = 'chefbox-';
const CACHE_NAME = CACHE_PREFIX + 'v10';
const ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    './icon-maskable-512.png',
    './apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
    );
});

// Elimina solo le vecchie cache di ChefBox (non quelle di altre app sullo stesso dominio github.io)
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    const req = e.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);

    // Pagine e file dell'app: prima la rete (per avere sempre l'ultima versione), cache se offline
    if (url.origin === self.location.origin) {
        e.respondWith(
            fetch(req)
                .then((res) => {
                    if (res.ok) {
                        const copy = res.clone();
                        e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)));
                    }
                    return res;
                })
                .catch(() => caches.match(req, { ignoreSearch: true })
                    .then((cached) => cached || (req.mode === 'navigate' ? caches.match('./index.html') : null))
                    .then((res) => res || Response.error()))
        );
        return;
    }

    // Font e icone da CDN: cache prima, aggiornamento in background (così funzionano anche offline)
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com' || url.hostname === 'cdn.jsdelivr.net') {
        e.respondWith(
            caches.open(CACHE_NAME).then((cache) =>
                cache.match(req).then((cached) => {
                    const network = fetch(req)
                        .then((res) => {
                            if (res.ok || res.type === 'opaque') {
                                const copy = res.clone();
                                e.waitUntil(cache.put(req, copy).catch(() => {}));
                            }
                            return res;
                        })
                        .catch(() => cached || Response.error());
                    return cached || network;
                })
            )
        );
    }
});
