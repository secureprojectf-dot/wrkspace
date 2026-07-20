import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireEmployee } from '@/lib/api-auth';
import { nowTimeLabelIST, todayKeyIST } from '@/lib/attendance-geo';
import { emitAttendanceUpdate } from '@/lib/realtime-emit';

export async function POST(req: NextRequest) {
  try {
    const user = requireEmployee(req);
    const date = todayKeyIST();
    const existing = await db.attendance.findFirst({
      where: { employeeId: user.sub, date },
      orderBy: { createdAt: 'desc' },
    });
    if (!existing) return jsonError('No clock-in found for today');
    if (existing.checkOut && String(existing.checkOut).trim() !== '') {
      return jsonError('Already clocked out');
    }

    const body = await req.json().catch(() => ({}));
    const reason = String(body?.reason || '').trim();

    const row = await db.attendance.update({
      where: { id: existing.id },
      data: { checkOut: nowTimeLabelIST(), status: 'Present' },
    });

    const action =
      reason === 'going_home'
        ? 'going-home'
        : reason === 'outside_geofence_timeout' || reason === 'outside_geofence'
          ? 'auto-check-out'
          : 'check-out';
    void emitAttendanceUpdate(user.sub, row, action);

    return Response.json({ attendance: row, reason: reason || 'manual' });
  } catch (e: any) {
    return jsonError(e.message || 'Unauthorized', e.message === 'Unauthorized' ? 401 : 500);
  }
}
