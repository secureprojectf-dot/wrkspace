import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireEmployee } from '@/lib/api-auth';
import { notifyMessagePush } from '@/lib/message-push';
import { enrichMessagesWithPhotos } from '@/lib/message-enrich';

const MAX_ATTACH_CHARS = 1_800_000; // ~1.3MB binary — stay under Vercel body limits

async function loadMessages(where: { channel?: string; OR?: any[] }, take: number) {
	const messages = await db.message.findMany({
		where,
		orderBy: { createdAt: 'asc' },
		take,
		include: { reactions: true },
	});
	return enrichMessagesWithPhotos(messages);
}

export async function GET(req: NextRequest) {
	try {
		const user = requireEmployee(req);
		const channel = (req.nextUrl.searchParams.get('channel') || 'public').trim();
		const peerId = req.nextUrl.searchParams.get('peerId');

		if (peerId) {
			const a = user.sub;
			const b = peerId;
			const sorted = [a, b].sort();
			const canonical = `dm:${sorted[0]}:${sorted[1]}`;
			const messages = await loadMessages(
				{
					OR: [
						{ channel: canonical },
						{ channel: { contains: a }, AND: [{ channel: { contains: b } }, { channel: { startsWith: 'dm:' } }] },
					],
				},
				300,
			);
			const peer = await db.employee.findUnique({
				where: { id: peerId },
				select: {
					id: true,
					firstName: true,
					middleName: true,
					lastName: true,
					email: true,
					photoUrl: true,
					role: true,
					wingName: true,
				},
			});
			const peerName = peer
				? [peer.firstName, peer.middleName, peer.lastName].filter(Boolean).join(' ')
				: peerId;
			return Response.json({
				channel: canonical,
				messages,
				peerId,
				peer: peer
					? {
							id: peer.id,
							name: peerName,
							email: peer.email,
							hasPhoto: Boolean(peer.photoUrl && String(peer.photoUrl).trim()),
							photoUrl: null,
							role: peer.role,
							wingName: peer.wingName,
						}
					: { id: peerId, name: peerId, hasPhoto: false },
			});
		}

		if (channel === 'marketing' || channel === 'technical' || channel === 'core') {
			const access = await db.channelAccessRequest.findUnique({
				where: { employeeId_channel: { employeeId: user.sub, channel } },
			});
			if (!access || access.status !== 'Approved') {
				return jsonError('Access to this channel is restricted', 403);
			}
		}

		if (channel.startsWith('dm:')) {
			const parts = channel.split(':');
			if (parts[1] !== user.sub && parts[2] !== user.sub) {
				return jsonError('Unauthorized channel access', 403);
			}
		}

		const messages = await loadMessages({ channel }, 200);
		return Response.json({ channel, messages });
	} catch (e: any) {
		const msg = e.message || 'Unauthorized';
		return jsonError(msg, msg === 'Unauthorized' ? 401 : 500);
	}
}

export async function POST(req: NextRequest) {
	try {
		const user = requireEmployee(req);
		const body = await req.json().catch(() => ({}));
		const content = String(body?.content || '').trim();
		const attachmentUrl = body?.attachmentUrl != null ? String(body.attachmentUrl) : null;
		const attachmentType = body?.attachmentType != null ? String(body.attachmentType) : null;
		const attachmentName = body?.attachmentName != null ? String(body.attachmentName) : null;
		const replyToId = body?.replyToId != null ? String(body.replyToId) : null;
		const replyPreview = body?.replyPreview != null ? String(body.replyPreview).slice(0, 180) : null;

		if (!content && !attachmentUrl) return jsonError('content or attachment required', 400);
		if (attachmentUrl && attachmentUrl.length > MAX_ATTACH_CHARS) {
			return jsonError('Attachment too large for this endpoint', 400);
		}
		if (attachmentType && !['image', 'video', 'file'].includes(attachmentType)) {
			return jsonError('Invalid attachmentType', 400);
		}

		let channel = String(body?.channel || 'public').trim();
		const peerId = body?.peerId ? String(body.peerId).trim() : null;
		if (peerId) {
			const sorted = [user.sub, peerId].sort();
			channel = `dm:${sorted[0]}:${sorted[1]}`;
		}

		const emp = await db.employee.findUnique({ where: { id: user.sub } });
		if (!emp) return jsonError('Employee not found', 404);

		if (channel === 'marketing' || channel === 'technical' || channel === 'core') {
			const access = await db.channelAccessRequest.findUnique({
				where: { employeeId_channel: { employeeId: user.sub, channel } },
			});
			if (!access || access.status !== 'Approved') {
				return jsonError('Cannot post in this chat', 403);
			}
		}

		const name = [emp.firstName, emp.middleName, emp.lastName].filter(Boolean).join(' ');
		const message = await db.message.create({
			data: {
				channel,
				senderId: emp.id,
				senderName: name,
				content: content || (attachmentType === 'image' ? '📷 Photo' : attachmentType === 'video' ? '🎬 Video' : attachmentType ? '📎 File' : ''),
				attachmentUrl,
				attachmentType,
				attachmentName,
				replyToId,
				replyPreview,
			},
			include: { reactions: true },
		});

		void notifyMessagePush({
			channel,
			senderId: emp.id,
			senderName: name,
			content: message.content,
			peerId,
		}).catch((e) => console.error('[api/messages] push failed', e));

		const [enriched] = await enrichMessagesWithPhotos([message]);
		return Response.json({
			message: {
				...enriched,
				senderHasPhoto: Boolean(emp.photoUrl && String(emp.photoUrl).trim()),
			},
			channel,
		});
	} catch (e: any) {
		const msg = e.message || 'Failed to send';
		return jsonError(msg, msg === 'Unauthorized' ? 401 : 500);
	}
}
