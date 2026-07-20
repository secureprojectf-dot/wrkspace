import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireEmployee } from '@/lib/api-auth';

const STATUSES = new Set(['Pending', 'In Progress', 'Completed']);

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	try {
		const user = requireEmployee(req);
		const { id } = await ctx.params;
		const body = await req.json().catch(() => ({}));
		const status = String(body?.status || '').trim();
		if (!STATUSES.has(status)) {
			return jsonError('status must be Pending, In Progress, or Completed', 400);
		}

		const task = await db.task.findUnique({ where: { id } });
		if (!task || (task.assigneeId !== user.sub && task.assigneeId !== 'ALL')) {
			return jsonError('Task not found', 404);
		}

		const updated = await db.task.update({
			where: { id },
			data: { status },
		});
		return Response.json({ success: true, task: updated });
	} catch (e: any) {
		return jsonError(e.message || 'Failed', e.message === 'Unauthorized' ? 401 : 500);
	}
}
