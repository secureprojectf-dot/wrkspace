import { db } from '@/lib/db';

/** Haversine distance in meters. */
function distanceM(aLat: number, aLng: number, bLat: number, bLng: number) {
	const R = 6371000;
	const toRad = (d: number) => (d * Math.PI) / 180;
	const dLat = toRad(bLat - aLat);
	const dLng = toRad(bLng - aLng);
	const lat1 = toRad(aLat);
	const lat2 = toRad(bLat);
	const h =
		Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Append a GPS ping to a going-home trip (latest position + trail point).
 * Skips duplicate points closer than ~8m within the last 20s to limit noise,
 * but always updates trip.lat/lng for live admin map.
 */
export async function recordTripLocation(tripId: string, lat: number, lng: number) {
	const updated = await db.safetyTrip.update({
		where: { id: tripId },
		data: { lat, lng },
	});

	const last = await db.safetyTripPoint.findFirst({
		where: { tripId },
		orderBy: { recordedAt: 'desc' },
	});
	const shouldWrite =
		!last ||
		distanceM(last.lat, last.lng, lat, lng) >= 8 ||
		Date.now() - last.recordedAt.getTime() >= 20_000;

	if (shouldWrite) {
		await db.safetyTripPoint.create({
			data: { tripId, lat, lng },
		});
	}
	return updated;
}
