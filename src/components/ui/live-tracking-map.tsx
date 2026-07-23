'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type EmpRow = {
	id: string;
	name: string;
	phone: string;
	lat: number | null;
	lng: number | null;
	isLive: boolean;
	hasLocation: boolean;
	mapsUrl?: string | null;
	ageMs?: number | null;
};

/** Leaflet ignores MapContainer center after mount — must flyTo explicitly. */
function FlyToEmployee({
	lat,
	lng,
	active,
}: {
	lat: number | null;
	lng: number | null;
	active: boolean;
}) {
	const map = useMap();
	useEffect(() => {
		if (!active || lat == null || lng == null) return;
		if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
		map.flyTo([lat, lng], 18, { duration: 0.75 });
	}, [map, lat, lng, active]);
	return null;
}

function FitAll({ employees, enabled }: { employees: EmpRow[]; enabled: boolean }) {
	const map = useMap();
	useEffect(() => {
		if (!enabled) return;
		const pts = employees.filter(
			(e) => e.hasLocation && e.lat != null && e.lng != null && Number.isFinite(e.lat) && Number.isFinite(e.lng),
		);
		if (!pts.length) {
			map.setView([17.385, 78.4867], 11);
			return;
		}
		if (pts.length === 1) {
			map.setView([pts[0].lat!, pts[0].lng!], 16);
			return;
		}
		const bounds = L.latLngBounds(pts.map((p) => [p.lat!, p.lng!] as [number, number]));
		map.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 });
	}, [map, employees, enabled]);
	return null;
}

function pinIcon(live: boolean, focused: boolean) {
	const color = live ? '#22c55e' : focused ? '#3b82f6' : '#94a3b8';
	const size = focused ? 18 : 12;
	return L.divIcon({
		className: '',
		html: `<div style="width:${size}px;height:${size}px;border-radius:99px;background:${color};border:2px solid white;box-shadow:0 1px 5px rgba(0,0,0,.4)"></div>`,
		iconSize: [size, size],
		iconAnchor: [size / 2, size / 2],
	});
}

export function LiveTrackingMap({
	employees,
	focusId,
}: {
	employees: EmpRow[];
	focusId: string | null;
}) {
	const withLoc = employees.filter(
		(e) =>
			e.hasLocation &&
			e.lat != null &&
			e.lng != null &&
			Number.isFinite(Number(e.lat)) &&
			Number.isFinite(Number(e.lng)),
	);
	const focused = focusId ? withLoc.find((e) => e.id === focusId) : null;
	const focusMissing = Boolean(focusId && !focused);

	const center: [number, number] = focused
		? [Number(focused.lat), Number(focused.lng)]
		: withLoc[0]
			? [Number(withLoc[0].lat), Number(withLoc[0].lng)]
			: [17.385, 78.4867];

	return (
		<div className="relative h-full w-full">
			<MapContainer
				key="live-track-map"
				center={center}
				zoom={focused ? 18 : 12}
				className="h-full w-full"
				scrollWheelZoom
				attributionControl={false}
			>
				<TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
				<FlyToEmployee
					active={Boolean(focused)}
					lat={focused ? Number(focused.lat) : null}
					lng={focused ? Number(focused.lng) : null}
				/>
				<FitAll employees={withLoc} enabled={!focused} />
				{withLoc.map((e) => (
					<Marker
						key={`${e.id}-${e.lat}-${e.lng}`}
						position={[Number(e.lat), Number(e.lng)]}
						icon={pinIcon(e.isLive, focusId === e.id)}
						zIndexOffset={focusId === e.id ? 1000 : 0}
					>
						<Popup>
							<div className="min-w-[150px] space-y-1 text-xs">
								<p className="font-bold text-slate-900">{e.name}</p>
								<p className="text-slate-600">{e.phone}</p>
								<p className="font-mono text-[10px] text-slate-500">
									{Number(e.lat).toFixed(6)}, {Number(e.lng).toFixed(6)}
								</p>
								{e.isLive ? (
									<p className="font-semibold text-emerald-600">Live GPS</p>
								) : (
									<p className="text-amber-700">Last known (may be older)</p>
								)}
								{e.mapsUrl ? (
									<a
										href={e.mapsUrl}
										target="_blank"
										rel="noreferrer"
										className="font-semibold text-blue-600"
									>
										Open exact pin in Maps
									</a>
								) : null}
							</div>
						</Popup>
					</Marker>
				))}
			</MapContainer>
			{focusMissing ? (
				<div className="pointer-events-none absolute inset-x-3 bottom-3 rounded-lg bg-amber-950/90 px-3 py-2 text-center text-[11px] font-medium text-amber-100">
					No GPS from this employee yet. They must open wrkspace on their phone and allow location —
					then the pin moves to where they actually are.
				</div>
			) : null}
		</div>
	);
}
