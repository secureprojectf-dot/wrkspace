'use client';

import { useEffect, useState } from 'react';
import { ChevronRight, Home, Route, Siren } from 'lucide-react';
import { getOpenSosIncidents } from '@/app/admin/actions';
import { apiGet, isFemaleEmployee } from '@/lib/mobile-api';

type Props = {
	employee: any;
	onOpen: (key: 'sos' | 'home_pin' | 'trips') => void;
};

export function MobileSafetyHub({ employee, onOpen }: Props) {
	const female = isFemaleEmployee(employee);
	const hasHome = employee?.homeLat != null && employee?.homeLng != null;
	const canEditHome = !hasHome || employee?.homeEditAllowed !== false;
	const [activeTrip, setActiveTrip] = useState<any>(null);
	const [incidents, setIncidents] = useState<any[]>([]);

	useEffect(() => {
		const load = async () => {
			try {
				const rows = await getOpenSosIncidents(Date.now());
				setIncidents(Array.isArray(rows) ? rows : []);
			} catch {
				/* ignore */
			}
			if (female) {
				try {
					const d = await apiGet<{ trip?: any }>('/api/safety/trips/home');
					setActiveTrip(d.trip || null);
				} catch {
					setActiveTrip(null);
				}
			}
		};
		void load();
		const t = window.setInterval(() => void load(), 15000);
		return () => window.clearInterval(t);
	}, [female, employee?.id]);

	const links = [
		{ key: 'sos' as const, label: 'Emergency SOS', sub: 'Share live location with everyone', icon: Siren, color: '#B42318' },
		{ key: 'home_pin' as const, label: 'Home pin', sub: hasHome ? 'View or update home location' : 'Set home for commute tracking', icon: Home, color: '#0369A1' },
		{ key: 'trips' as const, label: 'Trip history', sub: 'Past going-home routes', icon: Route, color: '#475569' },
	];

	return (
		<div className="space-y-4 p-4 pb-8">
			{female ? (
				<div className="flex flex-col items-center rounded-[14px] border border-[#E2E8F0] bg-white p-5 text-center">
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img src="/branding/girl-safety-logo.png" alt="" className="size-[72px] object-contain" />
					<p className="mt-2 text-lg font-extrabold text-[#9D174D]">Girl Safety</p>
					<p className="mt-1 text-xs text-[#64748B]">Commute tracking & SOS for your safety</p>
				</div>
			) : (
				<div className="rounded-[14px] border border-[#E2E8F0] bg-white p-4">
					<p className="text-base font-bold text-[#0F172A]">Safety alerts</p>
					<p className="text-xs text-[#64748B]">Open SOS incidents from enrolled staff</p>
				</div>
			)}

			<div className="rounded-[14px] border border-[#E2E8F0] bg-white p-4">
				<p className="text-sm font-bold text-[#0F172A]">Open SOS alerts</p>
				<p className="mt-1 text-xs text-[#64748B]">Clears when admin marks resolved.</p>
				{incidents.length === 0 ? (
					<p className="mt-3 text-sm text-[#64748B]">No active SOS incidents.</p>
				) : (
					<ul className="mt-3 space-y-2">
						{incidents.map((inc) => (
							<li key={inc.id} className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm">
								<p className="font-bold text-rose-900">
									{inc.employee?.firstName} {inc.employee?.lastName} needs help
								</p>
								{inc.employee?.phone ? (
									<p className="mt-1 font-semibold text-[#0F172A]">
										Phone:{' '}
										<a href={`tel:${inc.employee.phone}`} className="text-[#0047FF] underline">
											{inc.employee.phone}
										</a>
									</p>
								) : null}
								<p className="mt-1 text-xs text-[#64748B]">
									{new Date(inc.createdAt).toLocaleString()} · {Number(inc.lat).toFixed(5)},{' '}
									{Number(inc.lng).toFixed(5)}
								</p>
								<a
									href={`https://www.google.com/maps?q=${inc.lat},${inc.lng}`}
									target="_blank"
									rel="noreferrer"
									className="mt-2 inline-flex rounded-lg bg-[#B42318] px-3 py-2 text-xs font-bold text-white"
								>
									Open live map
								</a>
							</li>
						))}
					</ul>
				)}
			</div>

			{female ? (
				<>
					<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-[13px] leading-snug text-emerald-900">
						Tracking rule: only after you leave the office and choose Going home (same day checkout). We
						track until you reach home, then stop. Next day starts again after check-in.
					</div>

					{canEditHome ? (
						<button
							type="button"
							onClick={() => onOpen('home_pin')}
							className="w-full rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-left"
						>
							<p className="text-sm font-extrabold text-amber-950">
								{hasHome ? 'Admin allowed — update home location' : 'Select home location'}
							</p>
							<p className="mt-1 text-xs text-amber-900">
								{hasHome
									? 'Tap to update your home pin. It locks again after you save.'
									: 'Tap to set your home pin (GPS or Maps).'}
							</p>
							<p className="mt-2 text-[13px] font-bold text-amber-800">
								{hasHome ? 'Update home →' : 'Set home now →'}
							</p>
						</button>
					) : null}

					<div className="rounded-[14px] border border-[#E2E8F0] bg-white px-3 py-2 text-sm">
						<div className="border-b border-[#E2E8F0] py-3">
							<p className="font-semibold text-[#0F172A]">Safety cohort</p>
							<p className="text-xs text-[#64748B]">Enabled (female)</p>
						</div>
						<div className="border-b border-[#E2E8F0] py-3">
							<p className="font-semibold text-[#0F172A]">Home location</p>
							<p className="text-xs text-[#64748B]">
								{hasHome
									? `${employee.homePlusCode || `${employee.homeLat}, ${employee.homeLng}`}${canEditHome ? ' · Unlocked' : ' · Locked'}`
									: 'Not set — use GPS or Maps link'}
							</p>
						</div>
						<div className="py-3">
							<p className="font-semibold text-[#0F172A]">Active trip</p>
							<p className="text-xs text-[#64748B]">
								{activeTrip?.id ? `Going home · ${activeTrip.status}` : 'None'}
							</p>
						</div>
					</div>

					<div className="overflow-hidden rounded-[14px] border border-[#E2E8F0] bg-white">
						{links.map((l, i) => {
							const Icon = l.icon;
							return (
								<button
									key={l.key}
									type="button"
									onClick={() => onOpen(l.key)}
									className={`flex w-full items-center gap-3 px-3 py-3.5 text-left ${i < links.length - 1 ? 'border-b border-[#E2E8F0]' : ''}`}
								>
									<span
										className="flex size-9 items-center justify-center rounded-[10px]"
										style={{ backgroundColor: `${l.color}1F`, color: l.color }}
									>
										<Icon className="size-[18px]" />
									</span>
									<span className="min-w-0 flex-1">
										<span className="block text-[15px] font-semibold text-[#0F172A]">{l.label}</span>
										<span className="block text-xs text-[#64748B]">{l.sub}</span>
									</span>
									<ChevronRight className="size-5 text-[#94A3B8]" />
								</button>
							);
						})}
					</div>
				</>
			) : null}
		</div>
	);
}
