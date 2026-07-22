import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireEmployee } from '@/lib/api-auth';

const STATUSES = new Set(['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost']);

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	try {
		requireEmployee(req);
		const { id } = await ctx.params;
		const body = await req.json().catch(() => ({}));
		const status = String(body?.status || '').trim();
		if (!STATUSES.has(status)) return jsonError('Invalid status', 400);

		const updated = await db.lead.update({
			where: { id },
			data: {
				status,
				...(body.notes !== undefined ? { notes: String(body.notes) } : {}),
			},
		});
		return Response.json({ success: true, lead: updated });
	} catch (e: any) {
		const msg = e.message || 'Failed to update lead';
		return jsonError(msg, msg === 'Unauthorized' ? 401 : 500);
	}
}
