'use client';

import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const icon = L.icon({
	iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
	iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
	shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
	iconSize: [25, 41],
	iconAnchor: [12, 41],
});

function TapHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
	useMapEvents({
		click(e) {
			onPick(e.latlng.lat, e.latlng.lng);
		},
	});
	return null;
}

function Recenter({ lat, lng }: { lat: number; lng: number }) {
	const map = useMap();
	useEffect(() => {
		map.setView([lat, lng], Math.max(map.getZoom(), 16));
	}, [lat, lng, map]);
	return null;
}

export default function HomeMapTap({
	lat,
	lng,
	onPick,
}: {
	lat: number | null;
	lng: number | null;
	onPick: (lat: number, lng: number) => void;
}) {
	const center: [number, number] = lat != null && lng != null ? [lat, lng] : [12.9716, 77.5946];

	return (
		<MapContainer center={center} zoom={lat != null ? 16 : 12} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
			<TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
			<TapHandler onPick={onPick} />
			{lat != null && lng != null && (
				<>
					<Marker position={[lat, lng]} icon={icon} />
					<Recenter lat={lat} lng={lng} />
				</>
			)}
		</MapContainer>
	);
}
