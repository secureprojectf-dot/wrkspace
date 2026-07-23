import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireAdmin } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    const offices = await db.office.findMany({
      orderBy: { createdAt: 'desc' },
      include: { qrs: { orderBy: { createdAt: 'desc' } } },
    });
    return Response.json({ offices });
  } catch (e: any) {
    return jsonError(e.message || 'Unauthorized', e.message?.includes('Admin') ? 403 : 401);
  }
}

export async function POST(req: NextRequest) {
  try {
    requireAdmin(req);
    const body = await req.json();
    const name = String(body.name || '').trim();
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return jsonError('name, lat, lng required');
    }
    const office = await db.office.create({
      data: {
        name,
        address: body.address ? String(body.address) : null,
        lat,
        lng,
        plusCode: body.plusCode ? String(body.plusCode) : null,
        radiusMeters: Number(body.radiusMeters) || 300,
        geofenceM: Number(body.geofenceM) || 300,
        active: true,
      },
    });
    return Response.json({ office });
  } catch (e: any) {
    return jsonError(e.message || 'Failed', 500);
  }
}
