import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireEmployee } from '@/lib/api-auth';

/** Check-in at office → end any open going-home live trip. */
export async function POST(req: NextRequest) {
	try {
		const user = requireEmployee(req);
		const result = await db.safetyTrip.updateMany({
			where: { employeeId: user.sub, status: 'IN_TRANSIT' },
			data: { status: 'CANCELLED', endedAt: new Date() },
		});
		return Response.json({ ok: true, cancelled: result.count });
	} catch (e: any) {
		const status = e.message === 'Unauthorized' ? 401 : 500;
		return jsonError(e.message || 'Failed to cancel trips', status);
	}
}
