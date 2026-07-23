import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireEmployee } from '@/lib/api-auth';
import { checkoutDecisionForLog } from '@/lib/attendance-cron';
import { emitAttendanceUpdate } from '@/lib/realtime-emit';
import { notifyPush } from '@/lib/push-notify';
import { todayKeyIST, nowTimeLabelIST } from '@/lib/attendance-geo';

function nowMinutesIST() {
	const istTimeStr = new Date().toLocaleTimeString('en-US', {
		timeZone: 'Asia/Kolkata',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
	});
	const [h, m] = istTimeStr.split(':').map(Number);
	return h * 60 + m;
}

/** Continuous GPS heartbeat while app is monitoring / checked in. */
export async function POST(req: NextRequest) {
	try {
		const user = requireEmployee(req);
		const body = await req.json().catch(() => ({}));
		const lat = Number(body?.lat);
		const lng = Number(body?.lng);
		if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
			return jsonError('lat/lng required', 400);
		}
		const emp = await db.employee.update({
			where: { id: user.sub },
			data: { lastLat: lat, lastLng: lng, lastLocationAt: new Date() },
			select: { id: true, lastLat: true, lastLng: true, lastLocationAt: true },
		});

		// While phone is posting GPS, also enforce staged auto-checkout (Hobby cron only runs twice/day).
		let autoCheckedOut: unknown = null;
		try {
			const todayStr = todayKeyIST();
			const nowMins = nowMinutesIST();
			const open = await db.attendance.findFirst({
				where: { employeeId: user.sub, date: todayStr },
				orderBy: { createdAt: 'desc' },
			});
			const openOk =
				open &&
				(open.checkOut == null ||
					String(open.checkOut).trim() === '' ||
					String(open.status || '') === 'Checked In');
			if (openOk && open) {
				const decision = checkoutDecisionForLog(open, todayStr, nowMins);
				if (decision?.shouldClose) {
					const row = await db.attendance.update({
						where: { id: open.id },
						data: {
							checkOut: decision.label || nowTimeLabelIST(),
							status: 'Present',
							checkoutReminderSent: true,
						},
					});
					autoCheckedOut = row;
					void emitAttendanceUpdate(user.sub, row, 'auto-check-out');
					void notifyPush({
						title: 'Auto checked out',
						body: `You were checked out at ${decision.label} (${open.date}).`,
						employeeId: user.sub,
						data: {
							type: 'attendance',
							action: 'auto_checkout',
							date: open.date,
							checkOut: decision.label,
							reason: decision.reason,
						},
					});
				}
			}
			// Also sweep previous-day leftovers for this employee
			const stale = await db.attendance.findMany({
				where: {
					employeeId: user.sub,
					date: { lt: todayStr },
					OR: [{ checkOut: null }, { checkOut: '' }, { status: 'Checked In' }],
				},
				take: 5,
			});
			for (const log of stale) {
				const row = await db.attendance.update({
					where: { id: log.id },
					data: { checkOut: '12:00 AM', status: 'Present', checkoutReminderSent: true },
				});
				void emitAttendanceUpdate(user.sub, row, 'auto-check-out');
			}
		} catch (e) {
			console.warn('[location] auto-checkout side effect', e);
		}

		return Response.json({ ok: true, location: emp, autoCheckedOut });
	} catch (e: any) {
		const status = e.message === 'Unauthorized' ? 401 : 500;
		return jsonError(e.message || 'Failed', status);
	}
}
