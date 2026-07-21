import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireEmployee } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/** Employee phones poll this — if true, keep posting GPS even off-shift. */
export async function GET(req: NextRequest) {
	try {
		const user = requireEmployee(req);
		const [config, emp] = await Promise.all([
			db.liveTrackConfig.findUnique({ where: { id: 'global' } }),
			db.employee.findUnique({
				where: { id: user.sub },
				select: { liveTrackActive: true },
			}),
		]);

		const global = Boolean(config?.active);
		const personal = Boolean(emp?.liveTrackActive);
		const shouldTrack = global || personal;

		return Response.json({
			shouldTrack,
			global,
			personal,
			intervalMs: shouldTrack ? 15_000 : 60_000,
		});
	} catch (e: any) {
		const status = e.message === 'Unauthorized' ? 401 : 500;
		return jsonError(e.message || 'Failed', status);
	}
}
