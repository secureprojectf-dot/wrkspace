import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const FRESH_MS = 5 * 60 * 1000; // seen in last 5 min = live

async function requireAdminEmail(req: NextRequest) {
	const email = String(
		req.nextUrl.searchParams.get('email') ||
			req.headers.get('x-admin-email') ||
			'',
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

async function getOrCreateConfig() {
	return db.liveTrackConfig.upsert({
		where: { id: 'global' },
		create: { id: 'global', active: false },
		update: {},
	});
}

/** Snapshot of employees with last known GPS for admin live map.
 * Each pin is that employee's own lastLat/lastLng from their phone — never office center.
 */
export async function GET(req: NextRequest) {
	try {
		await requireAdminEmail(req);
		const config = await getOrCreateConfig();
		const [employees, offices] = await Promise.all([
			db.employee.findMany({
				select: {
					id: true,
					firstName: true,
					middleName: true,
					lastName: true,
					email: true,
					phone: true,
					wingName: true,
					role: true,
					photoUrl: true,
					lastLat: true,
					lastLng: true,
					lastLocationAt: true,
					liveTrackActive: true,
				},
				orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
			}),
			db.office.findMany({
				where: { active: true },
				select: { id: true, name: true, lat: true, lng: true },
			}),
		]);

		const now = Date.now();
		const rows = employees.map((e) => {
			const at = e.lastLocationAt ? new Date(e.lastLocationAt).getTime() : 0;
			const hasLoc =
				e.lastLat != null &&
				e.lastLng != null &&
				Number.isFinite(e.lastLat) &&
				Number.isFinite(e.lastLng);
			const ageMs = at ? now - at : null;
			const isLive = Boolean(hasLoc && ageMs != null && ageMs >= 0 && ageMs <= FRESH_MS);
			const name = [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ').trim();

			let nearOfficeName: string | null = null;
			if (hasLoc) {
				for (const o of offices) {
					const dLat = ((e.lastLat! - o.lat) * Math.PI) / 180;
					const dLng = ((e.lastLng! - o.lng) * Math.PI) / 180;
					const a =
						Math.sin(dLat / 2) ** 2 +
						Math.cos((e.lastLat! * Math.PI) / 180) *
							Math.cos((o.lat * Math.PI) / 180) *
							Math.sin(dLng / 2) ** 2;
					const meters = 2 * 6371000 * Math.asin(Math.sqrt(a));
					if (meters <= 100) {
						nearOfficeName = o.name;
						break;
					}
				}
			}

			return {
				id: e.id,
				name,
				email: e.email,
				phone: e.phone,
				wingName: e.wingName,
				role: e.role,
				photoUrl: e.photoUrl,
				lat: hasLoc ? e.lastLat : null,
				lng: hasLoc ? e.lastLng : null,
				lastLocationAt: e.lastLocationAt,
				ageMs,
				isLive,
				hasLocation: hasLoc,
				liveTrackActive: e.liveTrackActive,
				nearOfficeName,
				mapsUrl: hasLoc
					? `https://www.google.com/maps/search/?api=1&query=${e.lastLat},${e.lastLng}`
					: null,
			};
		});

		const withLocation = rows.filter((r) => r.hasLocation);
		const live = rows.filter((r) => r.isLive);

		return Response.json({
			global: {
				active: config.active,
				startedAt: config.startedAt,
				startedBy: config.startedBy,
				updatedAt: config.updatedAt,
			},
			employees: rows,
			stats: {
				total: rows.length,
				withLocation: withLocation.length,
				live: live.length,
				personalActive: rows.filter((r) => r.liveTrackActive).length,
			},
			note: 'Each pin is that employee phone GPS (lastLat/lastLng), not office coordinates.',
			at: new Date().toISOString(),
		});
	} catch (e: any) {
		const msg = e.message || 'Unauthorized';
		return jsonError(msg, msg === 'Unauthorized' ? 401 : 500);
	}
}

/**
 * body: { email, action: 'start_all' | 'stop_all' | 'start_one' | 'stop_one', employeeId? }
 */
export async function POST(req: NextRequest) {
	try {
		const admin = await requireAdminEmail(req);
		const body = await req.json().catch(() => ({}));
		const action = String(body?.action || '').trim();
		const employeeId = String(body?.employeeId || '').trim();

		if (action === 'start_all') {
			const config = await db.liveTrackConfig.upsert({
				where: { id: 'global' },
				create: {
					id: 'global',
					active: true,
					startedAt: new Date(),
					startedBy: admin.email,
				},
				update: {
					active: true,
					startedAt: new Date(),
					startedBy: admin.email,
				},
			});
			return Response.json({ ok: true, global: config });
		}

		if (action === 'stop_all') {
			const config = await db.liveTrackConfig.upsert({
				where: { id: 'global' },
				create: { id: 'global', active: false },
				update: { active: false },
			});
			// Also clear personal flags so nothing keeps pinging
			await db.employee.updateMany({
				where: { liveTrackActive: true },
				data: { liveTrackActive: false },
			});
			return Response.json({ ok: true, global: config });
		}

		if (action === 'start_one' || action === 'stop_one') {
			if (!employeeId) return jsonError('employeeId required', 400);
			const active = action === 'start_one';
			const emp = await db.employee.update({
				where: { id: employeeId },
				data: { liveTrackActive: active },
				select: {
					id: true,
					firstName: true,
					lastName: true,
					liveTrackActive: true,
					lastLat: true,
					lastLng: true,
					lastLocationAt: true,
				},
			});
			return Response.json({ ok: true, employee: emp });
		}

		return jsonError('Unknown action', 400);
	} catch (e: any) {
		const msg = e.message || 'Unauthorized';
		return jsonError(msg, msg === 'Unauthorized' ? 401 : 500);
	}
}
