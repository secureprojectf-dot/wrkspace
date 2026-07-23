'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';

type EmpRow = {
	id: string;
	name: string;
	email: string;
	phone: string;
	wingName?: string;
	lat: number | null;
	lng: number | null;
	lastLocationAt?: string | null;
	ageMs?: number | null;
	isLive: boolean;
	hasLocation: boolean;
	liveTrackActive: boolean;
	mapsUrl?: string | null;
};

const LiveMap = dynamic(() => import('./live-tracking-map').then((m) => m.LiveTrackingMap), {
	ssr: false,
	loading: () => (
		<div className="flex h-full items-center justify-center text-sm text-zinc-500">Loading map…</div>
	),
});

function ageLabel(ageMs: number | null | undefined) {
	if (ageMs == null || ageMs < 0) return 'never';
	if (ageMs < 60_000) return `${Math.round(ageMs / 1000)}s ago`;
	if (ageMs < 3_600_000) return `${Math.round(ageMs / 60_000)}m ago`;
	if (ageMs < 86_400_000) return `${Math.round(ageMs / 3_600_000)}h ago`;
	return `${Math.round(ageMs / 86_400_000)}d ago`;
}

export function AdminLiveTrackingPanel({ adminEmail }: { adminEmail: string }) {
	const [employees, setEmployees] = useState<EmpRow[]>([]);
	const [globalActive, setGlobalActive] = useState(false);
	const [stats, setStats] = useState({ total: 0, withLocation: 0, live: 0, personalActive: 0 });
	const [busy, setBusy] = useState(false);
	const [rowBusy, setRowBusy] = useState<string | null>(null);
	const [error, setError] = useState('');
	const [lastAt, setLastAt] = useState<string | null>(null);
	const [filter, setFilter] = useState<'all' | 'live' | 'located' | 'tracking'>('all');
	const [q, setQ] = useState('');
	const [focusId, setFocusId] = useState<string | null>(null);

	const load = async () => {
		if (!adminEmail) return;
		try {
			const email = encodeURIComponent(adminEmail);
			const res = await fetch(`/api/admin/live-tracking?email=${email}&_=${Date.now()}`, {
				cache: 'no-store',
				headers: { 'x-admin-email': adminEmail },
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data?.error || `Load failed (${res.status})`);
			setEmployees(Array.isArray(data.employees) ? data.employees : []);
			setGlobalActive(Boolean(data.global?.active));
			setStats(data.stats || { total: 0, withLocation: 0, live: 0, personalActive: 0 });
			setLastAt(new Date().toLocaleTimeString());
			setError('');
		} catch (e: any) {
			setError(String(e?.message || e));
		}
	};

	const postAction = async (
		action: 'start_all' | 'stop_all' | 'start_one' | 'stop_one',
		employeeId?: string,
	) => {
		const res = await fetch('/api/admin/live-tracking', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-admin-email': adminEmail,
			},
			body: JSON.stringify({ email: adminEmail, action, employeeId }),
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok) throw new Error(data?.error || 'Action failed');
		await load();
	};

	useEffect(() => {
		if (!adminEmail) return;
		void load();
		const id = window.setInterval(() => void load(), 5000);
		return () => window.clearInterval(id);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [adminEmail]);

	const filtered = useMemo(() => {
		const needle = q.trim().toLowerCase();
		return employees.filter((e) => {
			if (filter === 'live' && !e.isLive) return false;
			if (filter === 'located' && !e.hasLocation) return false;
			if (filter === 'tracking' && !(e.liveTrackActive || globalActive)) return false;
			if (!needle) return true;
			return (
				e.name.toLowerCase().includes(needle) ||
				e.phone.toLowerCase().includes(needle) ||
				e.email.toLowerCase().includes(needle) ||
				e.id.toLowerCase().includes(needle)
			);
		});
	}, [employees, filter, q, globalActive]);

	const mapEmployees = employees.filter((e) => e.hasLocation);

	return (
		<div className="space-y-6 text-white">
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div>
					<h2 className="text-xl font-bold">Live tracking</h2>
					<p className="mt-1 max-w-xl text-xs text-zinc-400">
						Pins are each employee&apos;s phone GPS (not the office). Click a name to zoom to their
						exact pin. Green = updated in last 5 min. Track requires their wrkspace app open with
						location allowed.
						{lastAt ? ` · Refreshed ${lastAt}` : ''}
					</p>
					{error ? <p className="mt-1 text-xs text-rose-400">{error}</p> : null}
				</div>
				<div className="flex flex-wrap gap-2">
					{!globalActive ? (
						<button
							type="button"
							disabled={busy}
							onClick={async () => {
								setBusy(true);
								try {
									await postAction('start_all');
								} catch (e: any) {
									setError(String(e?.message || e));
								} finally {
									setBusy(false);
								}
							}}
							className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50"
						>
							{busy ? '…' : 'Start live tracking'}
						</button>
					) : (
						<button
							type="button"
							disabled={busy}
							onClick={async () => {
								setBusy(true);
								try {
									await postAction('stop_all');
								} catch (e: any) {
									setError(String(e?.message || e));
								} finally {
									setBusy(false);
								}
							}}
							className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold hover:bg-rose-500 disabled:opacity-50"
						>
							{busy ? '…' : 'Stop live tracking'}
						</button>
					)}
					<button
						type="button"
						onClick={() => void load()}
						className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
					>
						Refresh
					</button>
				</div>
			</div>

			<div
				className={`rounded-lg border px-4 py-3 text-sm ${
					globalActive
						? 'border-emerald-700/60 bg-emerald-950/40 text-emerald-200'
						: 'border-zinc-700 bg-zinc-900/60 text-zinc-300'
				}`}
			>
				<p className="font-semibold">
					Global tracking: {globalActive ? 'ON — phones pinging' : 'OFF'}
				</p>
				<p className="mt-1 text-xs opacity-90">
					{stats.live} live now · {stats.withLocation} have a last location · {stats.personalActive}{' '}
					personal track · {stats.total} employees
				</p>
			</div>

			<div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
				<div className="h-[420px] overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
					<LiveMap employees={mapEmployees} focusId={focusId} />
				</div>

				<div className="flex max-h-[420px] flex-col rounded-lg border border-zinc-800 bg-zinc-950">
					<div className="flex flex-wrap gap-2 border-b border-zinc-800 p-3">
						<input
							value={q}
							onChange={(e) => setQ(e.target.value)}
							placeholder="Search name / phone…"
							className="min-w-[140px] flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-white outline-none focus:border-brand-500"
						/>
						{(
							[
								['all', 'All'],
								['live', 'Live'],
								['located', 'Located'],
								['tracking', 'Tracking'],
							] as const
						).map(([id, label]) => (
							<button
								key={id}
								type="button"
								onClick={() => setFilter(id)}
								className={`rounded px-2 py-1 text-[11px] font-semibold ${
									filter === id
										? 'bg-brand-600 text-white'
										: 'bg-zinc-900 text-zinc-400 hover:text-white'
								}`}
							>
								{label}
							</button>
						))}
					</div>
					<ul className="min-h-0 flex-1 divide-y divide-zinc-800 overflow-y-auto">
						{filtered.length === 0 ? (
							<li className="p-4 text-center text-xs text-zinc-500">No employees match.</li>
						) : (
							filtered.map((e) => (
								<li key={e.id} className="px-3 py-2.5 hover:bg-zinc-900/80">
									<div className="flex items-start gap-2">
										<button
											type="button"
											className="min-w-0 flex-1 text-left"
											onClick={() => setFocusId(e.id === focusId ? null : e.id)}
										>
											<div className="flex items-center gap-2">
												<span
													className={`inline-block size-2 shrink-0 rounded-full ${
														e.isLive
															? 'bg-emerald-400'
															: e.hasLocation
																? 'bg-slate-400'
																: 'bg-zinc-700'
													}`}
												/>
												<p className="truncate text-sm font-semibold text-white">{e.name}</p>
												{e.liveTrackActive ? (
													<span className="rounded bg-emerald-900/80 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
														TRACKING
													</span>
												) : null}
											</div>
											<p className="mt-0.5 text-[11px] text-zinc-400">{e.phone}</p>
											<p className="mt-0.5 font-mono text-[10px] text-zinc-500">
												{e.hasLocation
													? `${e.lat!.toFixed(5)}, ${e.lng!.toFixed(5)} · ${ageLabel(e.ageMs)}${
															(e as any).nearOfficeName
																? ` · near ${(e as any).nearOfficeName}`
																: ''
														}`
													: 'No location yet — open app + allow GPS'}
											</p>
										</button>
										<div className="flex shrink-0 flex-col gap-1">
											{e.mapsUrl ? (
												<a
													href={e.mapsUrl}
													target="_blank"
													rel="noreferrer"
													onClick={(ev) => {
														ev.stopPropagation();
														if (e.lat != null && e.lng != null) {
															// Force exact pin URL (avoid cached office searches)
															ev.preventDefault();
															window.open(
																`https://www.google.com/maps/search/?api=1&query=${e.lat},${e.lng}`,
																'_blank',
																'noopener,noreferrer',
															);
														}
													}}
													className="rounded border border-zinc-700 px-2 py-1 text-center text-[10px] font-semibold text-zinc-200 hover:bg-zinc-800"
												>
													Maps
												</a>
											) : null}
											{e.liveTrackActive ? (
												<button
													type="button"
													disabled={rowBusy === e.id}
													onClick={async () => {
														setRowBusy(e.id);
														try {
															await postAction('stop_one', e.id);
														} catch (err: any) {
															setError(String(err?.message || err));
														} finally {
															setRowBusy(null);
														}
													}}
													className="rounded bg-rose-700/80 px-2 py-1 text-[10px] font-semibold hover:bg-rose-600 disabled:opacity-50"
												>
													Stop
												</button>
											) : (
												<button
													type="button"
													disabled={rowBusy === e.id}
													onClick={async () => {
														setRowBusy(e.id);
														try {
															await postAction('start_one', e.id);
															setFocusId(e.id);
														} catch (err: any) {
															setError(String(err?.message || err));
														} finally {
															setRowBusy(null);
														}
													}}
													className="rounded bg-emerald-700/80 px-2 py-1 text-[10px] font-semibold hover:bg-emerald-600 disabled:opacity-50"
												>
													Track
												</button>
											)}
										</div>
									</div>
								</li>
							))
						)}
					</ul>
				</div>
			</div>
		</div>
	);
}
