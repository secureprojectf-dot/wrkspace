'use client';

import React, { useEffect, useState } from 'react';
import { createEmployeeSos, getOpenSosIncidents } from '@/app/admin/actions';
import { HomeLocationPicker } from './home-location-picker';

export function EmployeeSafetyPanel({
	employee,
	onEmployeeUpdate,
}: {
	employee: any;
	onEmployeeUpdate?: (next: any) => void;
}) {
	const [emp, setEmp] = useState(employee);
	const isFemale = String(emp?.gender || '').toUpperCase() === 'FEMALE';
	const [incidents, setIncidents] = useState<any[]>([]);
	const [busy, setBusy] = useState(false);
	const [msg, setMsg] = useState<string | null>(null);

	useEffect(() => {
		setEmp(employee);
	}, [employee]);

	const persistEmployee = (next: any) => {
		setEmp(next);
		onEmployeeUpdate?.(next);
		try {
			localStorage.setItem('wrkspace_employee_session', JSON.stringify(next));
		} catch {
			/* ignore */
		}
	};

	const load = async () => {
		try {
			const rows = await getOpenSosIncidents(Date.now());
			setIncidents(Array.isArray(rows) ? rows : []);
		} catch {
			/* keep previous list */
		}
	};

	useEffect(() => {
		load();
		const t = setInterval(load, 15000);
		return () => clearInterval(t);
	}, []);

	const triggerSos = () => {
		if (!isFemale || busy) return;
		setBusy(true);
		setMsg(null);
		navigator.geolocation.getCurrentPosition(
			async (pos) => {
				const res = await createEmployeeSos(emp.id, pos.coords.latitude, pos.coords.longitude);
				setBusy(false);
				if (res.success) {
					setMsg('SOS sent. Everyone with the app is being notified.');
					load();
				} else {
					setMsg(res.error || 'Failed');
				}
			},
			() => {
				setBusy(false);
				setMsg('Location permission required for SOS.');
			},
			{ enableHighAccuracy: true }
		);
	};

	const hasHome = emp?.homeLat != null && emp?.homeLng != null;
	const canEditHome = !hasHome || emp?.homeEditAllowed !== false;
	const needsHomeBanner = isFemale && canEditHome;

	return (
		<div className="space-y-6 p-4 md:p-6">
			{isFemale && (
				<>
					{needsHomeBanner && (
						<div className="bg-amber-50 border border-amber-400 p-4 space-y-2">
							<p className="font-black text-amber-950">
								{hasHome ? 'Admin allowed — update home location' : 'Select home location'}
							</p>
							<p className="text-sm text-amber-900">
								{hasHome
									? 'Admin unlocked home setup. Update your pin below, then save (locks again).'
									: 'Set your home pin once below. After save it locks — ask admin (yellow Allow home setup) only if you need to change it.'}
							</p>
						</div>
					)}
					<div className="bg-white border border-rose-300 p-5 space-y-3">
						<div className="flex items-center gap-3">
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img src="/branding/girl-safety-logo.png" alt="Girl Safety" className="size-12 object-contain" />
							<div>
								<h2 className="text-lg font-black text-slate-900">Girl Safety — SOS</h2>
								<p className="text-xs text-rose-800 font-semibold">Commute tracking & emergency alerts</p>
							</div>
						</div>
					<p className="text-sm text-slate-600">
						SOS: emergency only — live location to all employees. Going-home tracking (mobile): only after
						office exit / checkout until you reach home; then it stops until the next day.
						Allow location when the browser asks.
					</p>
						<button
							type="button"
							disabled={busy}
							onClick={triggerSos}
							className="w-full bg-rose-700 hover:bg-rose-600 text-white font-bold py-3 disabled:opacity-60"
						>
							{busy ? 'Sending…' : 'Trigger SOS'}
						</button>
						{msg && <p className="text-sm font-semibold text-slate-800">{msg}</p>}
					</div>
					<HomeLocationPicker employee={emp} onSaved={(next) => persistEmployee({ ...emp, ...next })} />
				</>
			)}

			<div className="bg-white border border-slate-300 p-5 space-y-3">
				<div className="flex items-center justify-between gap-3">
					<h2 className="text-lg font-black text-slate-900">Open SOS alerts</h2>
					<button
						type="button"
						onClick={() => void load()}
						className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-50"
					>
						Refresh
					</button>
				</div>
				<p className="text-xs text-slate-500">
					Shows only open emergencies. When admin marks resolved, this list clears for everyone.
				</p>
				{incidents.length === 0 ? (
					<p className="text-sm text-slate-500">No active SOS incidents.</p>
				) : (
					<ul className="space-y-3">
						{incidents.map((inc) => (
							<li key={inc.id} className="border border-rose-200 bg-rose-50 p-3 text-sm space-y-2">
								<p className="font-bold text-rose-900">
									{inc.employee?.firstName} {inc.employee?.lastName} needs help
								</p>
								{inc.employee?.phone && (
									<p className="text-slate-800 font-semibold">
										Phone:{' '}
										<a href={`tel:${inc.employee.phone}`} className="text-brand-700 underline">
											{inc.employee.phone}
										</a>
									</p>
								)}
								<p className="text-slate-700">
									{new Date(inc.createdAt).toLocaleString()} · {Number(inc.lat).toFixed(5)},{' '}
									{Number(inc.lng).toFixed(5)}
								</p>
								<a
									href={`https://www.google.com/maps?q=${inc.lat},${inc.lng}`}
									target="_blank"
									rel="noreferrer"
									className="inline-flex items-center justify-center rounded-lg bg-rose-700 hover:bg-rose-600 px-4 py-2.5 text-sm font-bold text-white no-underline"
								>
									Open live map
								</a>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}

function mapsPathUrl(points: { lat: number; lng: number }[]) {
	if (!points.length) return null;
	if (points.length === 1) return `https://www.google.com/maps?q=${points[0].lat},${points[0].lng}`;
	// Sample to stay under Maps URL limits
	const step = Math.max(1, Math.ceil(points.length / 25));
	const sampled = points.filter((_, i) => i === 0 || i === points.length - 1 || i % step === 0);
	const path = sampled.map((p) => `${p.lat},${p.lng}`).join('/');
	return `https://www.google.com/maps/dir/${path}`;
}

function todayIST() {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Asia/Kolkata',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).format(new Date());
}

export function AdminLiveSafetyPanel({ adminEmail }: { adminEmail: string }) {
	const [incidents, setIncidents] = useState<any[]>([]);
	const [trips, setTrips] = useState<any[]>([]);
	const [refreshing, setRefreshing] = useState(false);
	const [resolvingId, setResolvingId] = useState<string | null>(null);
	const [error, setError] = useState('');
	const [lastAt, setLastAt] = useState<string | null>(null);
	const [fcm, setFcm] = useState<{
		tokens: number;
		firebaseConfigured: boolean;
		vapidConfigured?: boolean;
		ready: boolean;
	} | null>(null);
	const [histDate, setHistDate] = useState(todayIST());
	const [histEmployeeId, setHistEmployeeId] = useState('');
	const [histTrips, setHistTrips] = useState<any[]>([]);
	const [females, setFemales] = useState<any[]>([]);
	const [selectedTrip, setSelectedTrip] = useState<any | null>(null);
	const [histLoading, setHistLoading] = useState(false);

	const loadHistory = async () => {
		if (!adminEmail) return;
		setHistLoading(true);
		try {
			const qs = new URLSearchParams({
				email: adminEmail,
				date: histDate,
				...(histEmployeeId ? { employeeId: histEmployeeId } : {}),
				_: String(Date.now()),
			});
			const res = await fetch(`/api/admin/safety/trips?${qs}`, {
				cache: 'no-store',
				headers: { 'x-admin-email': adminEmail },
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data?.error || 'History load failed');
			setHistTrips(Array.isArray(data.trips) ? data.trips : []);
			setFemales(Array.isArray(data.females) ? data.females : []);
		} catch (e: any) {
			setError(String(e?.message || e));
		} finally {
			setHistLoading(false);
		}
	};

	const openTripTrail = async (tripId: string) => {
		try {
			const qs = new URLSearchParams({ email: adminEmail, tripId, _: String(Date.now()) });
			const res = await fetch(`/api/admin/safety/trips?${qs}`, {
				cache: 'no-store',
				headers: { 'x-admin-email': adminEmail },
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data?.error || 'Failed to load trail');
			setSelectedTrip(data.trip || null);
		} catch (e: any) {
			setError(String(e?.message || e));
		}
	};

	const load = async () => {
		setRefreshing(true);
		setError('');
		try {
			const email = encodeURIComponent(adminEmail || '');
			const res = await fetch(`/api/admin/safety/live?email=${email}&_=${Date.now()}`, {
				cache: 'no-store',
				headers: { 'x-admin-email': adminEmail || '' },
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				throw new Error(data?.error || `Refresh failed (${res.status})`);
			}
			setIncidents(Array.isArray(data.incidents) ? data.incidents : []);
			setTrips(Array.isArray(data.trips) ? data.trips : []);
			setFcm(data.fcm || null);
			setLastAt(new Date().toLocaleTimeString());
		} catch (e: any) {
			const msg = String(e?.message || e || 'Refresh failed');
			setError(
				msg.includes('Server Action')
					? 'Stale page after deploy — hard refresh with Ctrl+Shift+R'
					: msg
			);
		} finally {
			setRefreshing(false);
		}
	};

	useEffect(() => {
		if (!adminEmail) return;
		load();
		loadHistory();
		const id = setInterval(load, 5000);
		let stopSocket: (() => void) | undefined;
		(async () => {
			try {
				const res = await fetch('/api/admin/realtime-token', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', 'x-admin-email': adminEmail },
					body: JSON.stringify({ email: adminEmail }),
				});
				const data = await res.json().catch(() => ({}));
				if (!res.ok || !data.token) return;
				const { connectRealtime } = await import('@/lib/realtime-client');
				stopSocket = connectRealtime({
					token: data.token,
					onSafety: () => load(),
					onAttendance: () => load(),
				});
			} catch (_) {}
		})();
		return () => {
			clearInterval(id);
			stopSocket?.();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [adminEmail]);

	useEffect(() => {
		if (!adminEmail) return;
		void loadHistory();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [histDate, histEmployeeId, adminEmail]);

	return (
		<div className="space-y-8 text-white">
			<div className="flex items-center justify-between gap-3 flex-wrap">
				<div>
					<h2 className="text-xl font-bold">Live safety</h2>
					<p className="text-xs text-zinc-400 mt-1">
						Open SOS + girls going home. Live via Socket.IO + poll. Tracking stops when they reach home.
						{lastAt ? ` · Last refresh ${lastAt}` : ''}
					</p>
					{error ? <p className="text-xs text-rose-400 mt-1">{error}</p> : null}
					{fcm ? (
						<div
							className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
								fcm.ready
									? 'border-emerald-700/60 bg-emerald-950/40 text-emerald-300'
									: 'border-amber-600/70 bg-amber-950/50 text-amber-200'
							}`}
						>
							<p className="font-semibold">
								FCM status: {fcm.tokens} device token{fcm.tokens === 1 ? '' : 's'} · Firebase send:{' '}
								{fcm.firebaseConfigured ? 'ON' : 'OFF'}
								{typeof fcm.vapidConfigured === 'boolean'
									? ` · Web VAPID: ${fcm.vapidConfigured ? 'ON' : 'OFF'}`
									: ''}
							</p>
							{!fcm.firebaseConfigured ? (
								<p className="mt-1 opacity-90">
									SOS will show in-app but <strong>no phone alarm</strong> until you add{' '}
									<code className="text-[10px]">FIREBASE_SERVICE_ACCOUNT_JSON</code> on Vercel
									(Firebase → Project settings → Service accounts → Generate key → paste full JSON).
								</p>
							) : null}
							{fcm.vapidConfigured === false ? (
								<p className="mt-1 opacity-90">
									Web / PWA push will not register until{' '}
									<code className="text-[10px]">NEXT_PUBLIC_FIREBASE_VAPID_KEY</code> is set on
									Vercel (Firebase → Project settings → Cloud Messaging → Web Push certificates).
								</p>
							) : null}
							{fcm.firebaseConfigured && fcm.tokens === 0 ? (
								<p className="mt-1 opacity-90">
									No device tokens yet — employees must open the app or website, log in, and allow
									Notifications.
								</p>
							) : null}
							{fcm.ready ? <p className="mt-1 opacity-90">SOS alarms can fan out to registered devices.</p> : null}
						</div>
					) : null}
				</div>
				<button
					type="button"
					onClick={() => void load()}
					disabled={refreshing}
					className="shrink-0 rounded-lg border border-brand-500 bg-brand-900/50 px-4 py-2 text-sm font-medium text-brand-100 hover:bg-brand-800/60 disabled:opacity-50"
				>
					{refreshing ? 'Refreshing…' : 'Refresh now'}
				</button>
			</div>

			<section className="space-y-3">
				<h3 className="text-sm font-bold uppercase tracking-wider text-rose-300">
					Open SOS ({incidents.length})
				</h3>
				{incidents.length === 0 ? (
					<p className="text-sm text-zinc-400">None — SOS alerts from female employees appear here live.</p>
				) : (
					incidents.map((inc) => (
						<div key={inc.id} className="border border-rose-800/60 bg-rose-950/40 p-4 space-y-2 rounded">
							<p className="font-semibold text-white">
								{inc.employee?.firstName} {inc.employee?.lastName}
							</p>
							{inc.employee?.phone ? (
								<p className="text-sm text-rose-200 font-semibold">
									Phone:{' '}
									<a href={`tel:${inc.employee.phone}`} className="underline text-brand-300">
										{inc.employee.phone}
									</a>
								</p>
							) : (
								<p className="text-xs text-zinc-500">No phone on file</p>
							)}
							<p className="text-xs text-zinc-400">
								Started {new Date(inc.createdAt).toLocaleString()}
								{inc.updatedAt ? ` · Updated ${new Date(inc.updatedAt).toLocaleString()}` : ''}
							</p>
							<p className="text-xs text-zinc-300 font-mono">
								{Number(inc.lat).toFixed(5)}, {Number(inc.lng).toFixed(5)}
							</p>
							<div className="flex flex-wrap gap-2 pt-2">
								<a
									className="inline-flex items-center justify-center rounded-lg bg-brand-500 hover:bg-brand-400 px-4 py-2.5 text-sm font-semibold text-white no-underline"
									href={`https://www.google.com/maps?q=${inc.lat},${inc.lng}`}
									target="_blank"
									rel="noreferrer"
								>
									Open live map
								</a>
								<button
									type="button"
									disabled={resolvingId === inc.id}
									className="inline-flex items-center justify-center rounded-lg border border-emerald-500/60 bg-emerald-900/50 hover:bg-emerald-800/70 px-4 py-2.5 text-sm font-semibold text-emerald-100 disabled:opacity-50"
									onClick={async () => {
										if (!confirm('Mark this SOS as resolved? It will disappear for all employees on website and mobile.')) {
											return;
										}
										setResolvingId(inc.id);
										setError('');
										setIncidents((prev) => prev.filter((x) => x.id !== inc.id));
										try {
											const res = await fetch('/api/admin/safety/resolve', {
												method: 'POST',
												headers: {
													'Content-Type': 'application/json',
													'x-admin-email': adminEmail || '',
												},
												body: JSON.stringify({ email: adminEmail, incidentId: inc.id }),
											});
											const data = await res.json().catch(() => ({}));
											if (!res.ok || !data?.success) {
												setError(data?.error || 'Could not resolve — refreshing…');
												await load();
											} else {
												await load();
											}
										} catch (e: any) {
											setError(e?.message || 'Could not resolve');
											await load();
										} finally {
											setResolvingId(null);
										}
									}}
								>
									{resolvingId === inc.id ? 'Closing…' : 'Mark resolved'}
								</button>
							</div>
						</div>
					))
				)}
			</section>

			<section className="space-y-3">
				<h3 className="text-sm font-bold uppercase tracking-wider text-sky-300">
					Girls going home — live ({trips.length})
				</h3>
				{trips.length === 0 ? (
					<p className="text-sm text-zinc-400">
						No active home trips. Appears when a female employee taps “Going home” on mobile (GPS every ~10s).
					</p>
				) : (
					trips.map((t) => {
						const liveLat = t.lat ?? t.points?.[0]?.lat;
						const liveLng = t.lng ?? t.points?.[0]?.lng;
						return (
							<div key={t.id} className="border border-sky-800/50 bg-sky-950/30 p-4 space-y-2 rounded">
								<p className="font-semibold">
									{t.employee?.firstName} {t.employee?.lastName}
									{t.employee?.phone ? (
										<span className="ml-2 text-xs font-normal text-sky-200">
											<a href={`tel:${t.employee.phone}`} className="underline">
												{t.employee.phone}
											</a>
										</span>
									) : null}
								</p>
								<p className="text-xs text-zinc-400">
									Started {new Date(t.startedAt).toLocaleString()}
									{t.updatedAt ? ` · Last ping ${new Date(t.updatedAt).toLocaleString()}` : ''}
									{t._count?.points != null ? ` · ${t._count.points} GPS points` : ''}
								</p>
								{liveLat != null && liveLng != null ? (
									<>
										<p className="text-xs text-zinc-300 font-mono">
											{Number(liveLat).toFixed(5)}, {Number(liveLng).toFixed(5)}
										</p>
										<div className="flex flex-wrap gap-2 pt-1">
											<a
												className="inline-flex items-center justify-center rounded-lg bg-sky-600 hover:bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white no-underline"
												href={`https://www.google.com/maps?q=${liveLat},${liveLng}`}
												target="_blank"
												rel="noreferrer"
											>
												Open live location
											</a>
											<button
												type="button"
												className="inline-flex items-center justify-center rounded-lg border border-sky-500/50 px-4 py-2.5 text-sm font-semibold text-sky-100"
												onClick={() => void openTripTrail(t.id)}
											>
												View trail
											</button>
										</div>
									</>
								) : (
									<p className="text-xs text-zinc-500">Waiting for first GPS ping…</p>
								)}
							</div>
						);
					})
				)}
			</section>

			<section className="space-y-3 border-t border-zinc-800 pt-6">
				<h3 className="text-sm font-bold uppercase tracking-wider text-violet-300">
					Travel history (date-wise)
				</h3>
				<p className="text-xs text-zinc-400">
					Filter by IST date and girl to see where they travelled. Path is stored from mobile GPS pings.
				</p>
				<div className="flex flex-wrap gap-3 items-end">
					<label className="text-xs text-zinc-400 space-y-1">
						<span className="block">Date (IST)</span>
						<input
							type="date"
							value={histDate}
							onChange={(e) => setHistDate(e.target.value)}
							className="bg-zinc-900 border border-zinc-700 text-white text-sm px-3 py-2 rounded"
						/>
					</label>
					<label className="text-xs text-zinc-400 space-y-1">
						<span className="block">Employee</span>
						<select
							value={histEmployeeId}
							onChange={(e) => setHistEmployeeId(e.target.value)}
							className="bg-zinc-900 border border-zinc-700 text-white text-sm px-3 py-2 rounded min-w-[200px]"
						>
							<option value="">All girls</option>
							{females.map((f) => (
								<option key={f.id} value={f.id}>
									{f.firstName} {f.lastName}
								</option>
							))}
						</select>
					</label>
					<button
						type="button"
						onClick={() => void loadHistory()}
						disabled={histLoading}
						className="rounded-lg border border-violet-500/50 bg-violet-950/40 px-4 py-2 text-sm text-violet-100 disabled:opacity-50"
					>
						{histLoading ? 'Loading…' : 'Apply filters'}
					</button>
				</div>
				{histTrips.length === 0 ? (
					<p className="text-sm text-zinc-500">No trips for this date / filter.</p>
				) : (
					histTrips.map((t) => (
						<div key={t.id} className="border border-violet-900/40 bg-violet-950/20 p-4 space-y-2 rounded">
							<p className="font-semibold">
								{t.employee?.firstName} {t.employee?.lastName}{' '}
								<span className="text-xs font-normal text-zinc-400">· {t.status}</span>
							</p>
							<p className="text-xs text-zinc-400">
								{new Date(t.startedAt).toLocaleString()}
								{t.endedAt ? ` → ${new Date(t.endedAt).toLocaleString()}` : ' → in progress'}
								{t._count?.points != null ? ` · ${t._count.points} points` : ''}
							</p>
							<button
								type="button"
								className="inline-flex items-center justify-center rounded-lg bg-violet-600 hover:bg-violet-500 px-4 py-2 text-sm font-semibold text-white"
								onClick={() => void openTripTrail(t.id)}
							>
								View travel path
							</button>
						</div>
					))
				)}
			</section>

			{selectedTrip && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
					<div className="w-full max-w-lg max-h-[85vh] overflow-auto border border-zinc-700 bg-zinc-950 p-5 space-y-3 rounded">
						<div className="flex items-start justify-between gap-3">
							<div>
								<h4 className="font-semibold text-white">
									{selectedTrip.employee?.firstName} {selectedTrip.employee?.lastName}
								</h4>
								<p className="text-xs text-zinc-400">
									{selectedTrip.status} · {(selectedTrip.points || []).length} GPS points
								</p>
							</div>
							<button
								type="button"
								className="text-zinc-400 hover:text-white text-sm"
								onClick={() => setSelectedTrip(null)}
							>
								Close
							</button>
						</div>
						{(() => {
							const pts = (selectedTrip.points || []).map((p: any) => ({
								lat: Number(p.lat),
								lng: Number(p.lng),
							}));
							const url = mapsPathUrl(pts);
							return url ? (
								<a
									href={url}
									target="_blank"
									rel="noreferrer"
									className="inline-flex w-full items-center justify-center rounded-lg bg-sky-600 hover:bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white no-underline"
								>
									Open full path in Google Maps
								</a>
							) : (
								<p className="text-sm text-zinc-500">No GPS points stored for this trip.</p>
							);
						})()}
						<ul className="space-y-1 text-xs font-mono text-zinc-300 max-h-60 overflow-auto">
							{(selectedTrip.points || []).map((p: any) => (
								<li key={p.id}>
									{new Date(p.recordedAt).toLocaleTimeString()} · {Number(p.lat).toFixed(5)},{' '}
									{Number(p.lng).toFixed(5)}
								</li>
							))}
						</ul>
					</div>
				</div>
			)}
		</div>
	);
}
