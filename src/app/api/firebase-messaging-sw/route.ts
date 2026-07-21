import { getFirebasePublicConfig } from '@/lib/firebase-public-config';

export const dynamic = 'force-dynamic';

/** Serves messaging SW with Firebase config from env (no secrets in git). */
export async function GET() {
	const config = getFirebasePublicConfig();
	const body = config
		? `/* generated — do not commit secrets */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');
firebase.initializeApp(${JSON.stringify(config)});
const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || 'wrkspace';
  const body = payload.notification?.body || payload.data?.body || '';
  self.registration.showNotification(title, {
    body,
    icon: '/icon.png',
    data: payload.data || {},
  });
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
`
		: `/* Firebase not configured */\nself.addEventListener('install', () => self.skipWaiting());\n`;

	return new Response(body, {
		status: 200,
		headers: {
			'Content-Type': 'application/javascript; charset=utf-8',
			'Cache-Control': 'no-store',
			'Service-Worker-Allowed': '/',
		},
	});
}
