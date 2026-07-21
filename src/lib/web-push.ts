'use client';

import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { getApps, getApp, initializeApp } from 'firebase/app';
import { employeeToken } from '@/lib/mobile-api';
import { getFirebasePublicConfig } from '@/lib/firebase-public-config';

/**
 * Register FCM web push when supported.
 * Avoid root-scoped SWs with Service-Worker-Allowed — those can break
 * Android Chrome document loads when claiming the whole origin.
 */
export async function registerWebPush(_employeeId?: string) {
	if (typeof window === 'undefined') return;
	try {
		const config = getFirebasePublicConfig();
		if (!config) return;

		const ok = await isSupported();
		if (!ok) return;

		// Drop broken root-scope placeholder SWs (no fetch handler + clients.claim)
		if ('serviceWorker' in navigator) {
			const regs = await navigator.serviceWorker.getRegistrations();
			await Promise.all(
				regs.map(async (reg) => {
					const script = reg.active?.scriptURL || reg.installing?.scriptURL || '';
					const isPlaceholder =
						script.includes('/firebase-messaging-sw.js') &&
						!script.includes('/api/firebase-messaging-sw');
					const isRootScope = reg.scope === `${window.location.origin}/`;
					if (isPlaceholder || (isRootScope && script.includes('firebase-messaging-sw'))) {
						try {
							await reg.unregister();
						} catch {
							/* ignore */
						}
					}
				}),
			);
		}

		const permission = await Notification.requestPermission();
		if (permission !== 'granted') return;

		// Scope under /api/ only — do not claim the whole site
		const registration = await navigator.serviceWorker.register('/api/firebase-messaging-sw', {
			scope: '/api/firebase-messaging-sw/',
			updateViaCache: 'none',
		});

		const app = getApps().length ? getApp() : initializeApp(config);
		const messaging = getMessaging(app);
		const vapid = (process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || '').trim();
		const token = await getToken(messaging, {
			vapidKey: vapid || undefined,
			serviceWorkerRegistration: registration,
		}).catch(() => null);
		if (!token) return;

		const auth = employeeToken();
		await fetch('/api/devices/fcm-token', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...(auth ? { Authorization: `Bearer ${auth}` } : {}),
			},
			body: JSON.stringify({ token, platform: 'web' }),
		});
	} catch {
		/* push optional — never break the app shell */
	}
}
