// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Service worker: o app funciona sem internet depois do primeiro acesso.
// A lista de arquivos e a versão são preenchidas no build (scripts/offline-plugin.mjs). Arquivos grandes e opcionais
// (leitura de STEP no navegador) não entram no pré-cache: são guardados na primeira vez que forem usados.
const VERSION = "__VERSION__";
const CACHE = `buzz-simulator-${VERSION}`;
const PRECACHE = __PRECACHE__;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("buzz-simulator-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  // páginas: rede primeiro (pega atualizações), cache quando estiver offline
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("./index.html", { ignoreSearch: true, ignoreVary: true })));
    return;
  }
  // arquivos com hash no nome nunca mudam: cache primeiro, e o que vier da rede fica guardado.
  // ignoreVary: scripts de módulo vão com o cabeçalho Origin e o servidor responde "Vary: Origin";
  // sem isso, o que o pré-cache guardou (sem Origin) não seria encontrado offline.
  event.respondWith(
    caches.match(request, { ignoreSearch: true, ignoreVary: true }).then(
      (hit) =>
        hit ||
        fetch(request).then((response) => {
          if (response.ok && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
