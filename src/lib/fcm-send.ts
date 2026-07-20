import { db } from '@/lib/db';

type PushPayload = {
	title: string;
	body: string;
	data?: Record<string, string>;
};

async function getMessaging() {
	const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
	if (!raw || !String(raw).trim()) {
		return null;
	}
	try {
		const admin = await import('firebase-admin');
		const mod = admin.default || admin;
		if (!mod.apps.length) {
			const cred = JSON.parse(raw);
			mod.initializeApp({ credential: mod.credential.cert(cred) });
		}
		return mod.messaging();
	} catch (e: any) {
		console.warn('[fcm-send] init failed', e?.message || e);
		return null;
	}
}

async function sendToTokenList(tokens: string[], payload: PushPayload) {
	const list = [...new Set(tokens.map((t) => String(t || '').trim()).filter(Boolean))];
	if (!list.length) {
		return { sent: 0, failed: 0, tokens: 0, skipped: 'no_tokens' as const };
	}

	const messaging = await getMessaging();
	if (!messaging) {
		return { sent: 0, failed: list.length, tokens: list.length, skipped: 'no_firebase_env' as const };
	}

	const stringData = Object.fromEntries(
		Object.entries(payload.data || {}).map(([k, v]) => [k, v == null ? '' : String(v)])
	);
	const isSos = stringData.type === 'sos';

	let sent = 0;
	let failed = 0;
	for (let i = 0; i < list.length; i += 500) {
		const chunk = list.slice(i, i + 500);
		try {
			const res = await messaging.sendEachForMulticast({
				tokens: chunk,
				notification: { title: payload.title, body: payload.body },
				data: stringData,
				android: {
					priority: 'high',
					notification: {
						channelId: isSos ? 'sos_alarm' : 'wrkspace_default',
						sound: 'default',
						priority: isSos ? 'max' : 'high',
					},
				},
			});
			sent += res.successCount;
			failed += res.failureCount;
		} catch (e: any) {
			console.error('[fcm-send] multicast error', e?.message || e);
			failed += chunk.length;
		}
	}
	return { sent, failed, tokens: list.length };
}

/** Send FCM from Vercel directly (does not depend on Render). */
export async function sendFcmToAllActive(payload: PushPayload) {
	const rows = await db.employee.findMany({
		where: { fcmToken: { not: null } },
		select: { fcmToken: true },
	});
	return sendToTokenList(
		rows.map((r) => String(r.fcmToken || '')),
		payload,
	);
}

/** Targeted FCM to one or more employees (by Neon id). */
export async function sendFcmToEmployees(employeeIds: string[], payload: PushPayload) {
	const ids = [...new Set((employeeIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
	if (!ids.length) {
		return { sent: 0, failed: 0, tokens: 0, skipped: 'no_ids' as const };
	}
	const rows = await db.employee.findMany({
		where: { id: { in: ids }, fcmToken: { not: null } },
		select: { fcmToken: true },
	});
	return sendToTokenList(
		rows.map((r) => String(r.fcmToken || '')),
		payload,
	);
}

export async function sendFcmToEmployee(employeeId: string, payload: PushPayload) {
	return sendFcmToEmployees([employeeId], payload);
}

export async function countFcmTokens() {
	return db.employee.count({ where: { fcmToken: { not: null } } });
}
