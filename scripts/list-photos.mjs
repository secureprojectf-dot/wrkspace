import { PrismaClient } from '../src/generated/prisma/index.js';

const p = new PrismaClient();
const all = await p.employee.count();
const withPhoto = await p.employee.count({ where: { photoUrl: { not: null } } });
const rows = await p.employee.findMany({
	select: { id: true, firstName: true, lastName: true, email: true, photoUrl: true },
	orderBy: { firstName: 'asc' },
});
for (const e of rows) {
	const u = e.photoUrl || '';
	console.log([e.id.slice(0, 8), e.firstName, e.lastName, e.email, u ? `YES:${u.length}` : 'NO'].join(' | '));
}
console.log('---');
console.log(`total=${all} withPhoto=${withPhoto}`);
await p.$disconnect();
