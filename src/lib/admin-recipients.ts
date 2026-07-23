import { db } from '@/lib/db';

/** Employee IDs that should get admin-facing pushes (linked Admin rows + lead roles). */
export async function resolveAdminEmployeeIds(): Promise<string[]> {
	const [admins, leads] = await Promise.all([
		db.admin.findMany({
			where: { employeeId: { not: null } },
			select: { employeeId: true },
		}),
		db.employee.findMany({
			where: {
				fcmToken: { not: null },
				OR: [
					{ role: { contains: 'Admin', mode: 'insensitive' } },
					{ role: { contains: 'CTO', mode: 'insensitive' } },
					{ role: { contains: 'Head', mode: 'insensitive' } },
					{ role: { contains: 'Team Lead', mode: 'insensitive' } },
				],
			},
			select: { id: true },
		}),
	]);

	const ids = new Set<string>();
	for (const a of admins) {
		if (a.employeeId) ids.add(a.employeeId);
	}
	for (const e of leads) ids.add(e.id);
	return [...ids];
}
