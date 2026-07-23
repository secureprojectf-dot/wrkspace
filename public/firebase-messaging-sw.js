/* Messaging SW placeholder — do not claim the whole origin. */
self.addEventListener('install', (event) => {
	event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', (event) => {
	// Intentionally no clients.claim() — claiming / crashes Android Chrome page loads.
	event.waitUntil(Promise.resolve());
});
