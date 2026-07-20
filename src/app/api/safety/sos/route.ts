import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireEmployee } from '@/lib/api-auth';
import { employeeDisplayName } from '@/lib/attendance-geo';
import { notifyPush } from '@/lib/push-notify';

/** Mobile / web SOS create — writes Neon + FCM fan-out with name + phone. */
export async function POST(req: NextRequest) {
	try {
		const user = requireEmployee(req);
		const emp = await db.employee.findUnique({ where: { id: user.sub } });
		if (!emp) return jsonError('Employee not found', 404);
		if (String(emp.gender || '').toUpperCase() !== 'FEMALE') {
			return jsonError('SOS is only available for female employees', 403);
		}

		const body = await req.json().catch(() => ({}));
		const lat = Number(body?.lat);
		const lng = Number(body?.lng);
		if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
			return jsonError('lat and lng required', 400);
		}
		const note = body?.note != null ? String(body.note).slice(0, 500) : null;
		const name = employeeDisplayName(emp);
		const phone = String(emp.phone || '').trim();

		await db.sosIncident.updateMany({
			where: { employeeId: emp.id, status: 'OPEN' },
			data: { status: 'RESOLVED', resolvedAt: new Date() },
		});

		const incident = await db.sosIncident.create({
			data: {
				employeeId: emp.id,
				status: 'OPEN',
				lat,
				lng,
				note,
			},
		});

		const push = await notifyPush({
			title: 'SOS — employee needs help',
			body: `${name}${phone ? ` · ${phone}` : ''} triggered SOS. Open wrkspace for live location.`,
			all: true,
			data: {
				type: 'sos',
				incidentId: incident.id,
				employeeId: emp.id,
				employeeName: name,
				phone,
				lat: String(lat),
				lng: String(lng),
			},
		});

		return Response.json({
			incident: {
				...incident,
				employee: {
					id: emp.id,
					firstName: emp.firstName,
					lastName: emp.lastName,
					name,
					phone,
					email: emp.email,
				},
				mapsUrl: `https://www.google.com/maps?q=${lat},${lng}`,
			},
			push,
		});
	} catch (e: any) {
		const msg = e.message || 'Unauthorized';
		return jsonError(msg, msg === 'Unauthorized' ? 401 : 500);
	}
}

export async function GET(req: NextRequest) {
	try {
		requireEmployee(req);
		const rows = await db.sosIncident.findMany({
			where: { status: 'OPEN' },
			orderBy: { createdAt: 'desc' },
			include: {
				employee: {
					select: {
						id: true,
						firstName: true,
						middleName: true,
						lastName: true,
						email: true,
						phone: true,
						gender: true,
					},
				},
			},
		});
		return Response.json({
			incidents: rows.map((r) => ({
				id: r.id,
				status: r.status,
				lat: r.lat,
				lng: r.lng,
				note: r.note,
				createdAt: r.createdAt,
				updatedAt: r.updatedAt,
				employee: {
					id: r.employee.id,
					firstName: r.employee.firstName,
					lastName: r.employee.lastName,
					name: employeeDisplayName(r.employee),
					phone: r.employee.phone,
					email: r.employee.email,
				},
				mapsUrl: `https://www.google.com/maps?q=${r.lat},${r.lng}`,
			})),
		});
	} catch (e: any) {
		const msg = e.message || 'Unauthorized';
		return jsonError(msg, msg === 'Unauthorized' ? 401 : 500);
	}
}
