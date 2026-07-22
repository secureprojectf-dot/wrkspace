import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireEmployee } from '@/lib/api-auth';
import { employeeDisplayName } from '@/lib/attendance-geo';
import { encodePlusCode } from '@/lib/maps-geo';

function publicEmployee(emp: any) {
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
		wingName: emp.wingName,
		wingLeadName: emp.wingLeadName,
		role: emp.role,
		gender,
		needsGenderSetup: gender !== 'MALE' && gender !== 'FEMALE',
		isFemale: gender === 'FEMALE',
		homeLat: emp.homeLat ?? null,
		homeLng: emp.homeLng ?? null,
		homePlusCode: emp.homePlusCode ?? null,
		homeAddress: emp.homeAddress ?? null,
		homeRadiusM: emp.homeRadiusM ?? 100,
		homeEditAllowed: emp.homeEditAllowed !== false,
	};
}

export async function POST(req: NextRequest) {
	try {
		const user = requireEmployee(req);
		const body = await req.json().catch(() => ({}));

		if (body?.clear === true) {
			return jsonError('Clear home requires admin. Ask admin to Allow home setup.', 403);
		}

		const existing = await db.employee.findUnique({ where: { id: user.sub } });
		if (!existing) return jsonError('Employee not found', 404);
		const hasHome = existing.homeLat != null && existing.homeLng != null;
		if (hasHome && existing.homeEditAllowed === false) {
			return jsonError('Home location is locked. Ask admin to Allow home setup.', 403);
		}

		const lat = Number(body?.lat);
		const lng = Number(body?.lng);
		if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
			return jsonError('lat and lng required', 400);
		}
		const plus =
			body?.plusCode != null && String(body.plusCode).trim()
				? String(body.plusCode).slice(0, 32)
				: encodePlusCode(lat, lng);
		const address = body?.address != null ? String(body.address).slice(0, 500) : null;
		const radius = Number(body?.homeRadiusM);

		const emp = await db.employee.update({
			where: { id: user.sub },
			data: {
				homeLat: lat,
				homeLng: lng,
				homePlusCode: plus || null,
				homeAddress: address,
				homeRadiusM: Number.isFinite(radius) && radius > 0 ? Math.round(radius) : 100,
				homeEditAllowed: false,
			},
		});
		return Response.json({ employee: publicEmployee(emp) });
	} catch (e: any) {
		const msg = e.message || 'Unauthorized';
		return jsonError(msg, msg === 'Unauthorized' ? 401 : 500);
	}
}
