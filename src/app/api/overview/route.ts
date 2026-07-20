import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireEmployee } from '@/lib/api-auth';
import { eventHasRepresentative } from '@/lib/event-reps';
import { todayKeyIST } from '@/lib/attendance-geo';

/**
 * Employee home/overview stats — aligned with website employee dashboard tiles.
 */
export async function GET(req: NextRequest) {
	try {
		const user = requireEmployee(req);
		const uid = user.sub;
		const date = todayKeyIST();

		const [tasks, leavesPending, submissions, leadsActive, allEvents, todayAttendance] =
			await Promise.all([
				db.task.findMany({
					where: {
						OR: [{ assigneeId: uid }, { assigneeId: 'ALL' }],
					},
					select: { status: true },
				}),
				db.leave.count({ where: { employeeId: uid, status: 'Pending' } }),
				db.workSubmission.findMany({
					where: { employeeId: uid },
					select: { status: true },
				}),
				db.lead.count({
					where: {
						assignedTo: uid,
						status: { notIn: ['Won', 'Lost'] },
					},
				}),
				db.event.findMany({
					where: { allowed: true },
					select: { representatives: true },
				}),
				db.attendance.findFirst({
					where: { employeeId: uid, date },
					orderBy: { createdAt: 'desc' },
				}),
			]);

		const tasksTotal = tasks.length;
		const tasksPending = tasks.filter((t) => t.status !== 'Completed').length;
		const tasksPendingOnly = tasks.filter((t) => t.status === 'Pending').length;
		const submissionsTotal = submissions.length;
		const submissionsPending = submissions.filter((s) => s.status === 'Submitted').length;
		const eventsCount = allEvents.filter((e) =>
			eventHasRepresentative(e.representatives, uid),
		).length;

		return Response.json({
			overview: {
				tasksTotal,
				tasksPending,
				tasksPendingOnly,
				leavesPending,
				submissionsTotal,
				submissionsPending,
				leadsActive,
				eventsCount,
				attendanceToday: todayAttendance,
			},
		});
	} catch (e: any) {
		return jsonError(e.message || 'Unauthorized', e.message === 'Unauthorized' ? 401 : 500);
	}
}
