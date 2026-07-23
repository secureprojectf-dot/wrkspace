import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireEmployee } from '@/lib/api-auth';

const PUBLIC = ['public'];
const WING_MAP: Record<string, string> = {
	marketing: 'marketing',
	technical: 'technical',
	core: 'core',
	'product wing': 'core',
	product: 'core',
};

/** Unlocked channels for the employee (Flutter /api/messages/channels). */
export async function GET(req: NextRequest) {
	try {
		const user = requireEmployee(req);
		const emp = await db.employee.findUnique({
			where: { id: user.sub },
			select: { role: true, wingName: true },
		});
		const set = new Set<string>(PUBLIC);
		const role = String(emp?.role || '').toLowerCase();
		if (role.includes('admin') || role.includes('lead')) {
			['public', 'marketing', 'technical', 'core'].forEach((c) => set.add(c));
		} else {
			const wing = String(emp?.wingName || '')
				.trim()
				.toLowerCase();
			const mapped = WING_MAP[wing];
			if (mapped) set.add(mapped);
			const approved = await db.channelAccessRequest.findMany({
				where: { employeeId: user.sub, status: 'Approved' },
				select: { channel: true },
			});
			for (const r of approved) {
				const ch = String(r.channel || '')
					.trim()
					.toLowerCase();
				if (ch && !ch.startsWith('dm:')) set.add(ch);
			}
		}
		return Response.json({ channels: [...set].sort() });
	} catch (e: any) {
		return jsonError(e.message || 'Unauthorized', e.message === 'Unauthorized' ? 401 : 500);
	}
}
