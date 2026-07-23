import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireEmployee } from '@/lib/api-auth';
import { enrichMessagesWithPhotos } from '@/lib/message-enrich';

const EDIT_WINDOW_MS = 10 * 60 * 1000;

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	try {
		const user = requireEmployee(req);
		const { id } = await ctx.params;
		const body = await req.json().catch(() => ({}));
		const content = String(body?.content || '').trim();
		if (!content) return jsonError('content required', 400);

		const existing = await db.message.findUnique({ where: { id } });
		if (!existing) return jsonError('Message not found', 404);
		if (existing.senderId !== user.sub) {
			return jsonError('You can only edit your own messages', 403);
		}
		if (Date.now() - new Date(existing.createdAt).getTime() > EDIT_WINDOW_MS) {
			return jsonError('Edit window expired (10 minutes)', 400);
		}

		const message = await db.message.update({
			where: { id },
			data: { content, editedAt: new Date() },
			include: { reactions: true },
		});
		const [enriched] = await enrichMessagesWithPhotos([message]);
		return Response.json({ success: true, message: enriched });
	} catch (e: any) {
		const msg = e.message || 'Failed to edit';
		return jsonError(msg, msg === 'Unauthorized' ? 401 : 500);
	}
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	try {
		const user = requireEmployee(req);
		const { id } = await ctx.params;
		const existing = await db.message.findUnique({ where: { id } });
		if (!existing) return jsonError('Message not found', 404);
		if (existing.senderId !== user.sub) {
			return jsonError('You can only delete your own messages', 403);
		}
		await db.message.delete({ where: { id } });
		return Response.json({ success: true });
	} catch (e: any) {
		const msg = e.message || 'Failed to delete';
		return jsonError(msg, msg === 'Unauthorized' ? 401 : 500);
	}
}
