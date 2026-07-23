import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

function photoToBuffer(raw: string | null | undefined) {
	const s = String(raw || '').trim();
	if (!s) return null;
	if (s.startsWith('data:')) {
		const i = s.indexOf('base64,');
		if (i < 0) return null;
		const semi = s.indexOf(';');
		const contentType = (semi > 5 ? s.slice(5, semi) : 'image/jpeg') || 'image/jpeg';
		return { contentType, buf: Buffer.from(s.slice(i + 7), 'base64') };
	}
	if (s.startsWith('http://') || s.startsWith('https://')) return { redirect: s };
	return { contentType: 'image/jpeg', buf: Buffer.from(s, 'base64') };
}

/** Admin Messages / directory — load avatar without employee JWT. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	try {
		const email = String(
			req.nextUrl.searchParams.get('email') || req.headers.get('x-admin-email') || '',
		)
			.trim()
			.toLowerCase();
		if (!email) return jsonError('Unauthorized', 401);
		const admin = await db.admin.findFirst({
			where: { email: { equals: email, mode: 'insensitive' } },
		});
		if (!admin) return jsonError('Unauthorized', 401);

		const { id } = await ctx.params;
		const emp = await db.employee.findUnique({
			where: { id: String(id || '').trim() },
			select: { photoUrl: true },
		});
		const parsed = photoToBuffer(emp?.photoUrl);
		if (!parsed) return new Response('Not found', { status: 404 });
		if ('redirect' in parsed && parsed.redirect) {
			return Response.redirect(parsed.redirect, 302);
		}
		return new Response(parsed.buf, {
			status: 200,
			headers: {
				'Content-Type': parsed.contentType || 'image/jpeg',
				'Cache-Control': 'private, max-age=300',
			},
		});
	} catch (e: any) {
		return jsonError(e.message || 'Failed', 500);
	}
}
