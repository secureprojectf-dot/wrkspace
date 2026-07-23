import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireEmployee } from '@/lib/api-auth';

const ALLOWED = new Set(['marketing', 'technical', 'core']);

/** Request access to a restricted channel (Flutter channel-request). */
export async function POST(req: NextRequest) {
	try {
		const user = requireEmployee(req);
		const body = await req.json().catch(() => ({}));
		const channel = String(body?.channel || '')
			.trim()
			.toLowerCase();
		if (!ALLOWED.has(channel)) return jsonError('Invalid channel', 400);

		const existing = await db.channelAccessRequest.findUnique({
			where: { employeeId_channel: { employeeId: user.sub, channel } },
		});
		if (existing) {
			return Response.json({ ok: true, status: existing.status, request: existing });
		}

		const row = await db.channelAccessRequest.create({
			data: {
				employeeId: user.sub,
				channel,
				status: 'Pending',
			},
		});
		return Response.json({ ok: true, status: 'Pending', request: row });
	} catch (e: any) {
		return jsonError(e.message || 'Failed', e.message === 'Unauthorized' ? 401 : 500);
	}
}
