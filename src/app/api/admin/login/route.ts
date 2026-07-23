import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { jsonError, requireAdmin, signAdminToken } from '@/lib/api-auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!email || !password) return jsonError('Email and password required');

    const admin = await db.admin.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (!admin) return jsonError('Not an admin account', 403);
    if (admin.password !== password) return jsonError('Incorrect password', 401);

    const token = signAdminToken(admin);
    return Response.json({
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        allowedPages: (admin.allowedPages || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        isTeamLead: admin.isTeamLead,
        organizationName: admin.organizationName,
      },
    });
  } catch (e: any) {
    return jsonError(e.message || 'Admin login failed', 500);
  }
}
