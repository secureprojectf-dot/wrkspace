import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireEmployee } from '@/lib/api-auth';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	try {
		const user = requireEmployee(req);
		const { id } = await ctx.params;
		const body = await req.json().catch(() => ({}));
		const lat = Number(body?.lat);
		const lng = Number(body?.lng);
		if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
			return jsonError('lat and lng required', 400);
		}
		const existing = await db.sosIncident.findUnique({ where: { id } });
		if (!existing || existing.status !== 'OPEN') {
			return jsonError('Open incident not found', 404);
		}
		if (existing.employeeId !== user.sub) {
			return jsonError('Only the reporter can update location', 403);
		}
		const incident = await db.sosIncident.update({
			where: { id },
			data: { lat, lng },
		});
		return Response.json({ incident });
	} catch (e: any) {
		const msg = e.message || 'Unauthorized';
		return jsonError(msg, msg === 'Unauthorized' ? 401 : 500);
	}
}
