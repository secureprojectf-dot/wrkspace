'use client';

import { useCallback, useEffect, useState } from 'react';
import {
	CalendarDays,
	ChevronRight,
	CircleCheck,
	Clock,
	FileText,
	Leaf,
	LogOut,
	QrCode,
	Siren,
	TrendingUp,
} from 'lucide-react';
import { CorpPageHeader } from '../corp-page-header';
import { apiGet, apiPost, getPosition, isFemaleEmployee } from '@/lib/mobile-api';
import {
	clockOut,
	getCurrentAttendanceStatus,
	getEventsForEmployee,
	getOpenSosIncidents,
	startGoingHomeTrip,
} from '@/app/admin/actions';
import { cn } from '@/lib/utils';

/** Never pass Date/objects into JSX — React #31 crash on Android. */
function asText(value: unknown, fallback = '—'): string {
	if (value == null || value === '') return fallback;
	if (value instanceof Date) {
		if (Number.isNaN(value.getTime())) return fallback;
		return value.toLocaleString();
	}
	if (typeof value === 'object') return fallback;
	const s = String(value).trim();
	return s || fallback;
}

function asDayText(value: unknown, fallback = ''): string {
	if (value == null || value === '') return fallback;
	if (value instanceof Date) {
		if (Number.isNaN(value.getTime())) return fallback;
		return value.toLocaleDateString();
	}
	if (typeof value === 'object') return fallback;
	return String(value).trim() || fallback;
}

type Props = {
	employee: any;
	refreshToken: number;
	onOpenScanner: () => void;
	onOpenProfile: () => void;
	onOpenSafety?: () => void;
	onOpenPanel?: (panel: string) => void;
};

