import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireEmployee } from '@/lib/api-auth';
import { employeeDisplayName, findOfficeByToken, isInsideRadius, nowTimeLabelIST, todayKeyIST } from '@/lib/attendance-geo';

function isOpenSession(row: { checkIn: string; checkOut: string | null } | null) {
  if (!row?.checkIn) return false;
  const out = row.checkOut;
  return out == null || String(out).trim() === '';
}

export async function POST(req: NextRequest) {
  try {
    const user = requireEmployee(req);
    const emp = await db.employee.findUnique({ where: { id: user.sub } });
    if (!emp) return jsonError('Employee not found', 404);

    const body = await req.json();
    const tokenRaw = body.token || body.qrToken || '';
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return jsonError('Valid lat and lng required');
    }

    const match = await findOfficeByToken(tokenRaw);
    if (!match) return jsonError('Invalid or unknown QR code');

    const date = todayKeyIST();
    const existing = await db.attendance.findFirst({
      where: { employeeId: emp.id, date },
      orderBy: { createdAt: 'desc' },
    });
    if (existing && isOpenSession(existing)) {
      return jsonError('Already on shift — clock out before checking in again', 400);
    }

    const { office, token } = match;
    const radius = office.radiusMeters || 300;
    const { within, distance } = isInsideRadius(lat, lng, office.lat, office.lng, radius);
    if (!within) {
      return Response.json(
        {
          error: `Check-in rejected: you are ${Math.round(distance)}m from ${office.name} (must be within ${radius}m)`,
          distanceMeters: Math.round(distance),
          radiusMeters: radius,
          officeName: office.name,
        },
        { status: 400 }
      );
    }

    const row = await db.attendance.create({
      data: {
        employeeId: emp.id,
        employeeName: employeeDisplayName(emp),
        date,
        checkIn: nowTimeLabelIST(),
        checkOut: null,
        status: 'Present',
      },
    });

    // Save the phone's real GPS (not office center) for Live tracking
    await db.employee.update({
      where: { id: emp.id },
      data: { lastLat: lat, lastLng: lng, lastLocationAt: new Date() },
    });

    // Check-in at office ends any open going-home trip
    await db.safetyTrip.updateMany({
      where: { employeeId: emp.id, status: 'IN_TRANSIT' },
      data: { status: 'CANCELLED', endedAt: new Date() },
    });

    return Response.json({
      attendance: row,
      officeName: office.name,
      token,
      distanceMeters: Math.round(distance),
      message: `Marked Present via QR · ${office.name}`,
    });
  } catch (e: any) {
    const status = e.message === 'Unauthorized' ? 401 : 500;
    return jsonError(e.message || 'Check-in failed', status);
  }
}
