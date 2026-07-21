'use client';

import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { getApps, getApp, initializeApp } from 'firebase/app';
import { employeeToken } from '@/lib/mobile-api';

const firebaseConfig = {
	apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyCsO26dKBsPPNWxLrdMhopcfzryizp2_UY',
	authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'wrkspace-fae94.firebaseapp.com',
	projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'wrkspace-fae94',
	storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'wrkspace-fae94.firebasestorage.app',
	messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '967983667732',
	appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:967983667732:web:788fba85cb2e11590ca501',
};

/** Register FCM web push when supported (Chrome/Android PWA; iOS 16.4+ installed PWA). */
export async function registerWebPush(_employeeId?: string) {
	if (typeof window === 'undefined') return;
	try {
		const ok = await isSupported();
		if (!ok) return;

		const permission = await Notification.requestPermission();
		if (permission !== 'granted') return;

		if ('serviceWorker' in navigator) {
			await navigator.serviceWorker.register('/firebase-messaging-sw.js');
		}

		const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
		const messaging = getMessaging(app);
		const vapid =
			process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ||
			'';
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
