import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError } from '@/lib/api-auth';
import { notifyPush } from '@/lib/push-notify';

export const dynamic = 'force-dynamic';

/** Admin marks SOS resolved — closes for all employees. */
export async function POST(req: NextRequest) {
	try {
		const body = await req.json().catch(() => ({}));
		const email = String(body.email || req.headers.get('x-admin-email') || '')
			.trim()
			.toLowerCase();
		const incidentId = String(body.incidentId || '').trim();
		if (!email || !incidentId) return jsonError('email and incidentId required', 400);

		const admin = await db.admin.findFirst({
			where: { email: { equals: email, mode: 'insensitive' } },
		});
		if (!admin) return jsonError('Unauthorized', 401);

		const incident = await db.sosIncident.update({
			where: { id: incidentId },
			data: { status: 'RESOLVED', resolvedAt: new Date() },
		});

		await notifyPush({
			title: 'SOS resolved',
			body: 'The emergency alert was closed by admin. You can return to normal.',
			all: true,
			data: {
				type: 'sos_resolved',
				incidentId: String(incidentId),
			},
		});

		return Response.json({ success: true, incident });
	} catch (e: any) {
		return jsonError(e.message || 'Failed to resolve', 500);
	}
}
