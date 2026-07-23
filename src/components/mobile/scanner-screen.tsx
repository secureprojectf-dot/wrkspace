'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { apiPost, getPosition } from '@/lib/mobile-api';

type Phase = 'idle' | 'locating' | 'verifying' | 'success' | 'error';

type Props = {
	onClose: (didCheckIn?: boolean) => void;
};

export function MobileScannerScreen({ onClose }: Props) {
	const [phase, setPhase] = useState<Phase>('idle');
	const [title, setTitle] = useState('Align QR in the frame');
	const [subtitle, setSubtitle] = useState('Stay inside the office geofence while scanning');
	const [detail, setDetail] = useState<string | null>(null);
	const [manual, setManual] = useState('');
	const handling = useRef(false);
	const scannerRef = useRef<Html5Qrcode | null>(null);
	const mounted = useRef(true);

	useEffect(() => {
		mounted.current = true;
		const id = 'wrkspace-qr-reader';
		let scanner: Html5Qrcode | null = null;

		(async () => {
			try {
				scanner = new Html5Qrcode(id);
				scannerRef.current = scanner;
				await scanner.start(
					{ facingMode: 'environment' },
					{ fps: 8, qrbox: { width: 240, height: 240 } },
					(decoded) => {
						void handleToken(decoded);
					},
					() => {},
				);
			} catch (e: any) {
				if (mounted.current) {
					setDetail(
						e?.message ||
							'Camera unavailable — paste the office QR token below, or allow camera permission.',
					);
				}
			}
		})();

		return () => {
			mounted.current = false;
			const s = scannerRef.current;
			scannerRef.current = null;
			if (s) {
				s
					.stop()
					.then(() => s.clear())
					.catch(() => {});
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	async function stopCamera() {
		const s = scannerRef.current;
		if (!s) return;
		try {
			await s.stop();
			await s.clear();
		} catch {
			/* ignore */
		}
	}

	async function handleToken(raw: string) {
		const token = String(raw || '').trim();
		if (!token || handling.current) return;
		handling.current = true;
		await stopCamera();

		setPhase('locating');
		setTitle('Checking you in');
		setSubtitle('Confirming your location…');
		setDetail(null);

		try {
			const pos = await getPosition(20000);
			if (!mounted.current) return;
			setPhase('verifying');
			setSubtitle('Verifying QR & office distance…');

			const result = await apiPost<{
				officeName?: string;
				distanceMeters?: number;
				message?: string;
			}>('/api/attendance/qr-checkin', {
				token,
				lat: pos.coords.latitude,
				lng: pos.coords.longitude,
			});

			setPhase('success');
			setTitle("You're checked in");
			setSubtitle(
				`${result.officeName || 'Office'} · ${result.distanceMeters ?? '?'}m away`,
			);
			await new Promise((r) => setTimeout(r, 1200));
			onClose(true);
		} catch (e: any) {
			setPhase('error');
			setTitle("Couldn't check in");
			setSubtitle('See the reason below, then try again');
			setDetail(String(e?.message || e).replace(/^Error:\s*/, ''));
		} finally {
			handling.current = false;
		}
	}

	async function retry() {
		setPhase('idle');
		setTitle('Align QR in the frame');
		setSubtitle('Stay inside the office geofence while scanning');
		setDetail(null);
		handling.current = false;
		try {
			const scanner = new Html5Qrcode('wrkspace-qr-reader');
			scannerRef.current = scanner;
			await scanner.start(
				{ facingMode: 'environment' },
				{ fps: 8, qrbox: { width: 240, height: 240 } },
				(decoded) => {
					void handleToken(decoded);
				},
				() => {},
			);
		} catch (e: any) {
			setDetail(e?.message || 'Could not restart camera');
		}
	}

	const showCamera = phase === 'idle';

	return (
		<div className="fixed inset-0 z-[80] flex flex-col bg-[#0F172A] text-white">
			<div
				className="flex items-center gap-3 px-3 pb-2"
				style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
			>
				<button
					type="button"
					onClick={() => onClose(false)}
					className="flex size-10 items-center justify-center rounded-full bg-white/10"
					aria-label="Close scanner"
				>
					<ArrowLeft className="size-5" />
				</button>
				<div className="min-w-0 flex-1">
					<p className="truncate text-[17px] font-semibold">QR check-in</p>
					<p className="truncate text-xs text-white/70">{subtitle}</p>
				</div>
			</div>

			<div className="relative mx-4 min-h-0 flex-1 overflow-hidden rounded-2xl bg-black">
				<div id="wrkspace-qr-reader" className={showCamera ? 'h-full w-full' : 'hidden'} />
				{!showCamera ? (
					<div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
						{phase === 'success' ? (
							<CheckCircle2 className="size-16 text-[#067647]" />
						) : phase !== 'error' ? (
							<Loader2 className="size-12 animate-spin text-[#2B6BFF]" />
						) : null}
						<p className="text-xl font-bold">{title}</p>
						<p className="text-sm text-white/75">{subtitle}</p>
						{detail ? (
							<p className="mt-2 rounded-xl bg-white/10 px-3 py-2 text-left text-sm text-[#FECACA]">
								{detail}
							</p>
						) : null}
						{phase === 'error' ? (
							<button
								type="button"
								onClick={() => void retry()}
								className="mt-4 rounded-xl bg-[#0047FF] px-6 py-3 text-sm font-semibold"
							>
								Try again
							</button>
						) : null}
					</div>
				) : null}
				{showCamera ? (
					<div className="pointer-events-none absolute inset-0 flex items-center justify-center">
						<div className="size-[240px] rounded-2xl border-2 border-[#FF6B5A]/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
					</div>
				) : null}
			</div>

			<div className="space-y-3 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-4">
				<p className="text-center text-sm font-semibold text-white/90">{title}</p>
				{detail && phase === 'idle' ? (
					<p className="text-center text-xs text-[#FECACA]">{detail}</p>
				) : null}
				<form
					className="flex gap-2"
					onSubmit={(e) => {
						e.preventDefault();
						void handleToken(manual);
					}}
				>
					<input
						value={manual}
						onChange={(e) => setManual(e.target.value)}
						placeholder="Or paste office QR token"
						className="min-w-0 flex-1 rounded-xl border border-white/20 bg-white/10 px-3 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-[#2B6BFF]"
					/>
					<button
						type="submit"
						className="rounded-xl bg-[#FF6B5A] px-4 text-sm font-bold text-white"
					>
						Go
					</button>
				</form>
			</div>
		</div>
	);
}
