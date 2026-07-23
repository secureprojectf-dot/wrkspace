import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, signAdminToken } from '@/lib/api-auth';

/** Short-lived JWT so admin UI can join Socket.IO `admins` room on Render. */
export async function POST(req: NextRequest) {
	try {
		const body = await req.json().catch(() => ({}));
		const email = String(body?.email || req.headers.get('x-admin-email') || '')
			.trim()
			.toLowerCase();
		if (!email) return jsonError('email required', 400);
		const admin = await db.admin.findUnique({ where: { email } });
		if (!admin) return jsonError('Admin not found', 404);
		const token = signAdminToken(admin);
		return Response.json({ token });
	} catch (e: any) {
		return jsonError(e?.message || 'Failed', 500);
	}
}
