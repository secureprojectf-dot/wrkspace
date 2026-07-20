import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireEmployee } from '@/lib/api-auth';
import { emitSafetyUpdate } from '@/lib/realtime-emit';
import { recordTripLocation } from '@/lib/safety-trip';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	try {
		const user = requireEmployee(req);
		const { id } = await ctx.params;
		const body = await req.json().catch(() => ({}));
		const lat = Number(body?.lat);
		const lng = Number(body?.lng);
		if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
			return jsonError('lat/lng required', 400);
		}
		const trip = await db.safetyTrip.findUnique({ where: { id } });
		if (!trip || trip.status !== 'IN_TRANSIT') return jsonError('Trip not found', 404);
		if (trip.employeeId !== user.sub) return jsonError('Forbidden', 403);

		const updated = await recordTripLocation(id, lat, lng);
		void emitSafetyUpdate('trip_location', { employeeId: trip.employeeId, trip: updated });
		return Response.json({ trip: updated });
	} catch (e: any) {
		const status = e.message === 'Unauthorized' ? 401 : 500;
		return jsonError(e.message || 'Failed to update trip', status);
	}
}
