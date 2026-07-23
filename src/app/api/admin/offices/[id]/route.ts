import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireAdmin } from '@/lib/api-auth';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(req);
    const { id } = await ctx.params;
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.name != null) data.name = String(body.name);
    if (body.address != null) data.address = String(body.address);
    if (body.lat != null) data.lat = Number(body.lat);
    if (body.lng != null) data.lng = Number(body.lng);
    if (body.plusCode !== undefined) data.plusCode = body.plusCode ? String(body.plusCode) : null;
    if (body.radiusMeters != null) data.radiusMeters = Number(body.radiusMeters);
    if (body.geofenceM != null) data.geofenceM = Number(body.geofenceM);
    if (body.active != null) data.active = Boolean(body.active);
    const office = await db.office.update({ where: { id }, data });
    return Response.json({ office });
  } catch (e: any) {
    return jsonError(e.message || 'Failed', 500);
  }
}
