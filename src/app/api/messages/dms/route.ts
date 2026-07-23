import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireEmployee } from '@/lib/api-auth';

function fullName(e: { firstName: string; middleName?: string | null; lastName: string }) {
	return [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ');
}

export async function GET(req: NextRequest) {
	try {
		const user = requireEmployee(req);
		const myId = user.sub;
		const dmRows = await db.message.findMany({
			where: { channel: { startsWith: 'dm:' } },
			orderBy: { createdAt: 'desc' },
			take: 800,
		});
		const mine = dmRows.filter((m) => m.channel.includes(myId));

		const byPeer = new Map<string, (typeof mine)[0]>();
		for (const m of mine) {
			const parts = m.channel.split(':');
			if (parts.length < 3) continue;
			const peerId = parts[1] === myId ? parts[2] : parts[1];
			if (!peerId || byPeer.has(peerId)) continue;
			byPeer.set(peerId, m);
		}

		const peerIds = [...byPeer.keys()];
		const peers = peerIds.length
			? await db.employee.findMany({
					where: { id: { in: peerIds } },
					select: {
						id: true,
						firstName: true,
						middleName: true,
						lastName: true,
						email: true,
						role: true,
						wingName: true,
						photoUrl: true,
					},
				})
			: [];
		const peerMap = Object.fromEntries(peers.map((e) => [e.id, e]));

		const threads = peerIds.map((peerId) => {
			const last = byPeer.get(peerId)!;
			const p = peerMap[peerId];
			return {
				peerId,
				channel: last.channel,
				lastMessage: last.content || (last.attachmentType ? `📎 ${last.attachmentType}` : ''),
				lastAt: last.createdAt,
				lastSenderName: last.senderName,
				peer: p
					? {
							id: p.id,
							name: fullName(p),
							email: p.email,
							role: p.role,
							wingName: p.wingName,
							hasPhoto: Boolean(p.photoUrl && String(p.photoUrl).trim()),
							photoUrl: null,
						}
					: { id: peerId, name: peerId, hasPhoto: false },
			};
		});
		threads.sort((a, b) => +new Date(b.lastAt) - +new Date(a.lastAt));
		return Response.json({ threads });
	} catch (e: any) {
		return jsonError(e.message || 'Unauthorized', e.message === 'Unauthorized' ? 401 : 500);
	}
}
