import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireEmployee } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/**
 * POST { ids: string[] } → { photos: Record<id, dataUrl|null> }
 * Used by mobile Messages to load profile photos reliably in one call.
 */
export async function POST(req: NextRequest) {
	try {
		requireEmployee(req);
		const body = await req.json().catch(() => ({}));
		const ids = Array.isArray(body?.ids)
			? [...new Set(body.ids.map((x: unknown) => String(x || '').trim()).filter(Boolean))].slice(0, 60)
			: [];
		if (!ids.length) return Response.json({ photos: {} });

		const rows = await db.employee.findMany({
			where: { id: { in: ids } },
			select: { id: true, photoUrl: true },
		});
		const photos: Record<string, string | null> = {};
		for (const id of ids) photos[id] = null;
		for (const r of rows) {
			const u = (r.photoUrl || '').trim();
			photos[r.id] = u || null;
		}
		return Response.json({ photos });
	} catch (e: any) {
		const msg = e.message || 'Unauthorized';
		return jsonError(msg, msg === 'Unauthorized' ? 401 : 500);
	}
}
