'use client';

import { useEffect, useRef } from 'react';
import { apiGet, apiPost, getPosition, isFemaleEmployee } from '@/lib/mobile-api';

const OFFICE_WATCH_MS = 45_000;
const HOME_WATCH_MS = 25_000;
const EXIT_GEOFENCE_M = 300;
const MAX_ACCURACY_M = 80;
const OUTSIDE_CONFIRM_TICKS = 2;

export const OFFICE_EXIT_KEY = 'wrkspace_office_exit_pending';

export function markOfficeExitPending() {
	try {
		sessionStorage.setItem(
			OFFICE_EXIT_KEY,
			JSON.stringify({ at: Date.now(), status: 'pending' }),
		);
	} catch {
		/* ignore */
	}
}

export function clearOfficeExitPending() {
	try {
		sessionStorage.removeItem(OFFICE_EXIT_KEY);
	} catch {
		/* ignore */
	}
}

export function readOfficeExitPending(): { at: number } | null {
	try {
		const raw = sessionStorage.getItem(OFFICE_EXIT_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as { at?: number; status?: string };
		if (!parsed?.at || parsed.status === 'done') return null;
		return { at: Number(parsed.at) };
	} catch {
		return null;
	}
}

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

function exitRadiusM(o: { geofenceM?: number }) {
	const g = Number(o.geofenceM);
	return Number.isFinite(g) && g > 0 ? g : EXIT_GEOFENCE_M;
}

type Opts = {
	employee: any;
	enabled: boolean;
	onLeaveOffice?: () => void;
	onLocationError?: () => void;
};

export function useMobileTracking({ employee, enabled, onLeaveOffice, onLocationError }: Opts) {
	const leavePrompted = useRef(false);
	const wasInsideExit = useRef(false);
	const outsideStreak = useRef(0);
	const officesRef = useRef<{ lat: number; lng: number; geofenceM?: number }[]>([]);
	const errorNotified = useRef(false);

	useEffect(() => {
		if (!enabled || !employee?.id) return;

		let alive = true;
		let officeTimer: number | undefined;
		let homeTimer: number | undefined;

		const failLoc = () => {
			if (!errorNotified.current) {
				errorNotified.current = true;
				onLocationError?.();
			}
		};

		const loadOffices = async () => {
			try {
				const data = await apiGet<{ offices?: any[] }>('/api/attendance/offices');
				officesRef.current = (data.offices || [])
					.map((o) => ({
						lat: Number(o.lat),
						lng: Number(o.lng),
						geofenceM: Number(o.geofenceM),
					}))
					.filter(
						(o) =>
							Number.isFinite(o.lat) &&
							Number.isFinite(o.lng) &&
							!(o.lat === 0 && o.lng === 0),
					);
			} catch {
				/* ignore */
			}
		};

		const fireLeavePrompt = async () => {
			leavePrompted.current = true;
			wasInsideExit.current = false;
			markOfficeExitPending();
			await apiPost('/api/attendance/left-office', {}).catch(() => {});
			onLeaveOffice?.();
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
					wasInsideExit.current = false;
					outsideStreak.current = 0;
					clearOfficeExitPending();
					return;
				}

				// Already pending a choice (e.g. from push) — keep UI in sync
				const pending = readOfficeExitPending();
				if (pending && !leavePrompted.current) {
					leavePrompted.current = true;
					onLeaveOffice?.();
				}

				const pos = await getPosition(15000);
				errorNotified.current = false;
				const { latitude: lat, longitude: lng, accuracy } = pos.coords;
				await apiPost('/api/attendance/location', { lat, lng }).catch(() => {});

				if (typeof accuracy === 'number' && accuracy > MAX_ACCURACY_M) {
					return;
				}

				const offices = officesRef.current;
				if (!offices.length) return;

				const nearest = offices
					.map((o) => ({
						...o,
						d: distM(lat, lng, o.lat, o.lng),
						r: exitRadiusM(o),
					}))
					.sort((a, b) => a.d - b.d)[0];

				if (!nearest) return;

				const acc = typeof accuracy === 'number' && accuracy > 0 ? accuracy : 25;
				const outside = nearest.d > nearest.r + Math.min(acc, 60);

				if (!outside) {
					wasInsideExit.current = true;
					outsideStreak.current = 0;
					if (!readOfficeExitPending()) {
						leavePrompted.current = false;
					}
					return;
				}

				outsideStreak.current += 1;
				const confirmed =
					outsideStreak.current >= OUTSIDE_CONFIRM_TICKS &&
					(wasInsideExit.current || nearest.d > nearest.r + 100);

				if (confirmed && !leavePrompted.current) {
					await fireLeavePrompt();
				}
			} catch {
				failLoc();
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
				errorNotified.current = false;
				await apiPost(`/api/safety/trips/${open.id}/location`, {
					lat: pos.coords.latitude,
					lng: pos.coords.longitude,
				});
			} catch {
				failLoc();
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
	}, [employee, enabled, onLeaveOffice, onLocationError]);
}
