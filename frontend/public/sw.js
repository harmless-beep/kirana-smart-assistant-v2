// One-time retirement worker for the previous Workbox PWA.
// It replaces the old cache-first worker, clears only this app's Workbox caches,
// refreshes open app tabs, and then removes itself.
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys()
    await Promise.all(cacheNames
      .filter(name => /workbox|precache|offlinecache/i.test(name))
      .map(name => caches.delete(name)))
    await self.clients.claim()
    const clients = await self.clients.matchAll({ type: 'window' })
    await self.registration.unregister()
    await Promise.all(clients.map(client => client.navigate(client.url)))
  })())
})
