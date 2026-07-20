import { db } from '@/lib/db';

/** Append a GPS ping to a going-home trip (latest position + trail point). */
export async function recordTripLocation(tripId: string, lat: number, lng: number) {
	const updated = await db.safetyTrip.update({
		where: { id: tripId },
		data: { lat, lng },
	});
	await db.safetyTripPoint.create({
		data: { tripId, lat, lng },
	});
	return updated;
}
