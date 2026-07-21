'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CorpBottomNav } from './corp-bottom-nav';
import { MobileHomeTab } from './tabs/home-tab';
import { MobileTasksTab } from './tabs/tasks-tab';
import { MobileMessagesTab } from './tabs/messages-tab';
import { MobileMoreTab } from './tabs/more-tab';
import { MobileScannerScreen } from './scanner-screen';
import { useMobileTracking } from './use-mobile-tracking';
import { MobileSafetyHub } from './safety/safety-hub';
import { MobileEmergencySos } from './safety/emergency-sos';
import { MobileHomePin } from './safety/home-pin';
import { MobileTripHistory } from './safety/trip-history';
import { EmployeeDashboard } from '@/components/ui/employee-dashboard';
import { keepCheckedIn, clockOut, startGoingHomeTrip } from '@/app/admin/actions';
import { ensureLocationPermission, getPosition, isFemaleEmployee } from '@/lib/mobile-api';
import { registerWebPush } from '@/lib/web-push';

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
	const [installHint, setInstallHint] = useState(false);
	const [messagesChatOpen, setMessagesChatOpen] = useState(false);
	const [closeChatSignal, setCloseChatSignal] = useState(0);
	const [locStatus, setLocStatus] = useState<'ok' | 'denied' | 'prompt' | 'unsupported'>('prompt');
	const [locBannerDismissed, setLocBannerDismissed] = useState(false);
	const pushStarted = useRef(false);

	const panel = panelStack[panelStack.length - 1] ?? null;

	useEffect(() => {
		document.documentElement.classList.remove('dark');
		document.documentElement.classList.add('light');
		const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
		const standalone =
			(window.navigator as any).standalone === true ||
			window.matchMedia('(display-mode: standalone)').matches;
		if (ios && !standalone) setInstallHint(true);

		// Location after first paint — never block UI
		const tLoc = window.setTimeout(() => {
			void ensureLocationPermission().then(setLocStatus);
		}, 800);

		// Push much later so SW registration cannot race first taps
		const tPush = window.setTimeout(() => {
			if (pushStarted.current) return;
			pushStarted.current = true;
			void registerWebPush(employee?.id);
		}, 4000);

		return () => {
			window.clearTimeout(tLoc);
			window.clearTimeout(tPush);
		};
	}, [employee?.id]);

	const onLeaveOffice = useCallback(() => setLeaveOpen(true), []);
	useMobileTracking({
		employee,
		enabled: locStatus === 'ok',
		onLeaveOffice,
		onLocationError: () => setLocStatus('denied'),
	});

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
				<div className={section === 'home' ? 'h-full' : 'hidden'}>
					<MobileHomeTab
						employee={employee}
						refreshToken={refreshToken}
						onOpenScanner={() => setScannerOpen(true)}
						onOpenProfile={() => openPanel('profile')}
						onOpenSafety={() => openPanel('safety')}
						onOpenPanel={openPanel}
					/>
				</div>
				<div className={section === 'tasks' ? 'h-full' : 'hidden'}>
					<MobileTasksTab employee={employee} />
				</div>
				<div className={section === 'messages' ? 'h-full' : 'hidden'}>
					<MobileMessagesTab
						employee={employee}
						onChatOpenChange={(open) => setMessagesChatOpen(open)}
						closeChatSignal={closeChatSignal}
					/>
				</div>
				<div className={section === 'more' ? 'h-full' : 'hidden'}>
					<MobileMoreTab
						employee={employee}
						onOpenPanel={openPanel}
						onLogout={onLogout}
						onProfile={() => openPanel('profile')}
					/>
				</div>
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
					<div className="flex items-center gap-2 border-b border-[#E2E8F0] bg-white px-2 py-2.5 pt-[max(10px,env(safe-area-inset-top))]">
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
								<EmployeeDashboard
									employee={employee}
									onLogout={onLogout}
									onEmployeeUpdate={onEmployeeUpdate}
									mobilePanelTab={workTab as any}
									mobileLogsOnly={workTab === 'attendance'}
								/>
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
