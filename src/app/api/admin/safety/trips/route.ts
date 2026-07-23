import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError } from '@/lib/api-auth';
import { todayKeyIST } from '@/lib/attendance-geo';

export const dynamic = 'force-dynamic';

async function requireAdminEmail(req: NextRequest) {
	const email = String(
		req.nextUrl.searchParams.get('email') || req.headers.get('x-admin-email') || '',
	)
		.trim()
		.toLowerCase();
	if (!email) throw new Error('Unauthorized');
	const admin = await db.admin.findFirst({
		where: { email: { equals: email, mode: 'insensitive' } },
	});
	if (!admin) throw new Error('Unauthorized');
	return admin;
}

/**
 * Date-wise going-home trips + GPS trail for admin.
 * Query: date=YYYY-MM-DD (IST), employeeId?, tripId?
 */
export async function GET(req: NextRequest) {
	try {
		await requireAdminEmail(req);
		const date = String(req.nextUrl.searchParams.get('date') || todayKeyIST()).trim();
		const employeeId = String(req.nextUrl.searchParams.get('employeeId') || '').trim();
		const tripId = String(req.nextUrl.searchParams.get('tripId') || '').trim();

		if (tripId) {
			const trip = await db.safetyTrip.findUnique({
				where: { id: tripId },
				include: {
					employee: {
						select: {
							id: true,
							firstName: true,
							lastName: true,
							email: true,
							phone: true,
							gender: true,
							homeLat: true,
							homeLng: true,
						},
					},
					points: { orderBy: { recordedAt: 'asc' }, take: 2000 },
				},
			});
			if (!trip) return jsonError('Trip not found', 404);
			return Response.json({ trip, date: trip.dateKey || date });
		}

		const trips = await db.safetyTrip.findMany({
			where: {
				...(employeeId ? { employeeId } : {}),
				OR: [
					{ dateKey: date },
					{
						dateKey: null,
						startedAt: {
							gte: new Date(`${date}T00:00:00+05:30`),
							lt: new Date(`${date}T24:00:00+05:30`),
						},
					},
				],
			},
			orderBy: { startedAt: 'desc' },
			include: {
				employee: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
						email: true,
						phone: true,
						gender: true,
						homeLat: true,
						homeLng: true,
					},
				},
				_count: { select: { points: true } },
			},
			take: 100,
		});

		const females = await db.employee.findMany({
			where: { gender: 'FEMALE' },
			select: { id: true, firstName: true, lastName: true, email: true },
			orderBy: { firstName: 'asc' },
		});

		return Response.json({ date, trips, females });
	} catch (e: any) {
		const msg = e.message || 'Unauthorized';
		return jsonError(msg, msg === 'Unauthorized' ? 401 : 500);
	}
}
