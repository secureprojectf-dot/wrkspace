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

function distM(aLat: number, aLng: number, bLat: number, bLng: number) {
	const R = 6371000;
	const toR = (d: number) => (d * Math.PI) / 180;
	const dLat = toR(bLat - aLat);
	const dLng = toR(bLng - aLng);
	const x =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toR(aLat)) * Math.cos(toR(bLat)) * Math.sin(dLng / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(x));
}

/** Mobile left office geofence → FCM with Office work / Going home choice. */
export async function POST(req: NextRequest) {
	try {
		const user = requireEmployee(req);
		const body = await req.json().catch(() => ({}));
		const date = todayKeyIST();
		const existing = await db.attendance.findFirst({
			where: { employeeId: user.sub, date },
			orderBy: { createdAt: 'desc' },
		});
		if (!existing || !isOpen(existing)) {
			return jsonError('No open shift', 400);
		}

		const emp = await db.employee.findUnique({
			where: { id: user.sub },
			select: { lastLat: true, lastLng: true, lastLocationAt: true },
		});

		const bodyLat = Number(body?.lat);
		const bodyLng = Number(body?.lng);
		const lat = Number.isFinite(bodyLat)
			? bodyLat
			: emp?.lastLat != null
				? Number(emp.lastLat)
				: NaN;
		const lng = Number.isFinite(bodyLng)
			? bodyLng
			: emp?.lastLng != null
				? Number(emp.lastLng)
				: NaN;

		const offices = await db.office.findMany({
			where: { active: true },
			select: { lat: true, lng: true, geofenceM: true },
		});

		if (Number.isFinite(lat) && Number.isFinite(lng) && offices.length) {
			const stillInside = offices.some((o) => {
				const r = Math.max(Number(o.geofenceM) > 0 ? Number(o.geofenceM) : 500, 500);
				// Large soft buffer — indoor GPS noise must not send leave FCM.
				return distM(lat, lng, Number(o.lat), Number(o.lng)) <= r + 180;
			});
			if (stillInside) {
				return Response.json({
					ok: false,
					skipped: 'still_inside_office',
					attendance: existing,
				});
			}
		} else {
			// No GPS to verify — do not fan out a leave alert.
			return Response.json({
				ok: false,
				skipped: 'no_gps',
				attendance: existing,
			});
		}

		// Persist the coords used for the decision.
		await db.employee.update({
			where: { id: user.sub },
			data: { lastLat: lat, lastLng: lng, lastLocationAt: new Date() },
		});

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
