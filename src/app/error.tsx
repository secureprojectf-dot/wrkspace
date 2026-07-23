'use client';

import { useEffect } from 'react';

const FLAG = 'wrkspace_chunk_reload_v2';
const MAX_RELOADS = 2;

function isChunkFailure(error: Error & { digest?: string }) {
	const msg = `${error?.name ?? ''} ${error?.message ?? ''}`;
	return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
		msg,
	);
}

function takeReloadSlot(): boolean {
	try {
		const n = Number(sessionStorage.getItem(FLAG) || '0');
		if (n >= MAX_RELOADS) return false;
		sessionStorage.setItem(FLAG, String(n + 1));
		return true;
	} catch {
		return true;
	}
}

export default function Error({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		console.error('[app/error]', error);
		if (!isChunkFailure(error)) return;
		if (!takeReloadSlot()) return;
		window.location.reload();
	}, [error]);

	const detail = error?.message || error?.digest || '';

	return (
		<main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0B1220] px-6 text-center text-white">
			<p className="text-lg font-semibold tracking-tight">Something went wrong</p>
			<p className="max-w-sm text-sm text-white/70">
				Reload once. If it keeps failing, clear site data for wrkspace.podtem.co.in, then open the link again.
			</p>
			{detail ? (
				<p className="max-w-sm break-words rounded-md bg-white/5 px-3 py-2 text-left font-mono text-[11px] text-amber-200/90">
					{detail}
				</p>
			) : null}
			<div className="flex gap-3 pt-2">
				<button
					type="button"
					onClick={() => window.location.reload()}
					className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-black"
				>
					Reload
				</button>
				<button
					type="button"
					onClick={() => reset()}
					className="rounded-md border border-white/40 px-4 py-2 text-sm font-semibold text-white"
				>
					Try again
				</button>
			</div>
		</main>
	);
}
