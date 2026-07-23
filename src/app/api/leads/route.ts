import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireEmployee } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
	try {
		const user = requireEmployee(req);
		const q = (req.nextUrl.searchParams.get('q') || '').trim();
		const where: any = {
			AND: [{ OR: [{ allowed: true }, { assignedTo: user.sub }] }],
		};
		if (q) {
			where.AND.push({
				OR: [
					{ businessName: { contains: q, mode: 'insensitive' } },
					{ location: { contains: q, mode: 'insensitive' } },
					{ category: { contains: q, mode: 'insensitive' } },
				],
			});
		}
		const leads = await db.lead.findMany({
			where,
			orderBy: { updatedAt: 'desc' },
			take: 200,
		});
		return Response.json({ leads });
	} catch (e: any) {
		const msg = e.message || 'Unauthorized';
		return jsonError(msg, msg === 'Unauthorized' ? 401 : 500);
	}
}

/** Create a manual lead (employee). */
export async function POST(req: NextRequest) {
	try {
		const user = requireEmployee(req);
		const body = await req.json().catch(() => ({}));
		const businessName = String(body?.businessName || '').trim();
		if (!businessName) return jsonError('businessName is required', 400);

		const lead = await db.lead.create({
			data: {
				businessName,
				contactName: body.contactName ? String(body.contactName).trim() : null,
				email: body.email ? String(body.email).trim() : null,
				phone: body.phone ? String(body.phone).trim() : null,
				website: body.website ? String(body.website).trim() : null,
				location: body.location ? String(body.location).trim() : null,
				category: body.category ? String(body.category).trim() : null,
				description: body.description ? String(body.description).trim() : null,
				notes: body.notes ? String(body.notes).trim() : null,
				priority: body.priority ? String(body.priority) : 'Medium',
				source: 'Manual',
				assignedTo: user.sub,
				status: 'New',
				allowed: true,
			},
		});
		return Response.json({ success: true, lead });
	} catch (e: any) {
		const msg = e.message || 'Failed to create lead';
		return jsonError(msg, msg === 'Unauthorized' ? 401 : 500);
	}
}
