'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CalendarIcon, MapPinIcon, ArrowLeftIcon, PrinterIcon } from 'lucide-react';
import { getEventById } from '@/app/admin/actions';

export default function EventTicketPage() {
	const params = useParams();
	const router = useRouter();
	const [event, setEvent] = useState<any | null>(null);
	const [employee, setEmployee] = useState<any | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		try {
			const saved = localStorage.getItem('wrkspace_employee_session');
			if (saved) setEmployee(JSON.parse(saved));
		} catch (e) {
			console.error('Failed to load employee session', e);
		}

		const loadEvent = async () => {
			if (params.id) {
				let empId: string | undefined;
				try {
					const saved = localStorage.getItem('wrkspace_employee_session');
					if (saved) empId = JSON.parse(saved)?.id;
				} catch (_) {}
				const data = await getEventById(params.id as string, empId);
				setEvent(data);
			}
			setLoading(false);
		};
		loadEvent();
	}, [params.id]);

	if (loading) {
		return (
			<div className="employee-portal min-h-screen bg-[#e8edf5] flex items-center justify-center text-slate-700 font-mono text-sm font-semibold">
				Loading event pass…
			</div>
		);
	}

	if (!event) {
		return (
			<div className="employee-portal min-h-screen bg-[#e8edf5] flex flex-col items-center justify-center gap-4 text-center p-6">
				<CalendarIcon className="size-12 text-slate-400" />
				<h1 className="text-slate-900 text-lg font-bold">Event Not Found</h1>
				<p className="text-slate-700 text-sm max-w-xs">This event is not available, or you are not listed as a representative for it.</p>
				<button
					onClick={() => {
						if (window.opener) window.close();
						else router.push('/');
					}}
					className="bg-white hover:bg-slate-100 border border-slate-500 text-sm font-semibold px-4 py-2 text-slate-900 cursor-pointer"
				>
					Back to portal
				</button>
			</div>
		);
	}

	const reps: { id: string; name: string }[] = (() => {
		try {
			return JSON.parse(event.representatives || '[]');
		} catch {
			return [];
		}
	})();
	const startD = new Date(event.startDate);
	const endD = new Date(event.endDate);
	const fmt = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

	return (
		<div className="employee-portal min-h-screen bg-[#e8edf5] text-slate-900 font-sans selection:bg-brand-200 p-4 md:p-8 flex flex-col items-center justify-center">
			<div className="w-full max-w-2xl flex items-center justify-between mb-6 pb-4 border-b border-slate-300">
				<button
					onClick={() => {
						if (window.opener) window.close();
						else router.push('/');
					}}
					className="flex items-center gap-2 text-sm text-slate-800 hover:text-black transition-colors cursor-pointer font-bold"
				>
					<ArrowLeftIcon className="size-4" />
					Back to portal
				</button>

				<img
					src="/branding/wrkspace-logo.png?v=20260717b"
					alt="wrkspace"
					className="emp-logo-mark"
				/>
			</div>

			<div className="w-full max-w-2xl bg-white border border-slate-300 shadow-lg relative flex flex-col md:flex-row overflow-hidden">
				<div className="absolute top-1/2 -left-3 -translate-y-1/2 size-6 rounded-full bg-[#e8edf5] border border-slate-300 hidden md:block" />
				<div className="absolute top-1/2 -right-3 -translate-y-1/2 size-6 rounded-full bg-[#e8edf5] border border-slate-300 hidden md:block" />

				<div className="w-full md:w-2/5 h-64 md:h-auto bg-slate-100 flex items-center justify-center border-b md:border-b-0 md:border-r border-slate-300 relative">
					{event.imageUrl ? (
						<img src={event.imageUrl} alt={event.title} className="w-full h-full object-contain" />
					) : (
						<div className="absolute inset-0 bg-gradient-to-br from-indigo-100 via-slate-50 to-white flex items-center justify-center">
							<CalendarIcon className="size-16 text-brand-500/30" />
						</div>
					)}
					<div className="absolute bottom-3 left-3 bg-white/95 px-2 py-0.5 border border-slate-300 text-[11px] font-mono text-brand-600 uppercase tracking-widest font-bold">
						{event.source || 'Event'}
					</div>
				</div>

				<div className="w-full md:w-3/5 p-6 flex flex-col justify-between space-y-6">
					<div className="space-y-4">
						{employee && (
							<div className="border border-dashed border-slate-400 bg-slate-50 p-4 font-mono space-y-2.5 text-center relative overflow-hidden">
								{event.imageUrl && (
									<div className="w-full h-16 overflow-hidden relative border border-slate-300 mb-2 shrink-0 bg-white">
										<img src={event.imageUrl} alt={event.title} className="h-full w-full object-contain" />
									</div>
								)}
								<span className="text-[11px] text-slate-700 uppercase tracking-widest font-bold block">Official Reference Pass</span>
								{employee.photoUrl ? (
									// eslint-disable-next-line @next/next/no-img-element
									<img
										src={employee.photoUrl}
										alt=""
										className="mx-auto size-16 rounded-full object-cover border-2 border-indigo-300 bg-white"
									/>
								) : (
									<div className="mx-auto size-16 rounded-full bg-indigo-100 border-2 border-indigo-300 flex items-center justify-center text-indigo-800 font-black text-lg">
										{(employee.firstName?.[0] || 'E').toUpperCase()}
										{(employee.lastName?.[0] || '').toUpperCase()}
									</div>
								)}
								<strong className="text-slate-900 text-xs md:text-sm tracking-wider block font-bold truncate">
									EVT-REG-{event.id.slice(0, 8).toUpperCase()}-{employee.id.toUpperCase()}
								</strong>
								<span className="text-[11px] text-slate-700 block font-semibold">
									Assigned Employee: {employee.firstName} {employee.lastName}
								</span>
							</div>
						)}

						<div className="space-y-1">
							<span className="text-[11px] text-brand-600 font-bold uppercase tracking-widest font-mono block">
								{event.organisingCollege}
							</span>
							<h1 className="text-xl font-black text-slate-900 leading-tight">{event.title}</h1>
						</div>

						<div className="space-y-1 text-sm">
							<span className="text-[11px] text-slate-700 font-bold uppercase tracking-wider font-mono block">Details</span>
							<p className="text-slate-800 leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto pr-1">
								{event.description}
							</p>
						</div>

						<div className="grid grid-cols-1 gap-2 pt-3 border-t border-slate-200 text-sm">
							<div className="flex items-start justify-between gap-4">
								<span className="text-slate-700 font-bold shrink-0 font-mono text-[11px] uppercase tracking-wider">Schedule</span>
								<div className="text-right text-slate-900 font-semibold">
									<p>
										{fmt(startD)} · {event.startTime}
									</p>
									<p className="text-xs text-slate-700">
										to {fmt(endD)} · {event.endTime}
									</p>
								</div>
							</div>
							<div className="flex items-start justify-between gap-4 pt-1">
								<span className="text-slate-700 font-bold shrink-0 font-mono text-[11px] uppercase tracking-wider">Venue</span>
								<p className="text-right text-slate-900 leading-tight max-w-[200px] flex items-center gap-1 justify-end font-semibold">
									<MapPinIcon className="size-3.5 text-slate-600 shrink-0 inline" />
									{event.venueAddress}
								</p>
							</div>
						</div>

						{reps.length > 0 && (
							<div className="space-y-1.5 pt-3 border-t border-slate-200">
								<span className="text-[11px] text-slate-700 font-bold uppercase tracking-wider font-mono block">
									Assigned Representatives
								</span>
								<div className="flex flex-wrap gap-1.5">
									{reps.map((r, i) => (
										<span
											key={i}
											className={`text-[11px] px-2 py-0.5 border font-semibold ${
												employee && r.name === `${employee.firstName} ${employee.lastName}`
													? 'bg-indigo-50 border-indigo-300 text-indigo-900'
													: 'bg-slate-50 border-slate-300 text-slate-800'
											}`}
										>
											{r.name}
											{employee && r.name === `${employee.firstName} ${employee.lastName}` && (
												<span className="ml-1 text-brand-600 font-bold">· You</span>
											)}
										</span>
									))}
								</div>
							</div>
						)}
					</div>

					<div className="flex items-center gap-3 pt-3 border-t border-slate-200">
						<button
							onClick={() => window.print()}
							className="flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-bold px-4 py-2.5 rounded-none cursor-pointer transition-colors w-full"
						>
							<PrinterIcon className="size-4" />
							Print / PDF pass
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
