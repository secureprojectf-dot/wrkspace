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
		// Load session from localStorage
		try {
			const saved = localStorage.getItem('wrkspace_employee_session');
			if (saved) {
				setEmployee(JSON.parse(saved));
			}
		} catch (e) {
			console.error('Failed to load employee session', e);
		}

		// Load event from DB
		const loadEvent = async () => {
			if (params.id) {
				const data = await getEventById(params.id as string);
				setEvent(data);
			}
			setLoading(false);
		};

		loadEvent();
	}, [params.id]);

	if (loading) {
		return (
			<div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500 font-mono text-xs">
				LOADING TICKET REFERENCE PASS...
			</div>
		);
	}

	if (!event) {
		return (
			<div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4 text-center p-6">
				<CalendarIcon className="size-12 text-zinc-800" />
				<h1 className="text-white text-lg font-bold">Event Not Found</h1>
				<p className="text-zinc-500 text-sm max-w-xs">The event you are trying to view does not exist or has been deleted.</p>
				<button 
					onClick={() => window.close()}
					className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold px-4 py-2 text-white cursor-pointer"
				>
					Close Window
				</button>
			</div>
		);
	}

	const reps: { id: string; name: string }[] = JSON.parse(event.representatives || '[]');
	const startD = new Date(event.startDate);
	const endD = new Date(event.endDate);
	const fmt = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

	return (
		<div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-brand-900/60 p-4 md:p-8 flex flex-col items-center justify-center">
			
			{/* Top Header Controls */}
			<div className="w-full max-w-2xl flex items-center justify-between mb-6 pb-4 border-b border-zinc-800/80">
				<button 
					onClick={() => {
						if (window.opener) {
							window.close();
						} else {
							router.back();
						}
					}}
					className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer font-semibold font-mono"
				>
					<ArrowLeftIcon className="size-3.5" />
					BACK TO PORTAL
				</button>

				<div className="flex items-center gap-3">
					<img src="https://ik.imagekit.io/dypkhqxip/logogog" alt="WrkSpace Logo" className="h-6 w-auto object-contain" />
					<span className="text-[10px] text-zinc-550 font-mono tracking-widest uppercase font-bold">WRKSPACE PORTAL</span>
				</div>
			</div>

			{/* Main Ticket Layout */}
			<div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 shadow-2xl relative flex flex-col md:flex-row overflow-hidden">
				
				{/* Ticket Cutouts for folding aesthetics */}
				<div className="absolute top-1/2 -left-3 -translate-y-1/2 size-6 rounded-full bg-zinc-950 border border-zinc-800 hidden md:block" />
				<div className="absolute top-1/2 -right-3 -translate-y-1/2 size-6 rounded-full bg-zinc-950 border border-zinc-800 hidden md:block" />

				{/* Left Column: Image Banner (Flex adjust / Object Contain) */}
				<div className="w-full md:w-2/5 h-64 md:h-auto bg-zinc-950 flex items-center justify-center border-b md:border-b-0 md:border-r border-zinc-800 relative">
					{event.imageUrl ? (
						<img 
							src={event.imageUrl} 
							alt={event.title} 
							className="w-full h-full object-contain" 
						/>
					) : (
						<div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-zinc-900/40 to-black flex items-center justify-center">
							<CalendarIcon className="size-16 text-brand-500/10" />
						</div>
					)}
					<div className="absolute bottom-3 left-3 bg-black/85 backdrop-blur-sm px-2 py-0.5 border border-zinc-800 text-[9px] font-mono text-brand-400 uppercase tracking-widest">
						{event.source || 'Event'}
					</div>
				</div>

				{/* Right Column: Ticket Body */}
				<div className="w-full md:w-3/5 p-6 flex flex-col justify-between space-y-6">
					
					<div className="space-y-4">
						{/* Digital ID Pass Card */}
						{employee && (
							<div className="border border-dashed border-zinc-700 bg-zinc-950/60 p-4 font-mono space-y-2.5 text-center relative overflow-hidden">
								<div className="absolute -left-2 top-1/2 -translate-y-1/2 size-4 rounded-full bg-zinc-900 border border-zinc-800" />
								<div className="absolute -right-2 top-1/2 -translate-y-1/2 size-4 rounded-full bg-zinc-900 border border-zinc-800" />
								
								{/* Ticket Image inside Digital ID */}
								{event.imageUrl && (
									<div className="w-full h-16 overflow-hidden relative border border-zinc-800/80 mb-2 shrink-0 bg-zinc-950">
										<img 
											src={event.imageUrl} 
											alt={event.title} 
											className="h-full w-full object-contain opacity-90" 
										/>
									</div>
								)}

								<span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold block">Official Reference Pass</span>
								<strong className="text-white text-xs md:text-sm tracking-wider block font-bold truncate">
									EVT-REG-{event.id.slice(0, 8).toUpperCase()}-{employee.id.toUpperCase()}
								</strong>
								<span className="text-[9px] text-zinc-500 block">Assigned Employee: {employee.firstName} {employee.lastName}</span>
							</div>
						)}

						{/* Event Metadata */}
						<div className="space-y-1">
							<span className="text-[9px] text-brand-400 font-bold uppercase tracking-widest font-mono block">{event.organisingCollege}</span>
							<h1 className="text-xl font-black text-white leading-tight">{event.title}</h1>
						</div>

						{/* Description */}
						<div className="space-y-1 text-xs">
							<span className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider font-mono block">Details</span>
							<p className="text-zinc-400 leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
								{event.description}
							</p>
						</div>

						{/* Timings & Venue Grid */}
						<div className="grid grid-cols-1 gap-2 pt-3 border-t border-zinc-800/60 text-xs">
							<div className="flex items-start justify-between gap-4">
								<span className="text-zinc-500 font-medium shrink-0 font-mono text-[9px] uppercase tracking-wider">Schedule</span>
								<div className="text-right text-zinc-300">
									<p>{fmt(startD)} · {event.startTime}</p>
									<p className="text-[10px] text-zinc-500">to {fmt(endD)} · {event.endTime}</p>
								</div>
							</div>
							<div className="flex items-start justify-between gap-4 pt-1">
								<span className="text-zinc-500 font-medium shrink-0 font-mono text-[9px] uppercase tracking-wider">Venue</span>
								<p className="text-right text-zinc-350 leading-tight max-w-[200px] flex items-center gap-1 justify-end">
									<MapPinIcon className="size-3.5 text-zinc-500 shrink-0 inline" />
									{event.venueAddress}
								</p>
							</div>
						</div>

						{/* Representatives */}
						{reps.length > 0 && (
							<div className="space-y-1.5 pt-3 border-t border-zinc-800/60">
								<span className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider font-mono block">Assigned Representatives</span>
								<div className="flex flex-wrap gap-1.5">
									{reps.map((r, i) => (
										<span key={i} className={`text-[10px] px-2 py-0.5 border ${
											employee && r.name === `${employee.firstName} ${employee.lastName}`
												? 'bg-brand-950/40 border-brand-900/40 text-brand-300'
												: 'bg-zinc-950 border-zinc-800 text-zinc-400'
										}`}>
											{r.name}
											{employee && r.name === `${employee.firstName} ${employee.lastName}` && (
												<span className="ml-1 text-brand-400 font-bold">· You</span>
											)}
										</span>
									))}
								</div>
							</div>
						)}
					</div>

					{/* Action Buttons */}
					<div className="flex items-center gap-3 pt-3 border-t border-zinc-800">
						<button 
							onClick={() => window.print()}
							className="flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold px-4 py-2.5 rounded-none cursor-pointer transition-colors w-full font-mono"
						>
							<PrinterIcon className="size-3.5" />
							PRINT / PDF PASS
						</button>
					</div>

				</div>
			</div>
		</div>
	);
}
