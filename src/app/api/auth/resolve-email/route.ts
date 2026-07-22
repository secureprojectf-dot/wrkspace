import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireEmployee, signEmployeeToken } from '@/lib/api-auth';
import { employeeDisplayName } from '@/lib/attendance-geo';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    if (!email) return jsonError('Email required');

    const emp = await db.employee.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (!emp) return jsonError('No employee linked to this Google account', 404);

    const token = signEmployeeToken({ id: emp.id, email: emp.email, role: emp.role });
    return Response.json({
      token,
      employee: {
        id: emp.id,
        email: emp.email,
        name: employeeDisplayName(emp),
        firstName: emp.firstName,
        lastName: emp.lastName,
        wingName: emp.wingName,
        wingLeadName: emp.wingLeadName,
        role: emp.role,
        phone: emp.phone,
        photoUrl: emp.photoUrl ?? null,
        gender: emp.gender ?? 'UNSPECIFIED',
      },
    });
  } catch (e: any) {
    return jsonError(e.message || 'Resolve failed', 500);
  }
}
