/** Heuristic company-facing insights from wrkspace history (not ML). */

export type DossierInsight = {
	strengths: string[];
	weaknesses: string[];
	flags: string[];
	priorityNotes: string[];
	scores: {
		attendanceReliability: number; // 0-100
		taskDelivery: number;
		submissionDiscipline: number;
		overall: number;
	};
};

function pct(n: number, d: number) {
	if (!d) return 0;
	return Math.round((n / d) * 100);
}

function clamp(n: number) {
	return Math.max(0, Math.min(100, Math.round(n)));
}

export function buildEmployeeInsights(input: {
	attendance: { checkIn?: string | null; checkOut?: string | null; status?: string | null; date?: string }[];
	tasks: { status?: string | null; deadline?: Date | string | null; mode?: string | null }[];
	submissions: { status?: string | null; hoursSpent?: number | null }[];
	leaves: { status?: string | null; type?: string | null }[];
	tenureDays: number;
	role?: string | null;
	wingName?: string | null;
}): DossierInsight {
	const strengths: string[] = [];
	const weaknesses: string[] = [];
	const flags: string[] = [];
	const priorityNotes: string[] = [];

	const att = input.attendance || [];
	const presentish = att.filter((a) => {
		const s = String(a.status || '').toLowerCase();
		return s.includes('present') || s.includes('checked') || Boolean(a.checkIn);
	});
	const openSessions = att.filter(
		(a) => a.checkIn && (!a.checkOut || String(a.checkOut).trim() === ''),
	);
	const attScore = att.length
		? clamp(55 + pct(presentish.length, att.length) * 0.4 - openSessions.length * 5)
		: 40;

	if (att.length >= 10 && pct(presentish.length, att.length) >= 85) {
		strengths.push('Strong attendance consistency across logged days.');
	} else if (att.length >= 5 && pct(presentish.length, att.length) < 60) {
		weaknesses.push('Attendance pattern shows frequent gaps or incomplete days.');
	}
	if (openSessions.length >= 3) {
		flags.push(`${openSessions.length} attendance rows still look open (no check-out).`);
	}

	const tasks = input.tasks || [];
	const completed = tasks.filter((t) =>
		/complete|done|closed/i.test(String(t.status || '')),
	);
	const pending = tasks.filter((t) => /pending|progress|open/i.test(String(t.status || '')));
	const overdue = tasks.filter((t) => {
		if (!t.deadline) return false;
		if (/complete|done|closed/i.test(String(t.status || ''))) return false;
		const d = new Date(t.deadline).getTime();
		return Number.isFinite(d) && d < Date.now();
	});
	const taskScore = tasks.length
		? clamp(pct(completed.length, tasks.length) * 0.7 + (100 - pct(overdue.length, tasks.length)) * 0.3)
		: 45;

	if (tasks.length >= 3 && pct(completed.length, tasks.length) >= 70) {
		strengths.push('Solid task completion rate.');
	}
	if (overdue.length > 0) {
		weaknesses.push(`${overdue.length} task(s) past deadline still open.`);
	}
	if (pending.length >= 5) {
		priorityNotes.push('High open-task load — review capacity and priorities.');
	}

	const subs = input.submissions || [];
	const approved = subs.filter((s) => /approv/i.test(String(s.status || '')));
	const needsRev = subs.filter((s) => /revision|reject/i.test(String(s.status || '')));
	const subScore = subs.length
		? clamp(50 + pct(approved.length, subs.length) * 0.4 - needsRev.length * 8)
		: 50;

	if (subs.length >= 5) {
		strengths.push('Active work-submission history (documented output).');
	}
	if (needsRev.length >= 2) {
		weaknesses.push('Multiple submissions needed revision — quality follow-up recommended.');
	}

	const leaves = input.leaves || [];
	const approvedLeaves = leaves.filter((l) => /approv/i.test(String(l.status || '')));
	if (approvedLeaves.length >= 8) {
		priorityNotes.push('Elevated approved leave count — confirm coverage planning.');
	}

	if (input.tenureDays >= 365) {
		strengths.push('Longer tenure with the organization (1+ year of history).');
	} else if (input.tenureDays < 60) {
		priorityNotes.push('Early tenure — weigh recent trends more than lifetime averages.');
	}

	if (input.role) {
		priorityNotes.push(`Current role on record: ${input.role}${input.wingName ? ` · ${input.wingName}` : ''}.`);
	}

	if (!strengths.length) strengths.push('Insufficient dense history yet — review raw logs below.');
	if (!weaknesses.length) weaknesses.push('No major automated risk signals from current logs.');

	const overall = clamp(attScore * 0.35 + taskScore * 0.4 + subScore * 0.25);

	return {
		strengths,
		weaknesses,
		flags,
		priorityNotes,
		scores: {
			attendanceReliability: attScore,
			taskDelivery: taskScore,
			submissionDiscipline: subScore,
			overall,
		},
	};
}
