import { db } from '@/lib/db';

const EARTH_RADIUS_M = 6371000;

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export function isInsideRadius(
  userLat: number,
  userLng: number,
  targetLat: number,
  targetLng: number,
  radiusM: number
) {
  const distance = haversineMeters(userLat, userLng, targetLat, targetLng);
  return { within: distance <= radiusM, distance };
}

export function extractQrToken(raw: string) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const idx = s.indexOf('SFQR_');
  if (idx < 0) return null;
  return s.slice(idx).split(/\s/)[0];
}

export async function findOfficeByToken(rawToken: string) {
  const token = extractQrToken(rawToken) || String(rawToken || '').trim();
  if (!token) return null;

  const qr = await db.officeQr.findFirst({
    where: { token, active: true },
    include: { office: true },
  });
  if (!qr?.office || qr.office.active === false) return null;

  return {
    office: {
      id: qr.office.id,
      name: qr.office.name,
      lat: qr.office.lat,
      lng: qr.office.lng,
      radiusMeters: qr.office.radiusMeters || 300,
    },
    token: qr.token,
  };
}

export function todayKeyIST(d: Date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function nowTimeLabelIST() {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date());
}

export function employeeDisplayName(emp: {
  firstName: string;
  middleName?: string | null;
  lastName: string;
}) {
  return [emp.firstName, emp.middleName, emp.lastName].filter(Boolean).join(' ');
}
