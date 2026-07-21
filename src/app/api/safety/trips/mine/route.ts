import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireEmployee } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/** Employee's own going-home trip history + GPS trail (Flutter Trip history). */
export async function GET(req: NextRequest) {
	try {
		const user = requireEmployee(req);
		const tripId = String(req.nextUrl.searchParams.get('tripId') || '').trim();

		if (tripId) {
			const trip = await db.safetyTrip.findFirst({
				where: { id: tripId, employeeId: user.sub },
				include: {
					points: { orderBy: { recordedAt: 'asc' }, take: 2000 },
				},
			});
			if (!trip) return jsonError('Trip not found', 404);
			return Response.json({
				trip: {
					...trip,
					polyline: trip.points.map((p) => ({ lat: p.lat, lng: p.lng, at: p.recordedAt })),
				},
			});
		}

		const trips = await db.safetyTrip.findMany({
			where: { employeeId: user.sub },
			orderBy: { startedAt: 'desc' },
			take: 40,
			include: {
				_count: { select: { points: true } },
			},
		});

		return Response.json({
			trips: trips.map((t) => ({
				id: t.id,
				status: t.status,
				dateKey: t.dateKey,
				lat: t.lat,
				lng: t.lng,
				startedAt: t.startedAt,
				endedAt: t.endedAt,
				pointCount: t._count.points,
			})),
		});
	} catch (e: any) {
		const status = e.message === 'Unauthorized' ? 401 : 500;
		return jsonError(e.message || 'Failed to load trips', status);
	}
}
