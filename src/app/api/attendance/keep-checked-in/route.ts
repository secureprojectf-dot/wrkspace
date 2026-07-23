import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireEmployee } from '@/lib/api-auth';
import { todayKeyIST } from '@/lib/attendance-geo';
import { emitAttendanceUpdate } from '@/lib/realtime-emit';

function isOpen(row: { checkIn?: string | null; checkOut?: string | null } | null) {
	if (!row?.checkIn) return false;
	const out = row.checkOut;
	return out == null || String(out).trim() === '';
}

export async function POST(req: NextRequest) {
	try {
		const user = requireEmployee(req);
		const date = todayKeyIST();
		const existing = await db.attendance.findFirst({
			where: { employeeId: user.sub, date },
			orderBy: { createdAt: 'desc' },
		});
		if (!existing || !isOpen(existing)) {
			return jsonError('No open shift to keep', 400);
		}
		const body = await req.json().catch(() => ({}));
		const reason = String(body?.reason || 'office_work');
		void emitAttendanceUpdate(
			user.sub,
			existing,
			reason === 'office_work' ? 'office-work' : 'keep-checked-in',
		);
		return Response.json({
			ok: true,
			attendance: existing,
			message: 'Stay checked in — office work outside',
		});
	} catch (e: any) {
		const status = e.message === 'Unauthorized' ? 401 : 500;
		return jsonError(e.message || 'Failed', status);
	}
}
