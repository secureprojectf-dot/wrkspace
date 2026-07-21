'use client';

import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { getApps, getApp, initializeApp } from 'firebase/app';
import { employeeToken } from '@/lib/mobile-api';
import { getFirebasePublicConfig } from '@/lib/firebase-public-config';

let officeExitUnsub: (() => void) | null = null;

/** Foreground push: open leave-office dialog when type=office_exit. */
export async function subscribeOfficeExitPush(onOfficeExit: () => void) {
	if (typeof window === 'undefined') return;
	try {
		const config = getFirebasePublicConfig();
		if (!config) return;
		const ok = await isSupported();
		if (!ok) return;
		const app = getApps().length ? getApp() : initializeApp(config);
		const messaging = getMessaging(app);
		officeExitUnsub?.();
		officeExitUnsub = onMessage(messaging, (payload) => {
			const type = String(payload.data?.type || '');
			if (type === 'office_exit') onOfficeExit();
		});
	} catch {
		/* optional */
	}
}

/**
 * Register FCM web push after login.
 * Uses a narrow SW scope (no root claim) so Android Chrome navigations stay stable.
 */
export async function registerWebPush(_employeeId?: string) {
	if (typeof window === 'undefined') return;
	try {
		const config = getFirebasePublicConfig();
		if (!config) {
			console.warn('[web-push] Firebase public config missing');
			return;
		}

		const ok = await isSupported();
		if (!ok) return;

		// Drop only broken placeholder / root-scope messaging SWs — keep a healthy narrow-scope SW.
		if ('serviceWorker' in navigator) {
			const regs = await navigator.serviceWorker.getRegistrations();
			await Promise.all(
				regs.map(async (reg) => {
					const script = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || '';
					const isPlaceholder =
						script.includes('/firebase-messaging-sw.js') &&
						!script.includes('/api/firebase-messaging-sw');
					const isRootMessaging =
						reg.scope === `${window.location.origin}/` && script.includes('firebase-messaging');
					if (isPlaceholder || isRootMessaging) {
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
		if (permission !== 'granted') {
			console.info('[web-push] notification permission:', permission);
			return;
		}

		const vapid = (process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || '').trim();
		if (!vapid) {
			console.warn(
				'[web-push] NEXT_PUBLIC_FIREBASE_VAPID_KEY is not set — trying getToken without it (may fail)',
			);
		}

		// Scope under /api/firebase-messaging-sw/ only — never claim the whole origin.
		const registration = await navigator.serviceWorker.register('/api/firebase-messaging-sw', {
			scope: '/api/firebase-messaging-sw/',
			updateViaCache: 'none',
		});
		await navigator.serviceWorker.ready;

		const app = getApps().length ? getApp() : initializeApp(config);
		const messaging = getMessaging(app);
		const token = await getToken(messaging, {
			...(vapid ? { vapidKey: vapid } : {}),
			serviceWorkerRegistration: registration,
		}).catch((e) => {
			console.warn('[web-push] getToken failed', e);
			return null;
		});
		if (!token) return;

		const auth = employeeToken();
		if (!auth) {
			console.warn('[web-push] no employee JWT — token not saved');
			return;
		}

		const res = await fetch('/api/devices/fcm-token', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${auth}`,
			},
			body: JSON.stringify({ token, platform: 'web' }),
		});
		if (!res.ok) {
			console.warn('[web-push] save failed', res.status);
		}
	} catch (e) {
		console.warn('[web-push] register failed', e);
	}
}
