'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { QRCodeSVG } from 'qrcode.react';
import {
	addOfficeQrAction,
	createOfficeAction,
	deleteOfficeAction,
	deleteOfficeQrAction,
	listOfficesWithQr,
	toggleOfficeQrAction,
	updateOfficeAction,
} from '@/app/admin/offices-actions';
import { encodePlusCode, googleMapsPinUrl, googleMapsSearchUrl, parseMapsLocation } from '@/lib/maps-geo';

const MapTap = dynamic(() => import('./home-map-tap'), {
	ssr: false,
	loading: () => <div className="h-56 bg-brand-900/40 animate-pulse" />,
});

type OfficeRow = Awaited<ReturnType<typeof listOfficesWithQr>>[number];

export default function OfficesPanel() {
	const [offices, setOffices] = useState<OfficeRow[]>([]);
	const [error, setError] = useState('');
	const [busy, setBusy] = useState(false);
	const [mapsPaste, setMapsPaste] = useState('');
	const [editingId, setEditingId] = useState<string | null>(null);
	const [form, setForm] = useState({
		name: '',
		address: '',
		lat: '12.9716',
		lng: '77.5946',
		plusCode: '',
		radiusMeters: '300',
		geofenceM: '300',
	});

	const latNum = Number(form.lat);
	const lngNum = Number(form.lng);

	async function load() {
		const rows = await listOfficesWithQr();
		setOffices(rows);
	}

	useEffect(() => {
		load().catch((e) => setError(String(e)));
	}, []);

	function setPoint(lat: number, lng: number) {
		setForm((f) => ({
			...f,
			lat: String(lat),
			lng: String(lng),
			plusCode: encodePlusCode(lat, lng) || f.plusCode,
		}));
		setError('');
	}

	function useGps() {
		if (!navigator.geolocation) {
			setError('Geolocation not available in this browser');
			return;
		}
		navigator.geolocation.getCurrentPosition(
			(pos) => setPoint(pos.coords.latitude, pos.coords.longitude),
			() => setError('Allow location permission to use GPS'),
			{ enableHighAccuracy: true }
		);
	}

	function applyMapsPaste() {
		const parsed = parseMapsLocation(mapsPaste);
		if (!parsed) {
			setError('Paste a Google Maps link or coordinates like 12.97,77.59');
			return;
		}
		setPoint(parsed.lat, parsed.lng);
	}

	function applyPlusCode() {
		const raw = form.plusCode.trim();
		if (!raw.includes('+')) {
			setError('Plus Code must look like 7J4V+2Q (with a +)');
			return;
		}
		try {
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const { OpenLocationCode } = require('open-location-code') as {
				OpenLocationCode: new () => {
					isValid: (c: string) => boolean;
					isFull: (c: string) => boolean;
					decode: (c: string) => { latitudeCenter: number; longitudeCenter: number };
					recoverNearest: (c: string, lat: number, lng: number) => string;
				};
			};
			const coder = new OpenLocationCode();
			const code = raw.toUpperCase();
			if (!coder.isValid(code)) {
				setError('Invalid Plus Code');
				return;
			}
			let full = code;
			if (!coder.isFull(code)) {
				full = coder.recoverNearest(code, Number.isFinite(latNum) ? latNum : 12.9716, Number.isFinite(lngNum) ? lngNum : 77.5946);
			}
			const d = coder.decode(full);
			setPoint(d.latitudeCenter, d.longitudeCenter);
			setForm((f) => ({ ...f, plusCode: full }));
		} catch {
			setError('Could not decode Plus Code — use map tap or GPS instead');
		}
	}

	async function onCreate(e: React.FormEvent) {
		e.preventDefault();
		setBusy(true);
		setError('');
		const res = await createOfficeAction({
			name: form.name,
			address: form.address,
			lat: Number(form.lat),
			lng: Number(form.lng),
			plusCode: form.plusCode || null,
			radiusMeters: Number(form.radiusMeters),
			geofenceM: Number(form.geofenceM),
		});
		setBusy(false);
		if (!res.success) {
			setError(res.error || 'Failed');
			return;
		}
		setEditingId(null);
		setForm((f) => ({ ...f, name: '', address: '', plusCode: encodePlusCode(Number(f.lat), Number(f.lng)) }));
		await load();
	}

	return (
		<div className="space-y-8">
			<div>
				<h2 className="text-xl font-semibold text-white mb-1">Offices & QR</h2>
				<p className="text-sm text-brand-300/70">
					Pick office location with GPS, map tap, Google Maps link, or Plus Code — then add QR codes for mobile
					check-in.
				</p>
			</div>
			{error ? <div className="rounded-lg bg-red-500/15 text-red-200 px-3 py-2 text-sm">{error}</div> : null}

			<div className="grid lg:grid-cols-2 gap-6">
				<div className="space-y-6">
					{offices.map((o) => (
						<div key={o.id} className="rounded-xl border border-brand-700/50 bg-brand-950/40 p-4">
							<div className="flex items-start justify-between gap-3">
								<div>
									<h3 className="text-white font-semibold">{o.name}</h3>
									<p className="text-xs text-brand-300/70 font-mono mt-1">
										{o.lat}, {o.lng}
										{o.plusCode ? ` · ${o.plusCode}` : ''} · check-in {o.radiusMeters}m · exit{' '}
										{o.geofenceM}m
									</p>
									{o.address ? <p className="text-xs text-zinc-400 mt-1">{o.address}</p> : null}
								</div>
								<button
									type="button"
									className="text-xs px-2 py-1 border border-red-700/60 text-red-300 hover:bg-red-950/40 shrink-0"
									onClick={async () => {
										if (!confirm(`Delete office "${o.name}" and all its QR codes?`)) return;
										const res = await deleteOfficeAction(o.id);
										if (!res.success) setError(res.error || 'Delete failed');
										await load();
									}}
								>
									Delete office
								</button>
							</div>
							<a
								href={googleMapsPinUrl(o.lat, o.lng)}
								target="_blank"
								rel="noreferrer"
								className="inline-block mt-2 text-xs text-brand-300 underline"
							>
								Open in Google Maps
							</a>
							<div className="grid sm:grid-cols-2 gap-3 mt-4">
								{(o.qrs || []).map((q) => (
									<div
										key={q.id}
										className={`rounded-lg border border-brand-700/40 p-3 text-center ${
											q.active ? 'bg-white' : 'bg-brand-900/50 opacity-70'
										}`}
									>
										<div className={`font-medium text-sm mb-2 ${q.active ? 'text-slate-900' : 'text-brand-200'}`}>
											{q.label}
										</div>
										{q.active ? (
											<div className="inline-block p-2 bg-white">
												<QRCodeSVG value={q.token} size={140} level="M" includeMargin />
											</div>
										) : (
											<div className="h-[140px] grid place-items-center text-brand-400 text-sm">Inactive</div>
										)}
										<p className="text-[10px] break-all mt-2 font-mono text-slate-600">{q.token}</p>
										<div className="flex flex-wrap justify-center gap-3 mt-2">
											<button
												type="button"
												className="text-xs underline text-brand-600"
												onClick={async () => {
													await toggleOfficeQrAction(q.id, !q.active);
													await load();
												}}
											>
												{q.active ? 'Deactivate' : 'Activate'}
											</button>
											<button
												type="button"
												className="text-xs underline text-red-600"
												onClick={async () => {
													if (!confirm(`Delete QR "${q.label}"?`)) return;
													const res = await deleteOfficeQrAction(q.id);
													if (!res.success) setError(res.error || 'Failed');
													await load();
												}}
											>
												Delete QR
											</button>
										</div>
									</div>
								))}
							</div>
							<div className="flex flex-wrap gap-2 mt-3">
								<button
									type="button"
									className="text-sm px-3 py-1.5 rounded-lg bg-brand-500 text-white"
									onClick={async () => {
										const label = window.prompt('QR label', 'Entry');
										if (!label) return;
										const res = await addOfficeQrAction(o.id, label);
										if (!res.success) setError(res.error || 'Failed');
										await load();
									}}
								>
									Add QR
								</button>
								<button
									type="button"
									className="text-sm px-3 py-1.5 rounded-lg border border-brand-600 text-brand-200"
									onClick={() => {
										setEditingId(o.id);
										setForm({
											name: o.name,
											address: o.address || '',
											lat: String(o.lat),
											lng: String(o.lng),
											plusCode: o.plusCode || encodePlusCode(o.lat, o.lng),
											radiusMeters: String(o.radiusMeters),
											geofenceM: String(o.geofenceM),
										});
										setError('');
										document.getElementById('office-form')?.scrollIntoView({ behavior: 'smooth' });
									}}
								>
									Edit on map
								</button>
								<button
									type="button"
									className="text-sm px-3 py-1.5 rounded-lg border border-brand-600 text-brand-200"
									onClick={async () => {
										const lat = window.prompt('Latitude', String(o.lat));
										const lng = window.prompt('Longitude', String(o.lng));
										const plus = window.prompt('Plus Code', o.plusCode || '');
										const radius = window.prompt('Check-in radius meters', String(o.radiusMeters));
										const geo = window.prompt('Exit geofence meters', String(o.geofenceM));
										if (!lat || !lng) return;
										await updateOfficeAction(o.id, {
											lat: Number(lat),
											lng: Number(lng),
											plusCode: plus || null,
											radiusMeters: Number(radius) || o.radiusMeters,
											geofenceM: Number(geo) || o.geofenceM,
										});
										await load();
									}}
								>
									Quick edit
								</button>
							</div>
						</div>
					))}
					{!offices.length ? (
						<p className="text-brand-300/60 text-sm">No offices yet — create one on the right.</p>
					) : null}
				</div>

				<form
					id="office-form"
					onSubmit={onCreate}
					className="rounded-xl border border-brand-700/50 bg-brand-950/40 p-4 space-y-3 h-fit"
				>
					<h3 className="text-white font-semibold">
						{editingId ? 'Edit office location' : 'Add / place office'}
					</h3>
					{editingId ? (
						<p className="text-xs text-amber-300">
							Editing loaded office — use “Save changes” below, or clear to create a new one.
						</p>
					) : null}

					<label className="block text-xs text-brand-200">
						Name
						<input
							required
							className="mt-1 w-full rounded-lg bg-brand-900/60 border border-brand-700 px-3 py-2 text-sm text-white"
							value={form.name}
							onChange={(e) => setForm({ ...form, name: e.target.value })}
						/>
					</label>
					<label className="block text-xs text-brand-200">
						Address (optional)
						<input
							className="mt-1 w-full rounded-lg bg-brand-900/60 border border-brand-700 px-3 py-2 text-sm text-white"
							value={form.address}
							onChange={(e) => setForm({ ...form, address: e.target.value })}
						/>
					</label>

					<div className="flex flex-wrap gap-2">
						<button
							type="button"
							onClick={useGps}
							className="text-xs font-bold px-3 py-2 bg-brand-500 text-white rounded-lg"
						>
							Use current GPS
						</button>
						<a
							href={
								Number.isFinite(latNum) && Number.isFinite(lngNum)
									? googleMapsSearchUrl(latNum, lngNum)
									: googleMapsSearchUrl()
							}
							target="_blank"
							rel="noreferrer"
							className="text-xs font-bold px-3 py-2 bg-slate-800 text-white rounded-lg"
						>
							Open Google Maps
						</a>
					</div>

					<label className="block text-xs text-brand-200">
						Paste Google Maps link or lat,lng
						<div className="mt-1 flex gap-2">
							<input
								className="flex-1 rounded-lg bg-brand-900/60 border border-brand-700 px-3 py-2 text-sm text-white"
								placeholder="https://maps.google.com/... or 12.97,77.59"
								value={mapsPaste}
								onChange={(e) => setMapsPaste(e.target.value)}
							/>
							<button
								type="button"
								onClick={applyMapsPaste}
								className="text-xs font-bold px-3 py-2 bg-slate-700 text-white rounded-lg"
							>
								Apply
							</button>
						</div>
					</label>

					<div className="border border-brand-700/50 overflow-hidden h-56 rounded-lg">
						{Number.isFinite(latNum) && Number.isFinite(lngNum) ? (
							<MapTap lat={latNum} lng={lngNum} onPick={setPoint} />
						) : (
							<MapTap lat={12.9716} lng={77.5946} onPick={setPoint} />
						)}
					</div>
					<p className="text-[10px] text-brand-300/70">Tap the map to drop the office pin. Plus Code fills automatically.</p>

					<label className="block text-xs text-brand-200">
						Plus Code
						<div className="mt-1 flex gap-2">
							<input
								className="flex-1 rounded-lg bg-brand-900/60 border border-brand-700 px-3 py-2 text-sm text-white font-mono"
								value={form.plusCode}
								onChange={(e) => setForm({ ...form, plusCode: e.target.value })}
								placeholder="7J4V+2Q or full code"
							/>
							<button
								type="button"
								onClick={applyPlusCode}
								className="text-xs font-bold px-3 py-2 bg-slate-700 text-white rounded-lg"
							>
								Apply code
							</button>
						</div>
					</label>

					<div className="grid grid-cols-2 gap-2">
						<label className="block text-xs text-brand-200">
							Latitude
							<input
								required
								className="mt-1 w-full rounded-lg bg-brand-900/60 border border-brand-700 px-3 py-2 text-sm text-white font-mono"
								value={form.lat}
								onChange={(e) => setForm({ ...form, lat: e.target.value })}
							/>
						</label>
						<label className="block text-xs text-brand-200">
							Longitude
							<input
								required
								className="mt-1 w-full rounded-lg bg-brand-900/60 border border-brand-700 px-3 py-2 text-sm text-white font-mono"
								value={form.lng}
								onChange={(e) => setForm({ ...form, lng: e.target.value })}
							/>
						</label>
					</div>

					<div className="grid grid-cols-2 gap-2">
						<label className="block text-xs text-brand-200">
							Check-in radius (m)
							<input
								required
								className="mt-1 w-full rounded-lg bg-brand-900/60 border border-brand-700 px-3 py-2 text-sm text-white"
								value={form.radiusMeters}
								onChange={(e) => setForm({ ...form, radiusMeters: e.target.value })}
							/>
						</label>
						<label className="block text-xs text-brand-200">
							Exit geofence (m)
							<input
								required
								className="mt-1 w-full rounded-lg bg-brand-900/60 border border-brand-700 px-3 py-2 text-sm text-white"
								value={form.geofenceM}
								onChange={(e) => setForm({ ...form, geofenceM: e.target.value })}
							/>
						</label>
					</div>

					{editingId ? (
						<>
							<button
								type="button"
								disabled={busy}
								className="w-full rounded-lg bg-brand-500 hover:bg-brand-400 text-white font-medium py-2.5 text-sm disabled:opacity-50"
								onClick={async () => {
									setBusy(true);
									setError('');
									const res = await updateOfficeAction(editingId, {
										name: form.name,
										address: form.address,
										lat: Number(form.lat),
										lng: Number(form.lng),
										plusCode: form.plusCode || null,
										radiusMeters: Number(form.radiusMeters),
										geofenceM: Number(form.geofenceM),
									});
									setBusy(false);
									if (!res.success) setError(res.error || 'Update failed');
									else {
										setEditingId(null);
										await load();
									}
								}}
							>
								{busy ? 'Saving…' : 'Save changes'}
							</button>
							<button
								type="button"
								className="w-full text-xs text-brand-300 underline"
								onClick={() => {
									setEditingId(null);
									setForm((f) => ({ ...f, name: '', address: '' }));
								}}
							>
								Cancel edit / create new instead
							</button>
						</>
					) : (
						<button
							type="submit"
							disabled={busy}
							className="w-full rounded-lg bg-brand-500 hover:bg-brand-400 text-white font-medium py-2.5 text-sm disabled:opacity-50"
						>
							{busy ? 'Saving…' : 'Create office'}
						</button>
					)}
				</form>
			</div>
		</div>
	);
}
