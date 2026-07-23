import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, signVerificationToken } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/** After Firebase Google sign-in — portal user OR workspace admin email. */
export async function POST(req: NextRequest) {
	try {
		const body = await req.json().catch(() => ({}));
		const email = String(body?.email || '')
			.trim()
			.toLowerCase();
		if (!email) return jsonError('Google email missing', 400);

		const portal = await db.verificationPortalUser.findUnique({
			where: { email },
			include: { company: { select: { name: true, active: true } } },
		});
		if (portal) {
			if (!portal.active) return jsonError('Account disabled', 403);
			if (portal.company && portal.company.active === false) {
				return jsonError('Company access disabled', 403);
			}
			const role = portal.role === 'SUPER' ? 'SUPER' : 'COMPANY';
			const token = signVerificationToken({
				id: portal.id,
				email: portal.email,
				role,
				companyId: portal.companyId,
				companyName: portal.company?.name || null,
				source: 'portal',
			});
			await db.verificationPortalUser.update({
				where: { id: portal.id },
				data: { lastLoginAt: new Date() },
			});
			return Response.json({
				ok: true,
				token,
				user: {
					id: portal.id,
					email: portal.email,
					role,
					companyId: portal.companyId,
					companyName: portal.company?.name || null,
					source: 'portal',
				},
			});
		}

		const admin = await db.admin.findUnique({ where: { email } });
		if (admin && !admin.isTeamLead) {
			const token = signVerificationToken({
				id: admin.id,
				email: admin.email,
				role: 'SUPER',
				companyId: null,
				companyName: admin.organizationName || 'wrkspace',
				source: 'workspace_admin',
			});
			return Response.json({
				ok: true,
				token,
				user: {
					id: admin.id,
					email: admin.email,
					role: 'SUPER',
					companyId: null,
					companyName: admin.organizationName || 'wrkspace',
					source: 'workspace_admin',
				},
			});
		}

		return jsonError('No verification access for this Google account', 403);
	} catch (e: any) {
		return jsonError(e.message || 'Google login failed', 500);
	}
}
