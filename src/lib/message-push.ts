import { db } from '@/lib/db';
import { notifyPush } from '@/lib/push-notify';

function wingMatchesChannel(wingName: string | null | undefined, channel: string): boolean {
	const w = String(wingName || '');
	if (channel === 'technical') return /technical/i.test(w);
	if (channel === 'marketing') return /marketing|digital/i.test(w);
	if (channel === 'core') return /product|core/i.test(w);
	return false;
}

/** Resolve who should get a chat notification (never includes sender). */
export async function resolveMessageRecipients(
	channel: string,
	senderId: string,
	peerId?: string | null,
): Promise<{ employeeIds: string[]; all: boolean; peerId: string | null }> {
	const sender = String(senderId || '').trim();

	// Explicit peer (mobile DM)
	if (peerId && peerId !== sender) {
		return { employeeIds: [peerId], all: false, peerId };
	}

	// DM channel: dm:idA:idB
	if (channel.startsWith('dm:')) {
		const parts = channel.split(':');
		const a = parts[1] || '';
		const b = parts[2] || '';
		const other = a === sender ? b : b === sender ? a : '';
		if (other) return { employeeIds: [other], all: false, peerId: other };
		return { employeeIds: [], all: false, peerId: null };
	}

	// Public → everyone with a token except sender
	if (channel === 'public') {
		return { employeeIds: [], all: true, peerId: null };
	}

	// Wing / restricted channels → wing members + approved access requests
	if (channel === 'marketing' || channel === 'technical' || channel === 'core') {
		const [accessRows, employees] = await Promise.all([
			db.channelAccessRequest.findMany({
				where: { channel, status: 'Approved' },
				select: { employeeId: true },
			}),
			db.employee.findMany({
				select: { id: true, wingName: true },
			}),
		]);
		const ids = new Set<string>();
		for (const r of accessRows) {
			if (r.employeeId && r.employeeId !== sender) ids.add(r.employeeId);
		}
		for (const e of employees) {
			if (e.id !== sender && wingMatchesChannel(e.wingName, channel)) ids.add(e.id);
		}
		return { employeeIds: [...ids], all: false, peerId: null };
	}

	return { employeeIds: [], all: false, peerId: null };
}

export async function notifyMessagePush(opts: {
	channel: string;
	senderId: string;
	senderName: string;
	content: string;
	peerId?: string | null;
}) {
	const preview =
		opts.content.length > 80 ? `${opts.content.slice(0, 80)}…` : opts.content;
	const resolved = await resolveMessageRecipients(opts.channel, opts.senderId, opts.peerId);
	const title = resolved.peerId
		? `Message from ${opts.senderName}`
		: `New message in ${opts.channel}`;

	const data = {
		type: 'message',
		channel: opts.channel,
		peerId: resolved.peerId || '',
		senderId: opts.senderId,
	};

	if (resolved.all) {
		const rows = await db.employee.findMany({
			where: { fcmToken: { not: null }, NOT: { id: opts.senderId } },
			select: { id: true },
		});
		const ids = rows.map((r) => r.id);
		if (!ids.length) return { skipped: 'no_recipients' };
		return notifyPush({
			title,
			body: preview,
			data,
			employeeIds: ids,
		});
	}

	if (!resolved.employeeIds.length) return { skipped: 'no_recipients' };
	return notifyPush({
		title,
		body: preview,
		data,
		employeeIds: resolved.employeeIds,
	});
}
