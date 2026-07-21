'use client';

import { useEffect, useRef } from 'react';
import { apiGet, apiPost, getPosition, isFemaleEmployee } from '@/lib/mobile-api';

const OFFICE_WATCH_MS = 45_000;
const HOME_WATCH_MS = 25_000;
const LEAVE_M = 300;

function distM(aLat: number, aLng: number, bLat: number, bLng: number) {
	const R = 6371000;
	const toR = (d: number) => (d * Math.PI) / 180;
	const dLat = toR(bLat - aLat);
	const dLng = toR(bLng - aLng);
	const x =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toR(aLat)) * Math.cos(toR(bLat)) * Math.sin(dLng / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(x));
}

type Opts = {
	employee: any;
	enabled: boolean;
	onLeaveOffice?: () => void;
};

/**
 * Foreground tracking while the mobile web app is open (PWA / Safari).
 * Mirrors Flutter leave-office + home heartbeat as closely as browsers allow.
 */
export function useMobileTracking({ employee, enabled, onLeaveOffice }: Opts) {
	const leavePrompted = useRef(false);
	const officesRef = useRef<{ lat: number; lng: number; geofenceM?: number }[]>([]);

	useEffect(() => {
		if (!enabled || !employee?.id) return;

		let alive = true;
		let officeTimer: number | undefined;
		let homeTimer: number | undefined;

		const loadOffices = async () => {
			try {
				const data = await apiGet<{ offices?: any[] }>('/api/attendance/offices');
				officesRef.current = (data.offices || []).map((o) => ({
					lat: Number(o.lat),
					lng: Number(o.lng),
					geofenceM: Number(o.geofenceM || o.radiusMeters || 300),
				}));
			} catch {
				/* ignore */
			}
		};

		const tickOffice = async () => {
			if (!alive) return;
			try {
				const today = await apiGet<any>('/api/attendance/today');
				const att = today.attendance || today;
				const onShift =
					att?.checkIn && (!att?.checkOut || String(att.checkOut).trim() === '');
				if (!onShift) {
					leavePrompted.current = false;
					return;
				}
				const pos = await getPosition(12000);
				const { latitude: lat, longitude: lng } = pos.coords;
				await apiPost('/api/attendance/location', { lat, lng }).catch(() => {});

				const offices = officesRef.current;
				if (!offices.length) return;
				const nearest = offices
					.map((o) => ({
						...o,
						d: distM(lat, lng, o.lat, o.lng),
						r: o.geofenceM || LEAVE_M,
					}))
					.sort((a, b) => a.d - b.d)[0];
				if (nearest && nearest.d > nearest.r && !leavePrompted.current) {
					leavePrompted.current = true;
					await apiPost('/api/attendance/left-office', {}).catch(() => {});
					onLeaveOffice?.();
				}
				if (nearest && nearest.d <= nearest.r) {
					leavePrompted.current = false;
				}
			} catch {
				/* ignore */
			}
		};

		const tickHome = async () => {
			if (!alive || !isFemaleEmployee(employee)) return;
			try {
				const trips = await apiGet<{ trips?: any[]; trip?: any }>('/api/safety/trips/home');
				const open =
					trips.trip ||
					(trips.trips || []).find((t: any) => t.status === 'IN_TRANSIT');
				if (!open?.id) return;
				const pos = await getPosition(12000);
				await apiPost(`/api/safety/trips/${open.id}/location`, {
					lat: pos.coords.latitude,
					lng: pos.coords.longitude,
				});
			} catch {
				/* ignore */
			}
		};

		void loadOffices().then(() => {
			void tickOffice();
			void tickHome();
		});
		officeTimer = window.setInterval(() => void tickOffice(), OFFICE_WATCH_MS);
		homeTimer = window.setInterval(() => void tickHome(), HOME_WATCH_MS);

		return () => {
			alive = false;
			if (officeTimer) window.clearInterval(officeTimer);
			if (homeTimer) window.clearInterval(homeTimer);
		};
	}, [employee, enabled, onLeaveOffice]);
}
