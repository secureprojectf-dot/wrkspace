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
  const data = Object.assign({}, payload.data || {}, {
    type: (payload.data && payload.data.type) || '',
  });
  self.registration.showNotification(title, {
    body,
    icon: '/icon.png',
    data,
    tag: data.type === 'office_exit' ? 'office-exit' : undefined,
    renotify: data.type === 'office_exit',
  });
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const officeExit = data.type === 'office_exit';
  const targetUrl = officeExit ? '/?office_exit=1' : '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          try {
            client.postMessage({ type: officeExit ? 'office_exit' : 'open' });
          } catch (_) {}
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});
`
		: `/* Firebase not configured */\nself.addEventListener('install', () => self.skipWaiting());\n`;

	return new Response(body, {
		status: 200,
		headers: {
			'Content-Type': 'application/javascript; charset=utf-8',
			'Cache-Control': 'no-store',
			// Do NOT set Service-Worker-Allowed: / — root scope breaks Android Chrome navigations.
		},
	});
}
