import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireEmployee } from '@/lib/api-auth';

const QUICK_EMOJIS = new Set(['👍', '❤️', '😂', '😮', '😢', '🙏']);

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	try {
		const user = requireEmployee(req);
		const { id } = await ctx.params;
		const body = await req.json().catch(() => ({}));
		const emoji = String(body?.emoji || '').trim();
		if (!QUICK_EMOJIS.has(emoji)) return jsonError('Unsupported emoji', 400);

		const existing = await db.message.findUnique({ where: { id } });
		if (!existing) return jsonError('Message not found', 404);

		const emp = await db.employee.findUnique({ where: { id: user.sub } });
		if (!emp) return jsonError('Employee not found', 404);
		const userName = [emp.firstName, emp.middleName, emp.lastName].filter(Boolean).join(' ');

		const prior = await db.messageReaction.findUnique({
			where: { messageId_userId_emoji: { messageId: id, userId: user.sub, emoji } },
		});
		if (prior) {
			await db.messageReaction.delete({ where: { id: prior.id } });
			return Response.json({ success: true, removed: true, emoji });
		}

		const reaction = await db.messageReaction.create({
			data: { messageId: id, userId: user.sub, userName, emoji },
		});
		return Response.json({ success: true, removed: false, reaction });
	} catch (e: any) {
		const msg = e.message || 'Failed to react';
		return jsonError(msg, msg === 'Unauthorized' ? 401 : 500);
	}
}
