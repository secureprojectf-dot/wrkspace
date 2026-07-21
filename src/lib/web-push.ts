'use client';

import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { getApps, getApp, initializeApp } from 'firebase/app';
import { employeeToken } from '@/lib/mobile-api';
import { getFirebasePublicConfig } from '@/lib/firebase-public-config';

/** Register FCM web push when supported (Chrome/Android PWA; iOS 16.4+ installed PWA). */
export async function registerWebPush(_employeeId?: string) {
	if (typeof window === 'undefined') return;
	try {
		const config = getFirebasePublicConfig();
		if (!config) return;

		const ok = await isSupported();
		if (!ok) return;

		const permission = await Notification.requestPermission();
		if (permission !== 'granted') return;

		if ('serviceWorker' in navigator) {
			await navigator.serviceWorker.register('/api/firebase-messaging-sw');
		}

		const app = getApps().length ? getApp() : initializeApp(config);
		const messaging = getMessaging(app);
		const vapid = (process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || '').trim();
		const token = await getToken(messaging, {
			vapidKey: vapid || undefined,
			serviceWorkerRegistration: await navigator.serviceWorker.ready,
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
		/* push optional */
	}
}
