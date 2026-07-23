import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireEmployee } from '@/lib/api-auth';
import { todayKeyIST } from '@/lib/attendance-geo';

export async function GET(req: NextRequest) {
  try {
    const user = requireEmployee(req);
    const date = todayKeyIST();
    const row = await db.attendance.findFirst({
      where: { employeeId: user.sub, date },
      orderBy: { createdAt: 'desc' },
    });
    return Response.json({ date, attendance: row });
  } catch (e: any) {
    return jsonError(e.message || 'Unauthorized', 401);
  }
}
