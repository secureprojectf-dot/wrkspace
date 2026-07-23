import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, signVerificationToken } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

async function sessionFromPortalUser(user: {
	id: string;
	email: string;
	role: string;
	companyId: string | null;
	company?: { name: string } | null;
}) {
	const role = user.role === 'SUPER' ? 'SUPER' : 'COMPANY';
	const token = signVerificationToken({
		id: user.id,
		email: user.email,
		role,
		companyId: user.companyId,
		companyName: user.company?.name || null,
		source: 'portal',
	});
	await db.verificationPortalUser.update({
		where: { id: user.id },
		data: { lastLoginAt: new Date() },
	});
	return {
		token,
		user: {
			id: user.id,
			email: user.email,
			role,
			companyId: user.companyId,
			companyName: user.company?.name || null,
			source: 'portal' as const,
		},
	};
}

async function sessionFromWorkspaceAdmin(admin: { id: string; email: string; organizationName?: string | null }) {
	const token = signVerificationToken({
		id: admin.id,
		email: admin.email,
		role: 'SUPER',
		companyId: null,
		companyName: admin.organizationName || 'wrkspace',
		source: 'workspace_admin',
	});
	return {
		token,
		user: {
			id: admin.id,
			email: admin.email,
			role: 'SUPER' as const,
			companyId: null,
			companyName: admin.organizationName || 'wrkspace',
			source: 'workspace_admin' as const,
		},
	};
}

/** Email/password login for Employee Verification portal. */
export async function POST(req: NextRequest) {
	try {
		const body = await req.json().catch(() => ({}));
		const email = String(body?.email || '')
			.trim()
			.toLowerCase();
		const password = String(body?.password || '');
		if (!email || !password) return jsonError('Email and password required', 400);

		const portal = await db.verificationPortalUser.findUnique({
			where: { email },
			include: { company: { select: { name: true, active: true } } },
		});
		if (portal) {
			if (!portal.active) return jsonError('Account disabled', 403);
			if (portal.company && portal.company.active === false) {
				return jsonError('Company access disabled', 403);
			}
			if (portal.password !== password) return jsonError('Invalid credentials', 401);
			return Response.json({ ok: true, ...(await sessionFromPortalUser(portal)) });
		}

		// Workspace admins (main admin panel) may enter this portal as SUPER
		const admin = await db.admin.findUnique({ where: { email } });
		if (admin && admin.password === password && !admin.isTeamLead) {
			return Response.json({ ok: true, ...(await sessionFromWorkspaceAdmin(admin)) });
		}

		return jsonError('Invalid credentials', 401);
	} catch (e: any) {
		return jsonError(e.message || 'Login failed', 500);
	}
}
