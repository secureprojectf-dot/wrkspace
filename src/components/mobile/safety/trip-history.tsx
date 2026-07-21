'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { apiGet, isFemaleEmployee } from '@/lib/mobile-api';

const MapView = dynamic(() => import('./trip-map'), {
	ssr: false,
	loading: () => <div className="h-[280px] animate-pulse bg-[#E8EFFF]" />,
});

type TripRow = {
	id: string;
	status: string;
	dateKey?: string | null;
	startedAt: string;
	endedAt?: string | null;
	pointCount?: number;
};

export function MobileTripHistory({ employee }: { employee: any }) {
	const female = isFemaleEmployee(employee);
	const [trips, setTrips] = useState<TripRow[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [polyline, setPolyline] = useState<{ lat: number; lng: number }[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!female) {
			setLoading(false);
			return;
		}
		void (async () => {
			setLoading(true);
			try {
				const data = await apiGet<{ trips?: TripRow[] }>('/api/safety/trips/mine');
				const list = Array.isArray(data.trips) ? data.trips : [];
				setTrips(list);
				if (list[0]) setSelectedId(list[0].id);
			} catch (e: any) {
				setError(e?.message || 'Failed to load trips');
			} finally {
				setLoading(false);
			}
		})();
	}, [female, employee?.id]);

	useEffect(() => {
		if (!selectedId) {
			setPolyline([]);
			return;
		}
		void apiGet<{ trip?: { polyline?: { lat: number; lng: number }[] } }>(
			`/api/safety/trips/mine?tripId=${encodeURIComponent(selectedId)}`,
		)
			.then((d) => setPolyline(Array.isArray(d.trip?.polyline) ? d.trip!.polyline! : []))
			.catch(() => setPolyline([]));
	}, [selectedId]);

	const center = useMemo(() => {
		if (polyline.length) return { lat: polyline[0].lat, lng: polyline[0].lng };
		if (employee?.homeLat != null) return { lat: Number(employee.homeLat), lng: Number(employee.homeLng) };
		return { lat: 12.9716, lng: 77.5946 };
	}, [polyline, employee?.homeLat, employee?.homeLng]);

	if (!female) {
		return (
			<div className="p-4">
				<p className="rounded-xl border border-[#E2E8F0] bg-white p-4 text-sm text-[#64748B]">
					Trip history is for Girl Safety enrolled employees.
				</p>
			</div>
		);
	}

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="h-[280px] shrink-0 border-b border-[#E2E8F0]">
				<MapView center={center} path={polyline} />
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto p-4 pb-8">
				{error ? <p className="mb-2 text-sm text-[#B42318]">{error}</p> : null}
				{loading ? (
					<p className="py-8 text-center text-sm text-[#64748B]">Loading trips…</p>
				) : trips.length === 0 ? (
					<p className="py-8 text-center text-sm text-[#64748B]">No going-home trips yet</p>
				) : (
					<ul className="space-y-2">
						{trips.map((t) => {
							const active = t.id === selectedId;
							return (
								<button
									key={t.id}
									type="button"
									onClick={() => setSelectedId(t.id)}
									className={`w-full rounded-xl border px-3 py-3 text-left ${
										active
											? 'border-[#0047FF] bg-[#E8EFFF]'
											: 'border-[#E2E8F0] bg-white'
									}`}
								>
									<p className="text-sm font-bold text-[#0F172A]">
										{t.dateKey || new Date(t.startedAt).toLocaleDateString()}
									</p>
									<p className="text-xs text-[#64748B]">
										{t.status.replace(/_/g, ' ')} · {t.pointCount ?? 0} points ·{' '}
										{new Date(t.startedAt).toLocaleTimeString([], {
											hour: '2-digit',
											minute: '2-digit',
										})}
									</p>
								</button>
							);
						})}
					</ul>
				)}
			</div>
		</div>
	);
}
