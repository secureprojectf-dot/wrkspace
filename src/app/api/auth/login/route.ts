import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, signEmployeeToken } from '@/lib/api-auth';
import { employeeDisplayName } from '@/lib/attendance-geo';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!email || !password) return jsonError('Email and password required');

    const emp = await db.employee.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (!emp) return jsonError('Employee not found', 404);

    const ok = emp.password === password || emp.id === password;
    if (!ok) return jsonError('Incorrect password', 401);

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
    return jsonError(e.message || 'Login failed', 500);
  }
}
