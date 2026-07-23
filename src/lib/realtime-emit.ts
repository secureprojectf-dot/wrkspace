/**
 * Fan-out attendance / safety events to Socket.IO on Render
 * so website + mobile dashboards update live when Neon APIs run on Vercel.
 */
export async function emitAttendanceUpdate(
	employeeId: string,
	attendance: unknown,
	action: string,
) {
	return emitRealtime({
		channel: 'attendance',
		employeeId,
		attendance,
		action,
	});
}

export async function emitSafetyUpdate(kind: string, payload: Record<string, unknown>) {
	return emitRealtime({
		channel: 'safety',
		kind,
		...payload,
	});
}

async function emitRealtime(body: Record<string, unknown>) {
	const base = (
		process.env.NEXT_PUBLIC_BACKEND_URL ||
		process.env.BACKEND_URL ||
		'https://wrkspace-api.onrender.com'
	).replace(/\/$/, '');
	const secret = process.env.INTERNAL_PUSH_SECRET || process.env.JWT_SECRET || '';
	if (!secret) {
		console.warn('[realtime-emit] no INTERNAL_PUSH_SECRET/JWT_SECRET — skip');
		return { skipped: true };
	}
	try {
		const res = await fetch(`${base}/api/internal/realtime`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-internal-secret': secret,
			},
			body: JSON.stringify(body),
		});
		const text = await res.text();
		if (!res.ok) {
			console.warn('[realtime-emit]', res.status, text.slice(0, 200));
			return { ok: false, status: res.status };
		}
		return { ok: true };
	} catch (e) {
		console.warn('[realtime-emit] failed', e);
		return { ok: false, error: String(e) };
	}
}
