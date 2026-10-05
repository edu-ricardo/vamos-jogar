// Substitui o service worker do app antigo: desinstala a si mesmo e recarrega as abas abertas,
// que passam a receber a página que leva ao endereço novo (sem a versão antiga em cache).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) await caches.delete(key);
      await self.registration.unregister();
      for (const client of await self.clients.matchAll({ type: 'window' }))
        client.navigate(client.url);
    })(),
  );
});
