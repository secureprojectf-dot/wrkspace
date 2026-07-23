import { NextRequest } from 'next/server';
import { processAttendanceCheckoutJobs } from '@/lib/attendance-cron';

/**
 * Vercel Cron: near-checkout reminders + auto check-out FCM.
 * Secured with CRON_SECRET (or INTERNAL_PUSH_SECRET) via Authorization: Bearer …
 */
export async function GET(req: NextRequest) {
	const secret = process.env.CRON_SECRET || process.env.INTERNAL_PUSH_SECRET || '';
	const auth = req.headers.get('authorization') || '';
	const ok =
		!secret ||
		auth === `Bearer ${secret}` ||
		req.headers.get('x-cron-secret') === secret;

	// Vercel Cron sends Authorization: Bearer <CRON_SECRET> when CRON_SECRET is set
	if (secret && !ok) {
		return Response.json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const result = await processAttendanceCheckoutJobs({ notify: true });
		console.info('[cron/attendance]', result);
		return Response.json({ ok: true, ...result });
	} catch (e: any) {
		console.error('[cron/attendance]', e);
		return Response.json({ error: e?.message || 'cron failed' }, { status: 500 });
	}
}
