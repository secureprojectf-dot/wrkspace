import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

async function requireAdminEmail(req: NextRequest) {
	const email = String(req.nextUrl.searchParams.get('email') || req.headers.get('x-admin-email') || '')
		.trim()
		.toLowerCase();
	if (!email) throw new Error('Unauthorized');
	const admin = await db.admin.findFirst({
		where: { email: { equals: email, mode: 'insensitive' } },
	});
	if (!admin) throw new Error('Unauthorized');
	return admin;
}

/** Admin Live safety snapshot — fetch API (avoids stale Server Action IDs after deploy). */
export async function GET(req: NextRequest) {
	try {
		await requireAdminEmail(req);

		const [incidents, trips, tokens] = await Promise.all([
			db.sosIncident.findMany({
				where: { status: 'OPEN' },
				orderBy: { createdAt: 'desc' },
				include: {
					employee: {
						select: { id: true, firstName: true, lastName: true, email: true, phone: true, gender: true },
					},
				},
			}),
			db.safetyTrip.findMany({
				where: { status: 'IN_TRANSIT' },
				orderBy: { updatedAt: 'desc' },
				include: {
					employee: {
						select: {
							id: true,
							firstName: true,
							lastName: true,
							email: true,
							gender: true,
							phone: true,
							homeLat: true,
							homeLng: true,
						},
					},
					_count: { select: { points: true } },
					points: { orderBy: { recordedAt: 'desc' }, take: 1 },
				},
			}),
			db.employee.count({ where: { fcmToken: { not: null } } }),
		]);

		const firebaseConfigured = Boolean(
			process.env.FIREBASE_SERVICE_ACCOUNT_JSON && String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON).trim()
		);

		return Response.json({
			incidents,
			trips,
			fcm: {
				tokens,
				firebaseConfigured,
				ready: tokens > 0 && firebaseConfigured,
			},
			at: new Date().toISOString(),
		});
	} catch (e: any) {
		const msg = e.message || 'Unauthorized';
		return jsonError(msg, msg === 'Unauthorized' ? 401 : 500);
	}
}
