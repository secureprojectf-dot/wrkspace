import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireEmployee } from '@/lib/api-auth';
import { eventHasRepresentative } from '@/lib/event-reps';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	try {
		const user = requireEmployee(req);
		const { id } = await ctx.params;
		const event = await db.event.findFirst({
			where: { id, allowed: true },
		});
		if (!event) return jsonError('Event not found', 404);
		if (!eventHasRepresentative(event.representatives, user.sub)) {
			return jsonError('You are not a representative for this event', 403);
		}
		return Response.json({ event });
	} catch (e: any) {
		return jsonError(e.message || 'Unauthorized', e.message === 'Unauthorized' ? 401 : 500);
	}
}
