/* Firebase messaging + offline shell for wrkspace PWA */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
	apiKey: 'AIzaSyCsO26dKBsPPNWxLrdMhopcfzryizp2_UY',
	authDomain: 'wrkspace-fae94.firebaseapp.com',
	projectId: 'wrkspace-fae94',
	storageBucket: 'wrkspace-fae94.firebasestorage.app',
	messagingSenderId: '967983667732',
	appId: '1:967983667732:web:788fba85cb2e11590ca501',
});

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
