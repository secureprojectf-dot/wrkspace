import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireVerification } from '@/lib/api-auth';
import { buildEmployeeInsights } from '@/lib/employee-dossier';
import { profileFromEmployee } from '@/lib/employee-professional-profile';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** Full employee dossier for company / admin verification decisions. */
export async function GET(req: NextRequest, ctx: Ctx) {
	try {
		requireVerification(req);
		const { id } = await ctx.params;
		const employeeId = String(id || '').trim();
		if (!employeeId) return jsonError('Employee id required', 400);

		const emp = await db.employee.findUnique({
			where: { id: employeeId },
			select: {
				id: true,
				firstName: true,
				middleName: true,
				lastName: true,
				email: true,
				phone: true,
				wingName: true,
				wingLeadName: true,
				role: true,
				gender: true,
				photoUrl: true,
				idCardUrl: true,
				homeAddress: true,
				homePlusCode: true,
				createdAt: true,
				lastLat: true,
				lastLng: true,
				lastLocationAt: true,
				about: true,
				remarks: true,
				qualifications: true,
				certifications: true,
				experience: true,
				projects: true,
				emergencyContactName: true,
				emergencyContactPhone: true,
				emergencyContactRelation: true,
			},
		});
		if (!emp) return jsonError('Employee not found', 404);

		const [attendance, tasks, submissions, leaves, events, sosCount, trips] = await Promise.all([
			db.attendance.findMany({
				where: { employeeId },
				orderBy: { date: 'desc' },
				take: 120,
			}),
			db.task.findMany({
				where: {
					OR: [{ assigneeId: employeeId }, { assigneeId: 'ALL' }],
				},
				orderBy: { createdAt: 'desc' },
				take: 80,
			}),
			db.workSubmission.findMany({
				where: { employeeId },
				orderBy: { submittedAt: 'desc' },
				take: 80,
			}),
			db.leave.findMany({
				where: { employeeId },
				orderBy: { createdAt: 'desc' },
				take: 60,
			}),
			db.event.findMany({
				where: { allowed: true },
				orderBy: { startDate: 'desc' },
				take: 100,
			}),
			db.sosIncident.count({ where: { employeeId } }),
			db.safetyTrip.findMany({
				where: { employeeId },
				orderBy: { startedAt: 'desc' },
				take: 20,
				select: {
					id: true,
					status: true,
					dateKey: true,
					startedAt: true,
					endedAt: true,
					lat: true,
					lng: true,
				},
			}),
		]);

		const name = [emp.firstName, emp.middleName, emp.lastName].filter(Boolean).join(' ').trim();
		const myEvents = events.filter((ev) => {
			try {
				const reps = JSON.parse(ev.representatives || '[]') as { id?: string }[];
				return Array.isArray(reps) && reps.some((r) => r?.id === employeeId);
			} catch {
				return String(ev.representatives || '').includes(employeeId);
			}
		});

		const tenureDays = Math.max(
			0,
			Math.floor((Date.now() - new Date(emp.createdAt).getTime()) / 86_400_000),
		);

		const insights = buildEmployeeInsights({
			attendance,
			tasks,
			submissions,
			leaves,
			tenureDays,
			role: emp.role,
			wingName: emp.wingName,
		});

		const serialize = <T extends Record<string, unknown>>(row: T) => {
			const out: Record<string, unknown> = { ...row };
			for (const [k, v] of Object.entries(out)) {
				if (v instanceof Date) out[k] = v.toISOString();
			}
			return out;
		};

		return Response.json({
			employee: {
				...serialize(emp as any),
				name,
				tenureDays,
			},
			profile: profileFromEmployee(emp as any),
			insights,
			summary: {
				attendanceDays: attendance.length,
				tasksTotal: tasks.length,
				tasksCompleted: tasks.filter((t) => /complete|done|closed/i.test(t.status)).length,
				submissionsTotal: submissions.length,
				leavesTotal: leaves.length,
				eventsAsRep: myEvents.length,
				sosCount,
				safetyTrips: trips.length,
			},
			attendance: attendance.map((a) => serialize(a as any)),
			tasks: tasks.map((t) => serialize(t as any)),
			submissions: submissions.map((s) => serialize(s as any)),
			leaves: leaves.map((l) => serialize(l as any)),
			events: myEvents.map((e) => ({
				id: e.id,
				title: e.title,
				startDate: e.startDate?.toISOString?.() || e.startDate,
				endDate: e.endDate?.toISOString?.() || e.endDate,
				venueAddress: e.venueAddress,
				organisingCollege: e.organisingCollege,
			})),
			safetyTrips: trips.map((t) => serialize(t as any)),
			at: new Date().toISOString(),
		});
	} catch (e: any) {
		const msg = e.message || 'Unauthorized';
		return jsonError(msg, msg === 'Unauthorized' ? 401 : 500);
	}
}
