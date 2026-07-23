import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireEmployee } from '@/lib/api-auth';
import { employeeDisplayName } from '@/lib/attendance-geo';

/** List open SOS — same shape as Render GET /api/safety/sos/open */
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
