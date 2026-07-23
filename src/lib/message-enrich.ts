import { db } from '@/lib/db';

/**
 * Mark which senders have a profile photo.
 * Do NOT embed base64 here (blows past API limits) — clients load
 * GET /api/employees/:id/avatar instead.
 */
export async function enrichMessagesWithPhotos<T extends { senderId: string }>(messages: T[]) {
	if (!messages.length) {
		return messages as Array<T & { senderPhotoUrl: string | null; senderHasPhoto: boolean }>;
	}
	const ids = [...new Set(messages.map((m) => m.senderId))];
	const emps = await db.employee.findMany({
		where: { id: { in: ids } },
		select: { id: true, photoUrl: true },
	});
	const has = new Set(
		emps.filter((e) => e.photoUrl && String(e.photoUrl).trim()).map((e) => e.id),
	);
	return messages.map((m) => ({
		...m,
		senderHasPhoto: has.has(m.senderId),
		// Keep field for older clients; real bytes come from avatar endpoint.
		senderPhotoUrl: null as string | null,
	}));
}
