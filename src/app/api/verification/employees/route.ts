import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireVerification } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/** Directory of employees for verification reviewers. */
export async function GET(req: NextRequest) {
	try {
		const authUser = requireVerification(req);
		const q = String(req.nextUrl.searchParams.get('q') || '')
			.trim()
			.toLowerCase();

		const employees = await db.employee.findMany({
			select: {
				id: true,
				firstName: true,
				middleName: true,
				lastName: true,
				email: true,
				phone: true,
				wingName: true,
				wingLeadName: true,
				role: true,
				gender: true,
				photoUrl: true,
				createdAt: true,
				lastLocationAt: true,
				employmentStatus: true,
			},
			orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
		});

		const isAdmin = authUser.role === 'SUPER';
		const rows = employees
			.map((e) => {
				const name = [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ').trim();
				return {
					id: e.id,
					name,
					email: e.email,
					phone: e.phone,
					wingName: e.wingName,
					wingLeadName: e.wingLeadName,
					role: e.role,
					gender: e.gender,
					photoUrl: e.photoUrl,
					joinedAt: e.createdAt,
					employmentStatus: e.employmentStatus || 'Active',
					// Live location is admin-only — outsiders only see general directory info.
					lastLocationAt: isAdmin ? e.lastLocationAt : null,
				};
			})
			.filter((e) => {
				if (!q) return true;
				return (
					e.name.toLowerCase().includes(q) ||
					e.email.toLowerCase().includes(q) ||
					e.phone.toLowerCase().includes(q) ||
					e.id.toLowerCase().includes(q) ||
					e.wingName.toLowerCase().includes(q)
				);
			});

		return Response.json({ employees: rows, total: rows.length, at: new Date().toISOString() });
	} catch (e: any) {
		const msg = e.message || 'Unauthorized';
		return jsonError(msg, msg === 'Unauthorized' ? 401 : 500);
	}
}
