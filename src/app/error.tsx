'use client';

import { useEffect } from 'react';

const FLAG = 'wrkspace_chunk_reload_v1';

function isChunkFailure(error: Error & { digest?: string }) {
	const msg = `${error?.name ?? ''} ${error?.message ?? ''}`;
	return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
		msg,
	);
}

export default function Error({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		if (!isChunkFailure(error)) return;
		try {
			if (sessionStorage.getItem(FLAG) === '1') return;
			sessionStorage.setItem(FLAG, '1');
			window.location.reload();
		} catch {
			window.location.reload();
		}
	}, [error]);

	return (
		<main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0B1220] px-6 text-center text-white">
			<p className="text-lg font-semibold tracking-tight">Something went wrong</p>
			<p className="max-w-sm text-sm text-white/70">
				Reload the page. If it keeps failing, clear site data for wrkspace.podtem.co.in once, then open the link again.
			</p>
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
