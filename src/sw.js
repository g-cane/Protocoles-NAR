// Service worker : rend l'application consultable hors-ligne après la première visite.
// La version est remplacée à chaque génération (empreinte du contenu).
const VERSION = 'nar-__VERSION__';
const SOCLE = ['./', 'index.html', 'manifest.webmanifest', 'icone.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SOCLE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((cles) => Promise.all(cles.filter((c) => c.startsWith('nar-') && c !== VERSION).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const polices = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== self.location.origin && !polices) return;

  // Page : réseau d'abord (pour recevoir les mises à jour), cache en secours.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((rep) => {
          const copie = rep.clone();
          caches.open(VERSION).then((c) => c.put('index.html', copie));
          return rep;
        })
        .catch(() => caches.match('index.html')),
    );
    return;
  }
  // Figures, pages du livret, polices : cache d'abord, puis réseau.
  e.respondWith(
    caches.match(req).then(
      (enCache) =>
        enCache ||
        fetch(req).then((rep) => {
          if (rep.ok || rep.type === 'opaque') {
            const copie = rep.clone();
            caches.open(VERSION).then((c) => c.put(req, copie));
          }
          return rep;
        }),
    ),
  );
});
