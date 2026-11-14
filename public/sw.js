/* Network only: never cache authenticated pages, API responses or user data. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate' || event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).catch(() => new Response(`<!doctype html><html lang="cs"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bez připojení</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#101b17;color:#edf7e8;font:17px/1.6 system-ui}main{max-width:420px;padding:32px}a{color:#dbf28b}</style><main><h1>Jste offline</h1><p>Pro přihlášení a práci s daty potřebujete připojení k internetu. Zkontrolujte Wi-Fi nebo mobilní data a zkuste aplikaci znovu otevřít.</p><a href="/">Zkusit znovu</a></main></html>`, {status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}})));
});
