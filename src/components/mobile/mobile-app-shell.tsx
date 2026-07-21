'use client';

import { useCallback, useEffect, useRef, useState, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { CorpBottomNav } from './corp-bottom-nav';
import { MobileHomeTab } from './tabs/home-tab';
import {
	clearOfficeExitPending,
	markOfficeExitPending,
	readOfficeExitPending,
	useMobileTracking,
} from './use-mobile-tracking';
import { keepCheckedIn, clockOut, startGoingHomeTrip } from '@/app/admin/actions';
import { ensureLocationPermission, getPosition, isFemaleEmployee } from '@/lib/mobile-api';
import { importWithRetry } from '@/lib/import-with-retry';
import { registerWebPush, subscribeOfficeExitPush } from '@/lib/web-push';

const AUTO_CHECKOUT_MS = 5 * 60 * 1000;

function TabLoading() {
	return (
		<div className="flex h-full items-center justify-center">
			<div className="size-7 animate-spin rounded-full border-2 border-[#0047FF] border-t-transparent" />
		</div>
	);
}

const MobileTasksTab = dynamic(
	() =>
		importWithRetry(() =>
			import('./tabs/tasks-tab').then((m) => m.MobileTasksTab),
		),
	{ ssr: false, loading: () => <TabLoading /> },
);
const MobileMessagesTab = dynamic(
	() =>
		importWithRetry(() =>
			import('./tabs/messages-tab').then((m) => m.MobileMessagesTab),
		),
	{ ssr: false, loading: () => <TabLoading /> },
);
const MobileMoreTab = dynamic(
	() =>
		importWithRetry(() =>
			import('./tabs/more-tab').then((m) => m.MobileMoreTab),
		),
	{ ssr: false, loading: () => <TabLoading /> },
);
const MobileScannerScreen = dynamic(
	() =>
		importWithRetry(() =>
			import('./scanner-screen').then((m) => m.MobileScannerScreen),
		),
	{ ssr: false },
);
const MobileSafetyHub = dynamic(
	() =>
		importWithRetry(() =>
			import('./safety/safety-hub').then((m) => m.MobileSafetyHub),
		),
	{ ssr: false },
);
const MobileEmergencySos = dynamic(
	() =>
		importWithRetry(() =>
			import('./safety/emergency-sos').then((m) => m.MobileEmergencySos),
		),
	{ ssr: false },
);
const MobileHomePin = dynamic(
	() =>
		importWithRetry(() =>
			import('./safety/home-pin').then((m) => m.MobileHomePin),
		),
	{ ssr: false },
);
const MobileTripHistory = dynamic(
	() =>
		importWithRetry(() =>
			import('./safety/trip-history').then((m) => m.MobileTripHistory),
		),
	{ ssr: false },
);
const EmployeeDashboard = dynamic(
	() =>
		importWithRetry(() =>
			import('@/components/ui/employee-dashboard').then((m) => m.EmployeeDashboard),
		),
	{ ssr: false },
);

type Section = 'home' | 'tasks' | 'messages' | 'more';

type Props = {
	employee: any;
	onLogout: () => void;
	onEmployeeUpdate?: (next: any) => void;
};

const WORK_PANEL_TAB: Record<string, string> = {
	attendance: 'attendance',
	leaves: 'leaves',
	events: 'events',
	submissions: 'work_submission',
	leads: 'leads',
	companies: 'hr_companies',
	profile: 'profile',
	id_card: 'id_card',
};

const PANEL_TITLES: Record<string, string> = {
	attendance: 'Attendance logs',
	leaves: 'Leaves',
	events: 'All events',
	submissions: 'Submissions',
	leads: 'Leads',
	companies: 'Companies',
	profile: 'Profile',
	id_card: 'ID card',
	safety: 'Girl Safety',
	sos: 'Emergency SOS',
	home_pin: 'Home pin',
	trips: 'Trip history',
};

const SAFETY_KEYS = new Set(['safety', 'sos', 'home_pin', 'trips']);

/**
 * Mobile shell — pure React navigation (no History API).
 * pushState/popstate was unloading the document on Android Chrome
 * ("This page couldn't load").
 */
export function MobileAppShell({ employee, onLogout, onEmployeeUpdate }: Props) {
	const [section, setSection] = useState<Section>('home');
	const [scannerOpen, setScannerOpen] = useState(false);
	const [refreshToken, setRefreshToken] = useState(0);
	const [panelStack, setPanelStack] = useState<string[]>([]);
	const [leaveOpen, setLeaveOpen] = useState(false);
	const [leaveBusy, setLeaveBusy] = useState(false);
	const [leaveSecondsLeft, setLeaveSecondsLeft] = useState(300);
	const [installHint, setInstallHint] = useState(false);
	const [messagesChatOpen, setMessagesChatOpen] = useState(false);
	const [closeChatSignal, setCloseChatSignal] = useState(0);
	const [locStatus, setLocStatus] = useState<'ok' | 'denied' | 'prompt' | 'unsupported'>('prompt');
	const [locBannerDismissed, setLocBannerDismissed] = useState(false);
	const leaveTimerRef = useRef<number | undefined>(undefined);
	const leaveTickRef = useRef<number | undefined>(undefined);
	const leaveBusyRef = useRef(false);

	const panel = panelStack[panelStack.length - 1] ?? null;
	leaveBusyRef.current = leaveBusy;

	const openLeaveDialog = useCallback(() => {
		markOfficeExitPending();
		setLeaveOpen(true);
	}, []);

	const clearLeaveTimers = useCallback(() => {
		if (leaveTimerRef.current) window.clearTimeout(leaveTimerRef.current);
		if (leaveTickRef.current) window.clearInterval(leaveTickRef.current);
		leaveTimerRef.current = undefined;
		leaveTickRef.current = undefined;
	}, []);

	useEffect(() => {
		document.documentElement.classList.remove('dark');
		document.documentElement.classList.add('light');

		const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
		const standalone =
			(window.navigator as any).standalone === true ||
			window.matchMedia('(display-mode: standalone)').matches;
		if (ios && !standalone) setInstallHint(true);

		const tLoc = window.setTimeout(() => {
			void ensureLocationPermission().then(setLocStatus);
		}, 2500);

		// FCM after first paint — never block shell mount (Android Chrome stability).
		const tPush = window.setTimeout(() => {
			void registerWebPush(employee?.id).then(() => {
				subscribeOfficeExitPush(openLeaveDialog);
			});
		}, 3500);

		// Restore pending leave choice after a beat (don't block first paint)
		const tLeave = window.setTimeout(() => {
			try {
				const params = new URLSearchParams(window.location.search);
				if (params.get('office_exit') === '1' || readOfficeExitPending()) {
					openLeaveDialog();
					if (params.get('office_exit') === '1') {
						params.delete('office_exit');
						const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`;
						window.history.replaceState(null, '', next);
					}
				}
			} catch {
				/* ignore */
			}
		}, 800);

		return () => {
			window.clearTimeout(tLoc);
			window.clearTimeout(tPush);
			window.clearTimeout(tLeave);
			clearLeaveTimers();
		};
	}, [employee?.id, openLeaveDialog, clearLeaveTimers]);

	useMobileTracking({
		employee,
		enabled: locStatus === 'ok',
		onLeaveOffice: openLeaveDialog,
		onLocationError: () => setLocStatus('denied'),
	});

	// 5 min no reply → auto check-out (Flutter parity)
	useEffect(() => {
		if (!leaveOpen) {
			clearLeaveTimers();
			return;
		}
		const pending = readOfficeExitPending();
		const startedAt = pending?.at || Date.now();
		if (!pending) markOfficeExitPending();

		const tick = () => {
			const elapsed = Date.now() - startedAt;
			const left = Math.max(0, Math.ceil((AUTO_CHECKOUT_MS - elapsed) / 1000));
			setLeaveSecondsLeft(left);
		};
		tick();
		leaveTickRef.current = window.setInterval(tick, 1000);

		const remaining = Math.max(0, AUTO_CHECKOUT_MS - (Date.now() - startedAt));
		leaveTimerRef.current = window.setTimeout(() => {
			if (leaveBusyRef.current) return;
			void (async () => {
				try {
					await clockOut(employee.id, 'outside_geofence_timeout');
				} catch {
					/* ignore */
				}
				clearOfficeExitPending();
				setLeaveOpen(false);
				setRefreshToken((n) => n + 1);
			})();
		}, remaining);

		return () => clearLeaveTimers();
	}, [leaveOpen, employee.id, clearLeaveTimers]);

	const openPanel = useCallback((key: string) => {
		if (key === 'tasks') {
			setSection('tasks');
			return;
		}
		setPanelStack((s) => [...s, key]);
	}, []);

	const popPanel = useCallback(() => {
		setPanelStack((s) => s.slice(0, -1));
	}, []);

	const goHome = useCallback(() => {
		setMessagesChatOpen(false);
		setCloseChatSignal((n) => n + 1);
		setPanelStack([]);
		setScannerOpen(false);
		setSection('home');
	}, []);

	const handleLeaveChoice = async (mode: 'office_work' | 'going_home') => {
		if (leaveBusy) return;
		setLeaveBusy(true);
		clearLeaveTimers();
		try {
			if (mode === 'office_work') {
				await keepCheckedIn(employee.id, 'office_work');
			} else {
				await clockOut(employee.id, 'going_home');
				if (isFemaleEmployee(employee)) {
					try {
						const pos = await getPosition(12000);
						await startGoingHomeTrip(employee.id, pos.coords.latitude, pos.coords.longitude);
					} catch {
						/* optional */
					}
				}
			}
			clearOfficeExitPending();
			setLeaveOpen(false);
			setRefreshToken((n) => n + 1);
		} catch {
			/* ignore */
		} finally {
			setLeaveBusy(false);
		}
	};

	const workTab = panel && WORK_PANEL_TAB[panel] ? WORK_PANEL_TAB[panel] : null;
	const isSafetyPanel = panel != null && SAFETY_KEYS.has(panel);
	const panelOpen = Boolean(workTab || isSafetyPanel);
	const hideNav = (messagesChatOpen && section === 'messages') || panelOpen || scannerOpen;

	const requestLocation = async () => {
		const status = await ensureLocationPermission({ forcePrompt: true });
		setLocStatus(status);
		setLocBannerDismissed(false);
	};

	return (
		<div
			className="mobile-flutter-shell fixed inset-0 z-40 flex flex-col bg-[#F0F3FF] text-[#0F172A] antialiased"
			style={{
				fontFamily:
					'var(--font-inter), Inter, ui-sans-serif, system-ui, -apple-system, sans-serif',
			}}
		>
			{/* iOS PWA status bar (clock / signal) — always brand blue, never amber banners */}
			<div
				className="shrink-0 bg-[#0047FF]"
				style={{ height: 'env(safe-area-inset-top, 0px)' }}
				aria-hidden
			/>

			{installHint ? (
				<div className="z-50 flex items-start gap-2 bg-[#0047FF] px-3 py-2 text-[12px] font-medium text-white">
					<p className="min-w-0 flex-1">
						iPhone: Share → <strong>Add to Home Screen</strong> for app icon + notifications.
					</p>
					<button type="button" className="shrink-0 underline" onClick={() => setInstallHint(false)}>
						OK
					</button>
				</div>
			) : null}

			{!locBannerDismissed &&
			(locStatus === 'denied' || locStatus === 'prompt' || locStatus === 'unsupported') ? (
				<div className="z-50 flex items-start gap-2 bg-amber-500 px-3 py-2 text-[12px] font-medium text-amber-950">
					<p className="min-w-0 flex-1">
						{locStatus === 'unsupported'
							? 'This browser cannot share location. Use HTTPS or install as PWA for live tracking.'
							: 'Allow location for attendance geofence, leave-office alerts, and Girl Safety tracking.'}
					</p>
					{locStatus !== 'unsupported' ? (
						<button
							type="button"
							className="shrink-0 font-bold underline"
							onClick={() => void requestLocation()}
						>
							Enable
						</button>
					) : null}
					<button type="button" className="shrink-0 underline" onClick={() => setLocBannerDismissed(true)}>
						Later
					</button>
				</div>
			) : null}

			<div className="relative min-h-0 flex-1">
				{/* Mount only the active tab so Android does not load all chunks at once */}
				{section === 'home' ? (
					<div className="h-full">
						<MobileHomeTab
							employee={employee}
							refreshToken={refreshToken}
							onOpenScanner={() => setScannerOpen(true)}
							onOpenProfile={() => openPanel('profile')}
							onOpenSafety={() => openPanel('safety')}
							onOpenPanel={openPanel}
						/>
					</div>
				) : null}
				{section === 'tasks' ? (
					<div className="h-full">
						<MobileTasksTab employee={employee} />
					</div>
				) : null}
				{section === 'messages' ? (
					<div className="h-full">
						<MobileMessagesTab
							employee={employee}
							onChatOpenChange={(open) => setMessagesChatOpen(open)}
							closeChatSignal={closeChatSignal}
						/>
					</div>
				) : null}
				{section === 'more' ? (
					<div className="h-full">
						<MobileMoreTab
							employee={employee}
							onOpenPanel={openPanel}
							onLogout={onLogout}
							onProfile={() => openPanel('profile')}
						/>
					</div>
				) : null}
			</div>

			<CorpBottomNav
				section={section}
				hidden={hideNav}
				onHome={goHome}
				onTasks={() => {
					setMessagesChatOpen(false);
					setCloseChatSignal((n) => n + 1);
					setPanelStack([]);
					setScannerOpen(false);
					setSection('tasks');
				}}
				onMessages={() => {
					setPanelStack([]);
					setScannerOpen(false);
					setSection('messages');
				}}
				onMore={() => {
					setMessagesChatOpen(false);
					setCloseChatSignal((n) => n + 1);
					setPanelStack([]);
					setScannerOpen(false);
					setSection('more');
				}}
				onScanner={() => setScannerOpen(true)}
			/>

			{scannerOpen ? (
				<MobileScannerScreen
					onClose={(ok) => {
						setScannerOpen(false);
						if (ok) {
							setSection('home');
							setRefreshToken((n) => n + 1);
						}
					}}
				/>
			) : null}

			{panelOpen && panel ? (
				<div className="fixed inset-0 z-[70] flex flex-col bg-[#F0F3FF]">
					<div className="flex items-center gap-2 border-b border-[#E2E8F0] bg-white px-2 py-2.5">
						<button
							type="button"
							onClick={popPanel}
							className="rounded-lg px-3 py-2 text-sm font-semibold text-[#0047FF]"
						>
							← Back
						</button>
						<p className="truncate text-sm font-bold text-[#0F172A]">
							{PANEL_TITLES[panel] || panel}
						</p>
					</div>
					<div className="min-h-0 flex-1 overflow-y-auto">
						{panel === 'safety' ? (
							<MobileSafetyHub employee={employee} onOpen={openPanel} />
						) : null}
						{panel === 'sos' ? <MobileEmergencySos employee={employee} /> : null}
						{panel === 'home_pin' ? (
							<MobileHomePin employee={employee} onEmployeeUpdate={onEmployeeUpdate} />
						) : null}
						{panel === 'trips' ? <MobileTripHistory employee={employee} /> : null}
						{workTab ? (
							<div className="emp-mobile-panel h-full">
								<Suspense
									fallback={
										<div className="flex justify-center py-16">
											<div className="size-6 animate-spin rounded-full border-2 border-[#0047FF] border-t-transparent" />
										</div>
									}
								>
									<EmployeeDashboard
										employee={employee}
										onLogout={onLogout}
										onEmployeeUpdate={onEmployeeUpdate}
										mobilePanelTab={workTab as any}
										mobileLogsOnly={workTab === 'attendance'}
									/>
								</Suspense>
							</div>
						) : null}
					</div>
				</div>
			) : null}

			{leaveOpen ? (
				<div className="fixed inset-0 z-[90] flex items-end bg-black/45 sm:items-center sm:justify-center">
					<div className="w-full rounded-t-2xl bg-white p-5 sm:max-w-md sm:rounded-2xl">
						<p className="text-lg font-bold text-[#0F172A]">Leaving office area</p>
						<p className="mt-2 text-sm text-[#64748B]">
							{isFemaleEmployee(employee)
								? 'Outside office — choose within 5 min. Office work stays checked in. Going home checks out + live track until home.'
								: 'Outside office — choose within 5 min. Office work stays checked in. Going home checks you out.'}
						</p>
						<p className="mt-2 text-xs font-semibold text-[#B42318]">
							No reply → auto check-out in {Math.floor(leaveSecondsLeft / 60)}:
							{String(leaveSecondsLeft % 60).padStart(2, '0')}
						</p>
						<div className="mt-4 flex flex-col gap-2">
							<button
								type="button"
								disabled={leaveBusy}
								onClick={() => void handleLeaveChoice('office_work')}
								className="rounded-xl border border-[#E2E8F0] py-3 text-sm font-semibold text-[#0F172A]"
							>
								Office work
							</button>
							<button
								type="button"
								disabled={leaveBusy}
								onClick={() => void handleLeaveChoice('going_home')}
								className="rounded-xl bg-[#0047FF] py-3 text-sm font-semibold text-white"
							>
								Going home
							</button>
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}
