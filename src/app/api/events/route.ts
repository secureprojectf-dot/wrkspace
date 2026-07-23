import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireEmployee } from '@/lib/api-auth';
import { eventHasRepresentative } from '@/lib/event-reps';

/** Employee: only events where they are a representative. */
export async function GET(req: NextRequest) {
	try {
		const user = requireEmployee(req);
		const events = await db.event.findMany({
			where: { allowed: true },
			orderBy: { startDate: 'asc' },
		});
		return Response.json({
			events: events.filter((e) => eventHasRepresentative(e.representatives, user.sub)),
		});
	} catch (e: any) {
		return jsonError(e.message || 'Unauthorized', e.message === 'Unauthorized' ? 401 : 500);
	}
}
