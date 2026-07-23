import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireEmployee } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  try {
    const user = requireEmployee(req);
    const rows = await db.attendance.findMany({
      where: { employeeId: user.sub },
      orderBy: { createdAt: 'desc' },
      take: 60,
    });
    return Response.json({ attendance: rows });
  } catch (e: any) {
    return jsonError(e.message || 'Unauthorized', 401);
  }
}
