'use client';

import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect } from 'react';
import 'leaflet/dist/leaflet.css';

type Props = {
	center: { lat: number; lng: number };
	path: { lat: number; lng: number }[];
};

function FitBounds({ path, center }: Props) {
	const map = useMap();
	useEffect(() => {
		if (path.length > 1) {
			const bounds = L.latLngBounds(path.map((p) => [p.lat, p.lng] as [number, number]));
			map.fitBounds(bounds, { padding: [24, 24] });
		} else {
			map.setView([center.lat, center.lng], 13);
		}
	}, [map, path, center.lat, center.lng]);
	return null;
}

const startIcon = L.divIcon({
	className: '',
	html: `<div style="width:12px;height:12px;border-radius:99px;background:#0F6B4C;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>`,
	iconSize: [12, 12],
	iconAnchor: [6, 6],
});

export default function TripMap({ center, path }: Props) {
	return (
		<MapContainer
			center={[center.lat, center.lng]}
			zoom={13}
			className="h-full w-full"
			scrollWheelZoom={false}
			attributionControl={false}
		>
			<TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
			<FitBounds center={center} path={path} />
			{path.length > 1 ? (
				<Polyline positions={path.map((p) => [p.lat, p.lng] as [number, number])} pathOptions={{ color: '#0F6B4C', weight: 5 }} />
			) : null}
			{path.length ? <Marker position={[path[0].lat, path[0].lng]} icon={startIcon} /> : null}
			{path.length > 1 ? (
				<Marker position={[path[path.length - 1].lat, path[path.length - 1].lng]} icon={startIcon} />
			) : null}
		</MapContainer>
	);
}
