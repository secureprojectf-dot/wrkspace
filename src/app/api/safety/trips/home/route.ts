import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireEmployee } from '@/lib/api-auth';
import { emitSafetyUpdate } from '@/lib/realtime-emit';

function isFemale(emp: { gender?: string | null }) {
	return String(emp.gender || '').toUpperCase() === 'FEMALE';
}

export async function POST(req: NextRequest) {
	try {
		const user = requireEmployee(req);
		const emp = await db.employee.findUnique({ where: { id: user.sub } });
		if (!emp) return jsonError('Employee not found', 404);
		if (!isFemale(emp)) return jsonError('Home tracking is for female employees', 403);

		const body = await req.json().catch(() => ({}));
		const lat = body?.lat != null ? Number(body.lat) : null;
		const lng = body?.lng != null ? Number(body.lng) : null;

		await db.safetyTrip.updateMany({
			where: { employeeId: emp.id, status: 'IN_TRANSIT' },
			data: { status: 'CANCELLED', endedAt: new Date() },
		});

		const trip = await db.safetyTrip.create({
			data: {
				employeeId: emp.id,
				status: 'IN_TRANSIT',
				lat: Number.isFinite(lat as number) ? (lat as number) : null,
				lng: Number.isFinite(lng as number) ? (lng as number) : null,
			},
		});
		void emitSafetyUpdate('trip_started', { employeeId: emp.id, trip });
		return Response.json({ trip });
	} catch (e: any) {
		const status = e.message === 'Unauthorized' ? 401 : 500;
		return jsonError(e.message || 'Failed to start trip', status);
	}
}
