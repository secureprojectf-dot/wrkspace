import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireEmployee } from '@/lib/api-auth';
import { employeeDisplayName } from '@/lib/attendance-geo';

function publicEmployee(emp: {
	id: string;
	email: string;
	firstName: string;
	middleName?: string | null;
	lastName: string;
	wingName: string;
	wingLeadName: string;
	role: string;
	phone: string;
	gender?: string | null;
	createdAt?: Date;
}) {
	const gender = String(emp.gender || 'UNSPECIFIED').toUpperCase();
	return {
		id: emp.id,
		employeeCode: emp.id,
		email: emp.email,
		firstName: emp.firstName,
		middleName: emp.middleName,
		lastName: emp.lastName,
		name: employeeDisplayName(emp),
		phone: emp.phone,
		wing: emp.wingName,
		wingName: emp.wingName,
		wingLead: emp.wingLeadName,
		wingLeadName: emp.wingLeadName,
		role: emp.role,
		gender,
		needsGenderSetup: gender !== 'MALE' && gender !== 'FEMALE',
		isFemale: gender === 'FEMALE',
		createdAt: emp.createdAt,
	};
}

/** Mobile gender setup — updates Neon directly (works even if Render API is stale). */
export async function POST(req: NextRequest) {
	try {
		const user = requireEmployee(req);
		const body = await req.json().catch(() => ({}));
		const gender = String(body?.gender || '')
			.trim()
			.toUpperCase();
		if (gender !== 'MALE' && gender !== 'FEMALE') {
			return jsonError('gender must be MALE or FEMALE', 400);
		}
		const emp = await db.employee.update({
			where: { id: user.sub },
			data: { gender },
		});
		return Response.json({ employee: publicEmployee(emp) });
	} catch (e: any) {
		const msg = e.message || 'Unauthorized';
		return jsonError(msg, msg === 'Unauthorized' ? 401 : 500);
	}
}
