import { db } from '@/lib/db';
import { notifyPush } from '@/lib/push-notify';

const DAY_CHECKOUT_LABEL = '06:30 PM';
const DAY_CHECKOUT_MINUTES = 18 * 60 + 30;
const EVENING_CHECKOUT_LABEL = '09:30 PM';
const EVENING_CHECKOUT_MINUTES = 21 * 60 + 30;
/** Minutes before cutoff to send “still checked in” reminder. */
const REMINDER_LEAD_MINUTES = 15;

function todayStrIST() {
	return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function nowMinutesIST() {
	const istTimeStr = new Date().toLocaleTimeString('en-US', {
		timeZone: 'Asia/Kolkata',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
	});
	const [h, m] = istTimeStr.split(':').map(Number);
	return h * 60 + m;
}

function parseTimeLabelToMinutes(label: string | null | undefined): number | null {
	if (!label) return null;
	const m = String(label)
		.trim()
		.toUpperCase()
		.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
	if (!m) return null;
	let h = Number(m[1]);
	const min = Number(m[2]);
	const ap = m[3];
	if (ap === 'PM' && h !== 12) h += 12;
	if (ap === 'AM' && h === 12) h = 0;
	return h * 60 + min;
}

export function checkoutPolicyForLog(log: { checkIn?: string | null }) {
	const checkInMins = parseTimeLabelToMinutes(log.checkIn);
	const eveningSession = checkInMins != null && checkInMins >= DAY_CHECKOUT_MINUTES;
	if (eveningSession) {
		return { label: EVENING_CHECKOUT_LABEL, cutoffMins: EVENING_CHECKOUT_MINUTES };
	}
	return { label: DAY_CHECKOUT_LABEL, cutoffMins: DAY_CHECKOUT_MINUTES };
}

function isOpenSession(log: { checkOut?: string | null; status?: string | null }) {
	const out = log.checkOut;
	if (out == null || String(out).trim() === '') return true;
	return String(log.status || '') === 'Checked In';
}

/**
 * Near-checkout reminders + auto check-out with FCM.
 * Safe to call from cron and from attendance API paths.
 */
export async function processAttendanceCheckoutJobs(opts?: { notify?: boolean }) {
	const notify = opts?.notify !== false;
	const todayStr = todayStrIST();
	const nowMins = nowMinutesIST();
	const result = { reminded: 0, autoCheckedOut: 0, skipped: 0 };

	const activeLogs = await db.attendance.findMany({
		where: {
			OR: [{ checkOut: null }, { checkOut: '' }, { status: 'Checked In' }],
		},
		take: 800,
	});

	for (const log of activeLogs) {
		if (!isOpenSession(log)) {
			result.skipped++;
			continue;
		}

		const policy = checkoutPolicyForLog(log);
		const shouldClose =
			log.date < todayStr || (log.date === todayStr && nowMins >= policy.cutoffMins);

		if (shouldClose) {
			await db.attendance.update({
				where: { id: log.id },
				data: {
					checkOut: policy.label,
					status: 'Present',
					checkoutReminderSent: true,
				},
			});
			result.autoCheckedOut++;
			if (notify) {
				void notifyPush({
					title: 'Auto checked out',
					body: `You were checked out at ${policy.label} (${log.date}).`,
					employeeId: log.employeeId,
					data: {
						type: 'attendance',
						action: 'auto_checkout',
						date: log.date,
						checkOut: policy.label,
					},
				}).catch((e) => console.error('[attendance] auto-checkout push', e));
			}
			continue;
		}

		// Near-checkout reminder (same day, from T-15 until cutoff; once via flag)
		const remindAt = policy.cutoffMins - REMINDER_LEAD_MINUTES;
		const inReminderWindow =
			log.date === todayStr && nowMins >= remindAt && nowMins < policy.cutoffMins;

		if (!inReminderWindow) continue;
		if (log.checkoutReminderSent) continue;

		await db.attendance.update({
			where: { id: log.id },
			data: { checkoutReminderSent: true },
		});
		result.reminded++;
		if (notify) {
			void notifyPush({
				title: 'Checkout reminder',
				body: `Still checked in — checkout by ${policy.label} (in ~${REMINDER_LEAD_MINUTES} min).`,
				employeeId: log.employeeId,
				data: {
					type: 'attendance',
					action: 'checkout_reminder',
					date: log.date,
					checkOutDue: policy.label,
				},
			}).catch((e) => console.error('[attendance] reminder push', e));
		}
	}

	return result;
}
