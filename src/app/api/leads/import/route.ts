import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireEmployee } from '@/lib/api-auth';

/** Bulk-import pipeline leads from crawler JSON (same shape as website import). */
export async function POST(req: NextRequest) {
	try {
		requireEmployee(req);
		const body = await req.json().catch(() => ({}));
		const raw = Array.isArray(body) ? body : body.leads ?? [];
		if (!Array.isArray(raw) || raw.length === 0) {
			return jsonError('No leads found in payload', 400);
		}

		const created = await db.lead.createMany({
			data: raw.map((l: any) => ({
				businessName: String(l.businessName || l.name || 'Unknown').trim(),
				contactName: l.contactName ? String(l.contactName) : null,
				email: l.email ? String(l.email) : null,
				phone: l.phone ? String(l.phone) : null,
				website: l.website ? String(l.website) : null,
				location: l.location ? String(l.location) : null,
				category: l.category ? String(l.category) : null,
				source: String(l.source || 'Import'),
				sourceUrl: l.sourceUrl ? String(l.sourceUrl) : null,
				description: l.description ? String(l.description) : null,
				rating: l.rating != null ? String(l.rating) : null,
				reviewCount: l.reviewCount != null ? String(l.reviewCount) : null,
				priority: l.priority ? String(l.priority) : 'Medium',
				notes: l.notes ? String(l.notes) : null,
				status: 'New',
				allowed: false,
			})),
			skipDuplicates: false,
		});
		return Response.json({ success: true, count: created.count });
	} catch (e: any) {
		const msg = e.message || 'Import failed';
		return jsonError(msg, msg === 'Unauthorized' ? 401 : 500);
	}
}
