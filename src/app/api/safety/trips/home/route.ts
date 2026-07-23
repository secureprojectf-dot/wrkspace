import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireEmployee } from '@/lib/api-auth';
import { emitSafetyUpdate } from '@/lib/realtime-emit';
import { todayKeyIST } from '@/lib/attendance-geo';
import { recordTripLocation } from '@/lib/safety-trip';

function isFemale(emp: { gender?: string | null }) {
	return String(emp.gender || '').toUpperCase() === 'FEMALE';
}

export async function GET(req: NextRequest) {
	try {
		const user = requireEmployee(req);
		const open = await db.safetyTrip.findFirst({
			where: { employeeId: user.sub, status: 'IN_TRANSIT' },
			orderBy: { startedAt: 'desc' },
		});
		return Response.json({ trip: open });
	} catch (e: any) {
		const status = e.message === 'Unauthorized' ? 401 : 500;
		return jsonError(e.message || 'Failed', status);
	}
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
				dateKey: todayKeyIST(),
				lat: Number.isFinite(lat as number) ? (lat as number) : null,
				lng: Number.isFinite(lng as number) ? (lng as number) : null,
			},
		});

		if (Number.isFinite(lat as number) && Number.isFinite(lng as number)) {
			await recordTripLocation(trip.id, lat as number, lng as number);
		}

		const fresh = await db.safetyTrip.findUnique({ where: { id: trip.id } });
		void emitSafetyUpdate('trip_started', { employeeId: emp.id, trip: fresh });
		return Response.json({ trip: fresh });
	} catch (e: any) {
		const status = e.message === 'Unauthorized' ? 401 : 500;
		return jsonError(e.message || 'Failed to start trip', status);
	}
}
