import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireAdmin } from '@/lib/api-auth';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(req);
    const { id } = await ctx.params;
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.label != null) data.label = String(body.label);
    if (body.active != null) data.active = Boolean(body.active);
    const qr = await db.officeQr.update({ where: { id }, data });
    return Response.json({ qr });
  } catch (e: any) {
    return jsonError(e.message || 'Failed', 500);
  }
}
