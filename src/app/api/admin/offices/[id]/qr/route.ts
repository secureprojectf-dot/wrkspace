import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireAdmin } from '@/lib/api-auth';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(req);
    const { id } = await ctx.params;
    const office = await db.office.findUnique({ where: { id } });
    if (!office) return jsonError('Office not found', 404);

    const body = await req.json().catch(() => ({}));
    const label = String(body.label || 'Entry').trim() || 'Entry';
    const token =
      String(body.token || '').trim() ||
      `SFQR_${Math.random().toString(36).slice(2, 10).toUpperCase()}_${Date.now().toString(36).toUpperCase()}`;

    const qr = await db.officeQr.create({
      data: { officeId: office.id, label, token, active: true },
    });
    return Response.json({ qr });
  } catch (e: any) {
    return jsonError(e.message || 'Failed', 500);
  }
}
