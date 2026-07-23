import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireEmployee } from '@/lib/api-auth';

function fullName(e: { firstName: string; middleName?: string | null; lastName: string }) {
	return [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ');
}

export async function GET(req: NextRequest) {
	try {
		const user = requireEmployee(req);
		const rows = await db.employee.findMany({
			where: { id: { not: user.sub } },
			orderBy: { firstName: 'asc' },
			select: {
				id: true,
				firstName: true,
				middleName: true,
				lastName: true,
				email: true,
				role: true,
				wingName: true,
				photoUrl: true,
			},
		});
		return Response.json({
			people: rows.map((e) => ({
				id: e.id,
				name: fullName(e),
				firstName: e.firstName,
				lastName: e.lastName,
				email: e.email,
				role: e.role,
				wingName: e.wingName,
				wing: e.wingName,
				// Avoid multi‑MB JSON — app loads /api/employees/:id/avatar
				hasPhoto: Boolean(e.photoUrl && String(e.photoUrl).trim()),
				photoUrl: null,
			})),
		});
	} catch (e: any) {
		return jsonError(e.message || 'Unauthorized', e.message === 'Unauthorized' ? 401 : 500);
	}
}
