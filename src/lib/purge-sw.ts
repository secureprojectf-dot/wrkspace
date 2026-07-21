'use client';

/** Nuclear cleanup — broken SWs were crashing Android Chrome after login. */
export async function purgeBrokenServiceWorkers() {
	if (typeof window === 'undefined') return;
	try {
		if ('serviceWorker' in navigator) {
			const regs = await navigator.serviceWorker.getRegistrations();
			await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
		}
		if (window.caches?.keys) {
			const keys = await caches.keys();
			await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
		}
	} catch {
		/* ignore */
	}
}
