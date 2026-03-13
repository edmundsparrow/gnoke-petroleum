const CACHE_NAME = 'gnoke-petroleum-v1';
const ASSETS = [
  './',
  './index.html',
  './main.html',
  './style.css',
  './js/config.js',
  './js/db.js',
  './js/ui.js',
  './js/app.js',
  './js/summary.js',
  './global.png',
  'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.js',
  'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.wasm'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});


