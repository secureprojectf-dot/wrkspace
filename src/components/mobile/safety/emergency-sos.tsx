'use client';

import { useEffect, useRef, useState } from 'react';
import { createEmployeeSos } from '@/app/admin/actions';
import { apiPost, getPosition, isFemaleEmployee } from '@/lib/mobile-api';

const EMERGENCY_NUMBERS = [
	{ name: 'Student Forge Office', phone: '+919999999999' },
	{ name: 'Student Forge Safety Desk', phone: '+919999999998' },
	{ name: 'Police (India)', phone: '100' },
	{ name: 'Emergency (112)', phone: '112' },
	{ name: 'Women Helpline', phone: '1091' },
];

type Props = {
	employee: any;
};

export function MobileEmergencySos({ employee }: Props) {
	const female = isFemaleEmployee(employee);
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const incidentId = useRef<string | null>(null);
	const stream = useRef<number | undefined>(undefined);

	useEffect(() => {
		return () => {
			if (stream.current) window.clearInterval(stream.current);
		};
	}, []);

	const openHomeRoute = () => {
		const lat = employee?.homeLat;
		const lng = employee?.homeLng;
		if (lat == null || lng == null) {
			setMessage('Set your home location first.');
			return;
		}
		window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
	};

	const triggerSos = async () => {
		if (!female || busy) return;
		setBusy(true);
		setMessage(null);
		try {
			const pos = await getPosition(20000);
			const res = await createEmployeeSos(employee.id, pos.coords.latitude, pos.coords.longitude);
			if (!res.success) {
				setMessage(res.error || 'Failed');
				return;
			}
			incidentId.current = res.incident?.id || null;
			if (stream.current) window.clearInterval(stream.current);
			if (incidentId.current) {
				stream.current = window.setInterval(() => {
					void (async () => {
						if (!incidentId.current) return;
						try {
							const p = await getPosition(12000);
							await apiPost(`/api/safety/sos/${incidentId.current}/location`, {
								lat: p.coords.latitude,
								lng: p.coords.longitude,
							});
						} catch {
							/* keep trying */
						}
					})();
				}, 12000);
			}
			setMessage('SOS sent. All employees are being notified with your live location.');
		} catch (e: any) {
			setMessage(e?.message?.includes('denied') || e?.code === 1
				? 'Location permission required for SOS.'
				: e?.message || 'Could not get location');
		} finally {
			setBusy(false);
		}
	};

	if (!female) {
		return (
			<div className="p-4">
				<p className="rounded-xl border border-[#E2E8F0] bg-white p-4 text-sm text-[#64748B]">
					SOS is only available for female employees.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-4 p-4 pb-8">
			<button
				type="button"
				disabled={busy}
				onClick={() => void triggerSos()}
				className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#B42318] py-[14px] text-[15px] font-bold text-white disabled:opacity-60"
			>
				{busy ? 'Sending…' : 'SOS — share my live location'}
			</button>
			<button
				type="button"
				onClick={openHomeRoute}
				className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#E2E8F0] bg-white py-3 text-sm font-semibold text-[#0F172A]"
			>
				Open Google Maps route to home
			</button>
			{message ? <p className="text-sm font-medium text-[#0F172A]">{message}</p> : null}

			<div>
				<p className="mb-2 text-base font-bold text-[#0F172A]">Emergency numbers</p>
				<div className="overflow-hidden rounded-[14px] border border-[#E2E8F0] bg-white">
					{EMERGENCY_NUMBERS.map((n, i) => (
						<a
							key={n.phone + n.name}
							href={`tel:${n.phone}`}
							className={`flex items-center justify-between px-4 py-3.5 ${i < EMERGENCY_NUMBERS.length - 1 ? 'border-b border-[#E2E8F0]' : ''}`}
						>
							<span>
								<span className="block text-sm font-semibold text-[#0F172A]">{n.name}</span>
								<span className="block text-xs text-[#64748B]">{n.phone}</span>
							</span>
							<span className="text-sm font-bold text-[#067647]">Call</span>
						</a>
					))}
				</div>
			</div>
		</div>
	);
}
