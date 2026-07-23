import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireEmployee } from '@/lib/api-auth';
import { employeeDisplayName } from '@/lib/attendance-geo';
import { emitSafetyUpdate } from '@/lib/realtime-emit';

const MAX_CHARS = 450_000; // ~337KB base64 → keep Neon row reasonable

function normalizePhoto(raw: string): string | null {
	const s = String(raw || '').trim();
	if (!s) return null;
	if (s.startsWith('data:image/') && s.includes(';base64,')) {
		if (s.length > MAX_CHARS) throw new Error('Photo too large — try a smaller image');
		return s;
	}
	if (/^https?:\/\//i.test(s) && s.length < 2048) return s;
	throw new Error('Invalid photo format');
}

export async function POST(req: NextRequest) {
	try {
		const user = requireEmployee(req);
		const body = await req.json().catch(() => ({}));
		const photoUrl = normalizePhoto(String(body?.photoUrl || body?.photoBase64 || ''));
		if (!photoUrl) return jsonError('photoUrl required', 400);

		const emp = await db.employee.update({
			where: { id: user.sub },
			data: { photoUrl },
		});

		void emitSafetyUpdate('photo_updated', {
			employeeId: emp.id,
			hasPhoto: true,
		});

		const gender = String(emp.gender || 'UNSPECIFIED').toUpperCase();
		return Response.json({
			employee: {
				id: emp.id,
				employeeCode: emp.id,
				email: emp.email,
				name: employeeDisplayName(emp),
				firstName: emp.firstName,
				lastName: emp.lastName,
				photoUrl: emp.photoUrl,
				gender,
				role: emp.role,
				phone: emp.phone,
				wingName: emp.wingName,
				wingLeadName: emp.wingLeadName,
			},
		});
	} catch (e: any) {
		const msg = e.message || 'Upload failed';
		const status = msg === 'Unauthorized' ? 401 : msg.includes('too large') || msg.includes('Invalid') ? 400 : 500;
		return jsonError(msg, status);
	}
}

export async function DELETE(req: NextRequest) {
	try {
		const user = requireEmployee(req);
		const emp = await db.employee.update({
			where: { id: user.sub },
			data: { photoUrl: null },
		});
		void emitSafetyUpdate('photo_updated', {
			employeeId: emp.id,
			hasPhoto: false,
		});
		return Response.json({ employee: { id: emp.id, photoUrl: null } });
	} catch (e: any) {
		return jsonError(e.message || 'Unauthorized', 401);
	}
}
