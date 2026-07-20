import { sendFcmToAllActive, sendFcmToEmployee, sendFcmToEmployees } from '@/lib/fcm-send';

type PushPayload = {
	title: string;
	body: string;
	data?: Record<string, string>;
	employeeId?: string;
	employeeIds?: string[];
	all?: boolean;
};

/**
 * Prefer sending FCM from Vercel (Neon tokens + Firebase admin).
 * Also try Render internal push when available (legacy / backup).
 */
export async function notifyPush(payload: PushPayload) {
	const results: Record<string, unknown> = {};
	const body = {
		title: payload.title,
		body: payload.body,
		data: payload.data,
	};

	// 1) Direct from website — works even when Render is stale
	try {
		if (payload.all) {
			results.vercel = await sendFcmToAllActive(body);
		} else if (Array.isArray(payload.employeeIds) && payload.employeeIds.length) {
			results.vercel = await sendFcmToEmployees(payload.employeeIds, body);
		} else if (payload.employeeId) {
			results.vercel = await sendFcmToEmployee(payload.employeeId, body);
		}
		if (results.vercel) console.info('[push] vercel fcm', results.vercel);
	} catch (e) {
		console.error('[push] vercel fcm failed', e);
		results.vercelError = String(e);
	}

	// 2) Backup: Render internal API (may 404 if not deployed)
	const base = (process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'https://wrkspace-api.onrender.com').replace(
		/\/$/,
		''
	);
	const secret = process.env.INTERNAL_PUSH_SECRET || process.env.JWT_SECRET || '';
	if (secret && (payload.all || payload.employeeId || (payload.employeeIds && payload.employeeIds.length))) {
		try {
			const res = await fetch(`${base}/api/internal/push`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-internal-secret': secret,
				},
				body: JSON.stringify(payload),
			});
			const text = await res.text();
			results.render = { status: res.status, body: text.slice(0, 300) };
			if (!res.ok) console.warn('[push] render backup', res.status, text.slice(0, 200));
		} catch (e) {
			console.error('[push] render notify failed', e);
			results.renderError = String(e);
		}
	}

	return results;
}
