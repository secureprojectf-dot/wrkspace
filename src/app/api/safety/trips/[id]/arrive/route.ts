import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireEmployee } from '@/lib/api-auth';
import { emitSafetyUpdate } from '@/lib/realtime-emit';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	try {
		const user = requireEmployee(req);
		const { id } = await ctx.params;
		const trip = await db.safetyTrip.findUnique({ where: { id } });
		if (!trip || trip.employeeId !== user.sub) return jsonError('Trip not found', 404);
		const updated = await db.safetyTrip.update({
			where: { id },
			data: { status: 'ARRIVED_HOME', endedAt: new Date() },
		});
		void emitSafetyUpdate('trip_arrived', { employeeId: trip.employeeId, trip: updated });
		return Response.json({ trip: updated });
	} catch (e: any) {
		const status = e.message === 'Unauthorized' ? 401 : 500;
		return jsonError(e.message || 'Failed to complete trip', status);
	}
}
