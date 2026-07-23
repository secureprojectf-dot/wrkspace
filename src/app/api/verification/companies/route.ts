import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireVerification } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

function requireSuper(req: NextRequest) {
	const user = requireVerification(req);
	if (user.role !== 'SUPER') throw new Error('Super access required');
	return user;
}

/** List companies + portal users (SUPER only). */
export async function GET(req: NextRequest) {
	try {
		requireSuper(req);
		const [companies, users] = await Promise.all([
			db.verificationCompany.findMany({
				orderBy: { createdAt: 'desc' },
				include: { _count: { select: { users: true } } },
			}),
			db.verificationPortalUser.findMany({
				orderBy: { createdAt: 'desc' },
				include: { company: { select: { id: true, name: true } } },
			}),
		]);
		return Response.json({
			companies: companies.map((c) => ({
				...c,
				createdAt: c.createdAt.toISOString(),
				userCount: c._count.users,
			})),
			users: users.map((u) => ({
				id: u.id,
				email: u.email,
				displayName: u.displayName,
				role: u.role,
				active: u.active,
				companyId: u.companyId,
				companyName: u.company?.name || null,
				createdAt: u.createdAt.toISOString(),
				lastLoginAt: u.lastLoginAt?.toISOString() || null,
				password: u.password,
			})),
		});
	} catch (e: any) {
		const msg = e.message || 'Unauthorized';
		const status = msg === 'Unauthorized' || msg === 'Super access required' ? 401 : 500;
		return jsonError(msg, status === 401 && msg === 'Super access required' ? 403 : status);
	}
}

/**
 * Create company and/or company verifier login.
 * body: {
 *   action: 'create_company' | 'create_user' | 'set_active'
 *   name?, contactEmail?, contactPhone?, notes?
 *   email?, password?, displayName?, companyId?, role?
 *   userId?, active?
 * }
 */
export async function POST(req: NextRequest) {
	try {
		const actor = requireSuper(req);
		const body = await req.json().catch(() => ({}));
		const action = String(body?.action || '').trim();

		if (action === 'create_company') {
			const name = String(body?.name || '').trim();
			if (!name) return jsonError('Company name required', 400);
			const company = await db.verificationCompany.create({
				data: {
					name,
					contactEmail: String(body?.contactEmail || '').trim() || null,
					contactPhone: String(body?.contactPhone || '').trim() || null,
					notes: String(body?.notes || '').trim() || null,
					createdBy: actor.email,
				},
			});
			return Response.json({ ok: true, company });
		}

		if (action === 'create_user') {
			const email = String(body?.email || '')
				.trim()
				.toLowerCase();
			const password = String(body?.password || '').trim();
			const role = String(body?.role || 'COMPANY').toUpperCase() === 'SUPER' ? 'SUPER' : 'COMPANY';
			const companyId = String(body?.companyId || '').trim() || null;
			if (!email || !password) return jsonError('email and password required', 400);
			if (role === 'COMPANY' && !companyId) {
				return jsonError('companyId required for COMPANY users', 400);
			}
			const existing = await db.verificationPortalUser.findUnique({ where: { email } });
			if (existing) return jsonError('User already exists', 409);

			const user = await db.verificationPortalUser.create({
				data: {
					email,
					password,
					displayName: String(body?.displayName || '').trim() || null,
					role,
					companyId: role === 'SUPER' ? null : companyId,
				},
				include: { company: { select: { name: true } } },
			});
			return Response.json({
				ok: true,
				user: {
					id: user.id,
					email: user.email,
					password: user.password,
					role: user.role,
					companyName: user.company?.name || null,
				},
				shareHint: `Share login: ${user.email} / ${user.password} → /employee-verification`,
			});
		}

		if (action === 'set_active') {
			const userId = String(body?.userId || '').trim();
			const active = Boolean(body?.active);
			if (!userId) return jsonError('userId required', 400);
			const user = await db.verificationPortalUser.update({
				where: { id: userId },
				data: { active },
			});
			return Response.json({ ok: true, user: { id: user.id, active: user.active } });
		}

		return jsonError('Unknown action', 400);
	} catch (e: any) {
		const msg = e.message || 'Unauthorized';
		const status = msg === 'Unauthorized' ? 401 : msg === 'Super access required' ? 403 : 500;
		return jsonError(msg, status);
	}
}
