import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireEmployee } from '@/lib/api-auth';
import { notifyPush } from '@/lib/push-notify';
import { todayKeyIST } from '@/lib/attendance-geo';
import { emitAttendanceUpdate } from '@/lib/realtime-emit';

function isOpen(row: { checkIn?: string | null; checkOut?: string | null } | null) {
	if (!row?.checkIn) return false;
	const out = row.checkOut;
	return out == null || String(out).trim() === '';
}

/** Mobile left office geofence → FCM with Office work / Going home choice. */
export async function POST(req: NextRequest) {
	try {
		const user = requireEmployee(req);
		const date = todayKeyIST();
		const existing = await db.attendance.findFirst({
			where: { employeeId: user.sub, date },
			orderBy: { createdAt: 'desc' },
		});
		if (!existing || !isOpen(existing)) {
			return jsonError('No open shift', 400);
		}

		void emitAttendanceUpdate(user.sub, existing, 'left-office');

		const push = await notifyPush({
			title: 'Leaving office area',
			body: 'Choose within 5 min: Office work (stay checked in) or Going home / check out. No reply → auto check-out.',
			employeeId: user.sub,
			data: {
				type: 'office_exit',
				action: 'choose',
				officeWork: 'office_work',
				goingHome: 'going_home',
			},
		});

		return Response.json({ ok: true, push, attendance: existing });
	} catch (e: any) {
		const status = e.message === 'Unauthorized' ? 401 : 500;
		return jsonError(e.message || 'Failed to notify', status);
	}
}
