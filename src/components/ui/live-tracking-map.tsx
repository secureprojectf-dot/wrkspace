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
};

function FitEmployees({ employees }: { employees: EmpRow[] }) {
	const map = useMap();
	useEffect(() => {
		const pts = employees.filter((e) => e.hasLocation && e.lat != null && e.lng != null);
		if (!pts.length) {
			map.setView([17.385, 78.4867], 11);
			return;
		}
		if (pts.length === 1) {
			map.setView([pts[0].lat!, pts[0].lng!], 15);
			return;
		}
		const bounds = L.latLngBounds(pts.map((p) => [p.lat!, p.lng!] as [number, number]));
		map.fitBounds(bounds, { padding: [40, 40] });
	}, [map, employees]);
	return null;
}

function pinIcon(live: boolean, focused: boolean) {
	const color = live ? '#22c55e' : focused ? '#3b82f6' : '#94a3b8';
	const size = focused ? 16 : 12;
	return L.divIcon({
		className: '',
		html: `<div style="width:${size}px;height:${size}px;border-radius:99px;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
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
	const withLoc = employees.filter((e) => e.hasLocation && e.lat != null && e.lng != null);
	const focused = focusId ? withLoc.find((e) => e.id === focusId) : null;
	const center = focused
		? ([focused.lat!, focused.lng!] as [number, number])
		: withLoc[0]
			? ([withLoc[0].lat!, withLoc[0].lng!] as [number, number])
			: ([17.385, 78.4867] as [number, number]);

	return (
		<MapContainer
			center={center}
			zoom={focused ? 15 : 12}
			className="h-full w-full"
			scrollWheelZoom
			attributionControl={false}
		>
			<TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
			<FitEmployees employees={focused ? [focused] : withLoc} />
			{withLoc.map((e) => (
				<Marker
					key={e.id}
					position={[e.lat!, e.lng!]}
					icon={pinIcon(e.isLive, focusId === e.id)}
				>
					<Popup>
						<div className="min-w-[140px] space-y-1 text-xs">
							<p className="font-bold text-slate-900">{e.name}</p>
							<p className="text-slate-600">{e.phone}</p>
							<p className="font-mono text-[10px] text-slate-500">
								{e.lat!.toFixed(5)}, {e.lng!.toFixed(5)}
							</p>
							{e.mapsUrl ? (
								<a
									href={e.mapsUrl}
									target="_blank"
									rel="noreferrer"
									className="font-semibold text-blue-600"
								>
									Open in Maps
								</a>
							) : null}
						</div>
					</Popup>
				</Marker>
			))}
		</MapContainer>
	);
}
