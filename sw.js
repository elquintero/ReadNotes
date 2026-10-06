/* ReadNotes – service worker (funciona sin conexión)
   Cambia VERSION en cada publicación: así los móviles detectan la nueva versión
   y muestran el aviso "Nueva versión disponible". */
const VERSION = "1.0.18";
const CACHE = "readnotes-" + VERSION;
const SOUND = "readnotes-sound";            // muestras de piano: se conservan entre versiones
const ASSETS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
  "icons/favicon-32.png"
];

self.addEventListener("install", (e) => {
  // Sin skipWaiting automático: la app avisa y el usuario decide cuándo actualizar
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: "reload" })))));
});

self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("readnotes-") && k !== CACHE && k !== SOUND).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;

  // Páginas: red primero, saltándose la caché HTTP de GitHub Pages (10 min); sin conexión, copia guardada
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req, { cache: "no-cache" })
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put("index.html", copy)); return res; })
        .catch(() => caches.match("index.html"))
    );
    return;
  }

  // Muestras de piano: caché primero (se descargan una vez y quedan guardadas)
  if (url.pathname.toLowerCase().includes("/sound/")) {
    e.respondWith(
      caches.open(SOUND).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) c.put(req, res.clone());
        return res;
      })))
    );
    return;
  }

  // Resto: caché primero
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }))
  );
});
