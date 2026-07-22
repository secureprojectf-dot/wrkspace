/** Parse lat/lng from Google Maps links, Plus-ish paste, or plain "lat,lng". */
export function parseMapsLocation(input: string): { lat: number; lng: number } | null {
	const s = String(input || '').trim();
	if (!s) return null;

	const patterns = [
		/@(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/,
		/[?&]q=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/,
		/[?&]query=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/,
		/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/,
		/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/,
	];
	for (const re of patterns) {
		const m = s.match(re);
		if (!m) continue;
		const lat = Number(m[1]);
		const lng = Number(m[2]);
		if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
			return { lat, lng };
		}
	}
	return null;
}

export function encodePlusCode(lat: number, lng: number): string {
	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const { OpenLocationCode } = require('open-location-code') as {
			OpenLocationCode: new () => { encode: (a: number, b: number, c?: number) => string };
		};
		return new OpenLocationCode().encode(lat, lng, 10);
	} catch {
		return '';
	}
}

export function googleMapsSearchUrl(lat?: number, lng?: number) {
	if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
		return `https://www.google.com/maps/@${lat},${lng},17z`;
	}
	return 'https://www.google.com/maps';
}

export function googleMapsPinUrl(lat: number, lng: number) {
	return `https://www.google.com/maps?q=${lat},${lng}`;
}
