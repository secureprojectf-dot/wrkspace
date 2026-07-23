import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireEmployee } from '@/lib/api-auth';

/** Mobile registers FCM token on Neon (works even when Render devices route is missing). */
export async function POST(req: NextRequest) {
	try {
		const user = requireEmployee(req);
		const body = await req.json().catch(() => ({}));
		const token = body?.token != null ? String(body.token).trim() : '';
		await db.employee.update({
			where: { id: user.sub },
			data: { fcmToken: token || null },
		});
		return Response.json({ ok: true, saved: Boolean(token) });
	} catch (e: any) {
		const msg = e.message || 'Unauthorized';
		return jsonError(msg, msg === 'Unauthorized' ? 401 : 500);
	}
}
