import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireEmployee } from '@/lib/api-auth';
import {
	profileFromEmployee,
	sanitizeProfessionalProfile,
	type ProfessionalProfile,
} from '@/lib/employee-professional-profile';

export const dynamic = 'force-dynamic';

/** Employee updates company-facing professional profile. */
export async function PATCH(req: NextRequest) {
	try {
		const user = requireEmployee(req);
		const body = (await req.json().catch(() => ({}))) as Partial<ProfessionalProfile>;
		const data = sanitizeProfessionalProfile(body);
		const employee = await db.employee.update({
			where: { id: user.sub },
			data,
		});
		return Response.json({
			ok: true,
			employee,
			profile: profileFromEmployee(employee as any),
		});
	} catch (e: any) {
		const msg = e.message || 'Unauthorized';
		return jsonError(msg, msg === 'Unauthorized' ? 401 : 500);
	}
}

export async function GET(req: NextRequest) {
	try {
		const user = requireEmployee(req);
		const employee = await db.employee.findUnique({ where: { id: user.sub } });
		if (!employee) return jsonError('Employee not found', 404);
		return Response.json({
			ok: true,
			profile: profileFromEmployee(employee as any),
			employee,
		});
	} catch (e: any) {
		const msg = e.message || 'Unauthorized';
		return jsonError(msg, msg === 'Unauthorized' ? 401 : 500);
	}
}
