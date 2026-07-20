import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireEmployee } from '@/lib/api-auth';

/** Employee tasks: assigned to them or to ALL (matches website getEmployeeTasks). */
export async function GET(req: NextRequest) {
	try {
		const user = requireEmployee(req);
		const tasks = await db.task.findMany({
			where: {
				OR: [{ assigneeId: user.sub }, { assigneeId: 'ALL' }],
			},
			orderBy: { createdAt: 'desc' },
		});
		return Response.json({ tasks });
	} catch (e: any) {
		return jsonError(e.message || 'Unauthorized', e.message === 'Unauthorized' ? 401 : 500);
	}
}
