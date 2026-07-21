'use client';

import { useEffect } from 'react';

const FLAG = 'wrkspace_chunk_reload_v1';

function isChunkFailure(reason: unknown): boolean {
	const msg =
		reason instanceof Error
			? `${reason.name} ${reason.message}`
			: String(reason ?? '');
	return /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
		msg,
	);
}

function reloadOnce() {
	try {
		if (sessionStorage.getItem(FLAG) === '1') return;
		sessionStorage.setItem(FLAG, '1');
	} catch {
		/* still reload once */
	}
	window.location.reload();
}

/**
 * After deploy / cache clear, dynamic imports can 404 briefly.
 * One guarded reload recovers instead of Next.js "This page couldn't load".
 */
export function ChunkReloadGuard() {
	useEffect(() => {
		const onRejection = (ev: PromiseRejectionEvent) => {
			if (isChunkFailure(ev.reason)) {
				ev.preventDefault();
				reloadOnce();
			}
		};
		const onError = (ev: ErrorEvent) => {
			if (isChunkFailure(ev.error ?? ev.message)) {
				reloadOnce();
			}
		};
		window.addEventListener('unhandledrejection', onRejection);
		window.addEventListener('error', onError);
		try {
			// Clear flag after a successful settled load
			window.setTimeout(() => {
				try {
					sessionStorage.removeItem(FLAG);
				} catch {
					/* ignore */
				}
			}, 12_000);
		} catch {
			/* ignore */
		}
		return () => {
			window.removeEventListener('unhandledrejection', onRejection);
			window.removeEventListener('error', onError);
		};
	}, []);

	return null;
}