export function MobileHomeTab({
	employee,
	refreshToken,
	onOpenScanner,
	onOpenProfile,
	onOpenSafety,
	onOpenPanel,
}: Props) {
	const [today, setToday] = useState<any>(null);
	const [overview, setOverview] = useState<any>(null);
	const [events, setEvents] = useState<any[]>([]);
	const [openSos, setOpenSos] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [clockBusy, setClockBusy] = useState(false);
	const [toast, setToast] = useState<string | null>(null);

	const female = isFemaleEmployee(employee);
	const onShift = Boolean(
		today?.checkIn && (!today?.checkOut || String(today.checkOut).trim() === ''),
	);

	const refresh = useCallback(async () => {
		setLoading(true);
		try {
			const [att, ov, ev] = await Promise.all([
				apiGet<{ attendance?: any }>('/api/attendance/today').catch(() => ({})),
				apiGet<{ overview?: any }>('/api/overview').catch(() => ({})),
				getEventsForEmployee(employee.id).catch(() => []),
			]);
			setToday((att as any).attendance ?? (att as any) ?? null);
			setOverview((ov as any).overview ?? null);
			setEvents(Array.isArray(ev) ? ev.slice(0, 3) : []);
			try {
				const st = await getCurrentAttendanceStatus(employee.id);
				if (st?.status === 'checked_in' || st?.status === 'checked_out') {
					/* keep API today as source of truth */
				}
			} catch {
				/* ignore */
			}
		} finally {
			setLoading(false);
		}
	}, [employee.id]);

	useEffect(() => {
		void refresh();
	}, [refresh, refreshToken]);

	useEffect(() => {
		let alive = true;
		const poll = async () => {
			try {
				const rows = await getOpenSosIncidents(Date.now());
				if (alive) setOpenSos(Array.isArray(rows) ? rows : []);
			} catch {
				/* ignore */
			}
		};
		void poll();
		const t = window.setInterval(poll, 12000);
		return () => {
			alive = false;
			window.clearInterval(t);
		};
	}, []);

	const showToast = (msg: string) => {
		setToast(msg);
		window.setTimeout(() => setToast(null), 2800);
	};

	const handleClockOut = async () => {
		if (clockBusy) return;
		const ok = window.confirm(
			female
				? 'Check out? Maps/tracking can run until you reach home.'
				: 'Check out for today? You can check in again when you return.',
		);
		if (!ok) return;
		setClockBusy(true);
		try {
			const token =
				localStorage.getItem('wrkspace_employee_token') ||
				(JSON.parse(localStorage.getItem('wrkspace_employee_session') || '{}') as any)?.token;
			if (token) {
				try {
					const pos = await getPosition(12000);
					await apiPost('/api/attendance/clock-out', {
						lat: pos.coords.latitude,
						lng: pos.coords.longitude,
						reason: 'manual',
					});
				} catch {
					await clockOut(employee.id, 'manual');
				}
			} else {
				await clockOut(employee.id, 'manual');
			}
			if (female) {
				try {
					const pos = await getPosition(12000);
					await startGoingHomeTrip(employee.id, pos.coords.latitude, pos.coords.longitude);
				} catch {
					/* optional */
				}
			}
			showToast(female ? 'Checked out — tracking until home' : 'Checked out');
			await refresh();
		} catch (e: any) {
			showToast(e?.message || 'Checkout failed');
		} finally {
			setClockBusy(false);
		}
	};

	const o = overview || {};
	const metrics = [
		{
			icon: CircleCheck,
			label: 'Tasks',
			value: String(o.tasksTotal ?? o.tasksPending ?? 0),
			sub: `${o.tasksPending ?? 0} open`,
		},
		{
			icon: Clock,
			label: 'Attendance',
			value: onShift ? 'On shift' : 'Off shift',
			sub: undefined,
		},
		{
			icon: Leaf,
			label: 'Leaves',
			value: String(o.leavesPending ?? 0),
			sub: 'pending',
		},
		{
			icon: FileText,
			label: 'Submissions',
			value: String(o.submissionsTotal ?? 0),
			sub: `${o.submissionsPending ?? 0} pending`,
		},
		{
			icon: TrendingUp,
			label: 'Leads',
			value: String(o.leadsActive ?? 0),
			sub: 'active',
		},
		{
			icon: CalendarDays,
			label: 'Events',
			value: String(o.eventsCount ?? events.length),
			sub: 'planned',
		},
	];

	return (
		<div className="flex h-full min-h-0 flex-col bg-[#F0F3FF]">
			<CorpPageHeader
				employee={employee}
				subtitle={onShift ? 'On shift · have a productive day' : 'Your workplace dashboard'}
				onProfile={onOpenProfile}
			/>
			<div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4" style={{ paddingBottom: 'calc(172px + env(safe-area-inset-bottom, 0px))' }}>
				{toast ? (
					<div className="mb-3 rounded-xl bg-[#0047FF] px-3 py-2 text-center text-sm font-semibold text-white">
						{toast}
					</div>
				) : null}

				<section className="rounded-[14px] border border-[#E2E8F0] bg-white p-4">
					<div className="flex items-start gap-2.5">
						<Clock className={cn('mt-0.5 size-5', onShift ? 'text-[#067647]' : 'text-[#64748B]')} />
						<div className="min-w-0 flex-1">
							<p className="text-base font-bold text-[#0F172A]">Attendance today</p>
							<p
								className={cn(
									'text-[13px] font-semibold',
									onShift ? 'text-[#067647]' : 'text-[#64748B]',
								)}
							>
								{onShift ? 'On shift' : today?.checkIn ? 'Checked out' : 'Not checked in'}
							</p>
						</div>
						<button
							type="button"
							className="text-[13px] font-semibold text-[#0047FF]"
							onClick={() => onOpenPanel?.('attendance')}
						>
							Logs
						</button>
					</div>
					<div className="mt-3.5 flex">
						<div className="flex-1 px-2">
							<p className="text-[11px] font-semibold text-[#64748B]">Check-in</p>
							<p className="text-[15px] font-bold text-[#0F172A]">{asText(today?.checkIn)}</p>
						</div>
						<div className="w-px self-stretch bg-[#E2E8F0]" />
						<div className="flex-1 px-2">
							<p className="text-[11px] font-semibold text-[#64748B]">Check-out</p>
							<p className="text-[15px] font-bold text-[#0F172A]">{asText(today?.checkOut)}</p>
						</div>
					</div>
					<div className="mt-3.5 space-y-2">
						{onShift ? (
							<>
								<button
									type="button"
									disabled={clockBusy}
									onClick={() => void handleClockOut()}
									className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0047FF] py-3.5 text-sm font-semibold text-white disabled:opacity-60"
								>
									<LogOut className="size-4" />
									{clockBusy ? 'Checking out…' : 'Check out'}
								</button>
								<button
									type="button"
									onClick={onOpenScanner}
									className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#0047FF] py-3 text-sm font-semibold text-[#0047FF]"
								>
									<QrCode className="size-4" />
									Scan QR again
								</button>
							</>
						) : (
							<button
								type="button"
								onClick={onOpenScanner}
								className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0047FF] py-3.5 text-sm font-semibold text-white"
							>
								<QrCode className="size-4" />
								{today?.checkIn ? 'Scan QR to check in again' : 'Scan QR to check in'}
							</button>
						)}
					</div>
				</section>

				{openSos.length > 0 ? (
					<button
						type="button"
						onClick={() => onOpenPanel?.('safety')}
						className="mt-4 flex w-full items-center gap-3 rounded-[14px] border border-rose-200 bg-rose-50 px-3.5 py-3.5 text-left"
					>
						<Siren className="size-5 shrink-0 text-[#B42318]" />
						<p className="min-w-0 flex-1 text-sm font-semibold text-[#B42318]">
							{openSos.length} open SOS alert{openSos.length === 1 ? '' : 's'} — tap for live map
						</p>
						<ChevronRight className="size-5 text-rose-400" />
					</button>
				) : null}

				{female ? (
					<section className="mt-4 rounded-[14px] border border-[#E2E8F0] bg-white p-4">
						<div className="flex items-center gap-2.5">
							<img
								src="/branding/girl-safety-logo.png"
								alt=""
								className="size-9 object-contain"
								onError={(e) => {
									(e.target as HTMLImageElement).src = '/branding/girl-safety-logo-64.png';
								}}
							/>
							<div className="min-w-0 flex-1">
								<p className="text-base font-bold text-[#0F172A]">Girl Safety</p>
								<p className="text-[12.5px] font-medium text-[#64748B]">
									Track only going home after checkout · SOS
								</p>
							</div>
						</div>
						<div className="mt-3 flex gap-2">
							<button
								type="button"
								onClick={onOpenSafety}
								className="flex-1 rounded-xl border border-[#9D174D] py-3 text-sm font-semibold text-[#9D174D]"
							>
								Open safety
							</button>
							<button
								type="button"
								onClick={() => onOpenPanel?.('sos')}
								className="flex-1 rounded-xl bg-[#B42318] py-3 text-sm font-semibold text-white"
							>
								SOS
							</button>
						</div>
					</section>
				) : null}

				<section className="mt-4 rounded-[14px] border border-[#E2E8F0] bg-white p-2">
					{loading && !overview ? (
						<div className="flex justify-center py-8">
							<div className="size-5 animate-spin rounded-full border-2 border-[#0047FF] border-t-transparent" />
						</div>
					) : (
						<div className="grid grid-cols-2 gap-2">
							{metrics.map((m) => {
								const Icon = m.icon;
								return (
									<button
										key={m.label}
										type="button"
										onClick={() =>
											onOpenPanel?.(
												m.label === 'Tasks'
													? 'tasks'
													: m.label === 'Leaves'
														? 'leaves'
														: m.label === 'Events'
															? 'events'
															: m.label === 'Leads'
																? 'leads'
																: m.label === 'Submissions'
																	? 'submissions'
																	: 'attendance',
											)
										}
										className="rounded-[10px] bg-[#F0F3FF] px-2.5 py-2.5 text-left"
									>
										<Icon className="size-[18px] text-[#0047FF]" strokeWidth={2} />
										<p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.4px] text-[#64748B]">
											{m.label}
										</p>
										<p className="text-[13.5px] font-bold text-[#0F172A]">{m.value}</p>
										{m.sub ? (
											<p className="text-[10px] font-medium text-[#64748B]">{m.sub}</p>
										) : null}
									</button>
								);
							})}
						</div>
					)}
				</section>

				<section className="mt-4 rounded-[14px] border border-[#E2E8F0] bg-white p-4">
					<div className="mb-2 flex items-center justify-between">
						<p className="text-base font-bold text-[#0F172A]">Upcoming events</p>
						<button
							type="button"
							className="text-[13px] font-semibold text-[#0047FF]"
							onClick={() => onOpenPanel?.('events')}
						>
							See all
						</button>
					</div>
					{events.length === 0 ? (
						<p className="py-3 text-[13.5px] text-[#64748B]">No upcoming events right now.</p>
					) : (
						<ul className="divide-y divide-[#E2E8F0]">
							{events.map((ev: any) => (
								<li key={ev.id}>
									<button
										type="button"
										onClick={() => onOpenPanel?.('events')}
										className="flex w-full items-center gap-2 py-2.5 text-left"
									>
										<div className="min-w-0 flex-1">
											<p className="truncate text-sm font-semibold text-[#0F172A]">
												{ev.title || ev.name}
											</p>
											<p className="text-xs font-bold text-[#0047FF]">
												{asDayText(ev.date || ev.eventDate || ev.startDate)}
											</p>
										</div>
										<ChevronRight className="size-4 text-[#94A3B8]" />
									</button>
								</li>
							))}
						</ul>
					)}
				</section>
			</div>
		</div>
	);
}
