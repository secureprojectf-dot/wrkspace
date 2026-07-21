/* Placeholder — real SW is served from /api/firebase-messaging-sw (env-injected). */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
	event.waitUntil(self.clients.claim());
});
