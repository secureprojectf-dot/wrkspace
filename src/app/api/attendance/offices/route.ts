import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireEmployee } from '@/lib/api-auth';

/** Active offices for mobile leave-office geofence (office pins only — not home). */
export async function GET(req: NextRequest) {
	try {
		requireEmployee(req);
		const offices = await db.office.findMany({
			where: { active: true },
			select: {
				id: true,
				name: true,
				lat: true,
				lng: true,
				radiusMeters: true,
				geofenceM: true,
			},
			orderBy: { name: 'asc' },
		});
		return Response.json({ offices });
	} catch (e: any) {
		return jsonError(e.message || 'Unauthorized', e.message === 'Unauthorized' ? 401 : 500);
	}
}
