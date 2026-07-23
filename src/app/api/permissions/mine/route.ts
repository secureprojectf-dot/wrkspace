import { NextRequest } from 'next/server';
import { jsonError, requireEmployee } from '@/lib/api-auth';

/** Minimal permissions payload so Flutter session bootstrap succeeds. */
export async function GET(req: NextRequest) {
  try {
    requireEmployee(req);
    return Response.json({
      permissions: {
        modules: {
          attendance: true,
          messages: true,
          tasks: true,
          leaves: true,
          safety: true,
          events: true,
        },
      },
    });
  } catch (e: any) {
    return jsonError(e.message || 'Unauthorized', 401);
  }
}
