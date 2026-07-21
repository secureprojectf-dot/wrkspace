'use client';

import { useCallback, useEffect, useState } from 'react';
import { CorpBottomNav } from './corp-bottom-nav';
import { MobileHomeTab } from './tabs/home-tab';
import { MobileTasksTab } from './tabs/tasks-tab';
import { MobileMessagesTab } from './tabs/messages-tab';
import { MobileMoreTab } from './tabs/more-tab';
import { MobileScannerScreen } from './scanner-screen';
import { useMobileTracking } from './use-mobile-tracking';
import { EmployeeDashboard } from '@/components/ui/employee-dashboard';
import { keepCheckedIn, clockOut, startGoingHomeTrip } from '@/app/admin/actions';
import { getPosition, isFemaleEmployee } from '@/lib/mobile-api';
import { registerWebPush } from '@/lib/web-push';

type Section = 'home' | 'tasks' | 'messages' | 'more';

type Props = {
	employee: any;
	onLogout: () => void;
	onEmployeeUpdate?: (next: any) => void;
};

const PANEL_TAB: Record<string, string> = {
	attendance: 'attendance',
	leaves: 'leaves',
	events: 'events',
	submissions: 'work_submission',
	leads: 'leads',
	companies: 'hr_companies',
	profile: 'profile',
	id_card: 'id_card',
	safety: 'safety',
	sos: 'safety',
	home_pin: 'safety',
	trips: 'safety',
	tasks: 'tasks',
};

export function MobileAppShell({ employee, onLogout, onEmployeeUpdate }: Props) {
	const [section, setSection] = useState<Section>('home');
	const [scannerOpen, setScannerOpen] = useState(false);
	const [refreshToken, setRefreshToken] = useState(0);
	const [panel, setPanel] = useState<string | null>(null);
	const [leaveOpen, setLeaveOpen] = useState(false);
	const [leaveBusy, setLeaveBusy] = useState(false);
	const [installHint, setInstallHint] = useState(false);

	useEffect(() => {
		document.documentElement.classList.remove('dark');
		document.documentElement.classList.add('light');
		void registerWebPush(employee?.id);
		const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
		const standalone =
			(window.navigator as any).standalone === true ||
			window.matchMedia('(display-mode: standalone)').matches;
		if (ios && !standalone) setInstallHint(true);
	}, [employee?.id]);

	const onLeaveOffice = useCallback(() => setLeaveOpen(true), []);
	useMobileTracking({ employee, enabled: true, onLeaveOffice });

	const openPanel = (key: string) => {
		if (key === 'tasks') {
			setSection('tasks');
			return;
		}
		setPanel(key);
	};

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

	const forcedTab = panel ? PANEL_TAB[panel] || 'profile' : null;

	return (
		<div className="mobile-flutter-shell fixed inset-0 z-40 flex flex-col bg-[#F0F3FF] text-[#0F172A] antialiased">
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
					<MobileMessagesTab employee={employee} />
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
				onHome={() => setSection('home')}
				onTasks={() => setSection('tasks')}
				onMessages={() => setSection('messages')}
				onMore={() => setSection('more')}
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

			{forcedTab ? (
				<div className="fixed inset-0 z-[70] flex flex-col bg-[#e8edf5]">
					<div className="flex items-center gap-3 border-b border-slate-300 bg-white px-3 py-3 pt-[max(12px,env(safe-area-inset-top))]">
						<button
							type="button"
							onClick={() => setPanel(null)}
							className="rounded-lg px-3 py-2 text-sm font-semibold text-[#0047FF]"
						>
							← Back
						</button>
						<p className="text-sm font-bold capitalize text-slate-800">
							{String(forcedTab).replace('_', ' ')}
						</p>
					</div>
					<div className="min-h-0 flex-1 overflow-y-auto">
						<EmployeeDashboard
							employee={employee}
							onLogout={onLogout}
							onEmployeeUpdate={onEmployeeUpdate}
							mobilePanelTab={forcedTab as any}
						/>
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
