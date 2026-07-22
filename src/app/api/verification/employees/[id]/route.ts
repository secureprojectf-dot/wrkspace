import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireVerification } from '@/lib/api-auth';
import { buildEmployeeInsights } from '@/lib/employee-dossier';
import { profileFromEmployee, sanitizeProfessionalProfile, type ProfessionalProfile } from '@/lib/employee-professional-profile';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** Full employee dossier for company / admin verification decisions. */
export async function GET(req: NextRequest, ctx: Ctx) {
	try {
		const user = requireVerification(req);
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
				employmentStatus: true,
				about: true,
				remarks: true,
				qualifications: true,
				certifications: true,
				experience: true,
				projects: true,
				emergencyContactName: true,
				emergencyContactPhone: true,
				emergencyContactRelation: true,
				professionalTitle: true,
				city: true,
				state: true,
				country: true,
				linkedinUrl: true,
				githubUrl: true,
				portfolioUrl: true,
				leetcodeUrl: true,
				codeforcesUrl: true,
				codechefUrl: true,
				hackerrankUrl: true,
				careerObjective: true,
				yearsOfExperience: true,
				industry: true,
				education: true,
				skills: true,
				achievements: true,
				internships: true,
				publications: true,
				customSections: true,
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

		const isAdmin = user.role === 'SUPER';

		// Public / company (outsider) viewers only get general, non-sensitive info +
		// employment status. The full company-facing professional profile (about,
		// education, skills, experience, projects, certifications, achievements,
		// internships, publications, custom sections, EC, remarks, live location)
		// is admin (SUPER) only.
		const employeeOut = isAdmin
			? { ...serialize(emp as any), name, tenureDays }
			: {
					id: emp.id,
					name,
					email: emp.email,
					phone: emp.phone,
					wingName: emp.wingName,
					wingLeadName: emp.wingLeadName,
					role: emp.role,
					gender: emp.gender,
					photoUrl: emp.photoUrl,
					createdAt: emp.createdAt?.toISOString?.() || emp.createdAt,
					employmentStatus: emp.employmentStatus || 'Active',
					tenureDays,
				};

		return Response.json({
			employee: employeeOut,
			profile: isAdmin ? profileFromEmployee(emp as any) : null,
			profileRestricted: !isAdmin,
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

/** SUPER-only: admins may fill/edit any employee's professional profile, remarks & employment status. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
	try {
		const user = requireVerification(req);
		if (user.role !== 'SUPER') return jsonError('Admin access required', 403);
		const { id } = await ctx.params;
		const employeeId = String(id || '').trim();
		if (!employeeId) return jsonError('Employee id required', 400);

		const body = (await req.json().catch(() => ({}))) as Partial<ProfessionalProfile> & {
			employmentStatus?: string;
		};

		const data: Record<string, unknown> = sanitizeProfessionalProfile(body);
		if (body.employmentStatus !== undefined) {
			const status = String(body.employmentStatus).trim();
			if (status !== 'Active' && status !== 'Inactive') {
				return jsonError('employmentStatus must be Active or Inactive', 400);
			}
			data.employmentStatus = status;
		}

		const employee = await db.employee.update({ where: { id: employeeId }, data });
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
