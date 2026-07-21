'use client';

const PURGE_FLAG = 'wrkspace_sw_purged_v3';

/**
 * One-shot cleanup of broken Firebase/FCM service workers.
 * Do NOT clear Cache Storage on every page load — that races with
 * Next.js chunk fetches and causes Android "This page couldn't load".
 */
export async function purgeBrokenServiceWorkers() {
	if (typeof window === 'undefined') return;
	try {
		if (localStorage.getItem(PURGE_FLAG) === '1') return;
	} catch {
		/* private mode — still try once this session */
	}

	try {
		if ('serviceWorker' in navigator) {
			const regs = await navigator.serviceWorker.getRegistrations();
			await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
		}
		// Clear only once (old FCM / Workbox caches), never on every navigation.
		if (window.caches?.keys) {
			const keys = await caches.keys();
			await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
		}
		try {
			localStorage.setItem(PURGE_FLAG, '1');
		} catch {
			/* ignore */
		}
	} catch {
		/* ignore */
	}
}
