// MAC Obras – service worker: deja la app disponible sin señal
var CACHE = 'mac-obras-v1';
var SHELL = ['./', './index.html', './app.css', './app.js', './config.js', './manifest.webmanifest', './logo.png',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;                       // las llamadas al servidor (POST) no se tocan
  var url = new URL(req.url);
  var propio = url.origin === self.location.origin;
  var fuente = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!propio && !fuente) return;
  // abre al instante con lo guardado y actualiza en segundo plano (la versión nueva se ve al volver a abrir)
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(function (guardado) {
    var red = fetch(req).then(function (res) {
      if (res && (res.ok || res.type === 'opaque')) { var copia = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copia); }); }
      return res;
    }).catch(function () { return guardado || caches.match('./index.html'); });
    return guardado || red;
  }));
});
