// No-op service worker to prevent repeated /sw.js 404 noise in development.
self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})
