'use client';

import { useEffect } from 'react';

const FLAG = 'wrkspace_chunk_reload_v2';

export default function GlobalError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		console.error('[global-error]', error);
		const msg = `${error?.name ?? ''} ${error?.message ?? ''}`;
		if (!/ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module/i.test(msg)) {
			return;
		}
		try {
			const n = Number(sessionStorage.getItem(FLAG) || '0');
			if (n >= 2) return;
			sessionStorage.setItem(FLAG, String(n + 1));
		} catch {
			/* still reload */
		}
		window.location.reload();
	}, [error]);

	const detail = error?.message || error?.digest || '';

	return (
		<html lang="en">
			<body style={{ margin: 0, background: '#0B1220', color: '#fff', fontFamily: 'system-ui' }}>
				<main
					style={{
						minHeight: '100vh',
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						justifyContent: 'center',
						gap: 16,
						padding: 24,
						textAlign: 'center',
					}}
				>
					<p style={{ fontSize: 18, fontWeight: 600 }}>Something went wrong</p>
					<p style={{ fontSize: 14, opacity: 0.7, maxWidth: 360 }}>
						Tap Reload. After a site update, one or two reloads usually fix it.
					</p>
					{detail ? (
						<p
							style={{
								fontSize: 11,
								fontFamily: 'ui-monospace, monospace',
								opacity: 0.85,
								color: '#fde68a',
								maxWidth: 360,
								wordBreak: 'break-word',
								textAlign: 'left',
								background: 'rgba(255,255,255,0.06)',
								padding: '8px 12px',
								borderRadius: 8,
							}}
						>
							{detail}
						</p>
					) : null}
					<div style={{ display: 'flex', gap: 12 }}>
						<button
							type="button"
							onClick={() => window.location.reload()}
							style={{
								background: '#fff',
								color: '#000',
								border: 0,
								padding: '10px 16px',
								borderRadius: 8,
								fontWeight: 600,
							}}
						>
							Reload
						</button>
						<button
							type="button"
							onClick={() => reset()}
							style={{
								background: 'transparent',
								color: '#fff',
								border: '1px solid rgba(255,255,255,0.4)',
								padding: '10px 16px',
								borderRadius: 8,
								fontWeight: 600,
							}}
						>
							Try again
						</button>
					</div>
				</main>
			</body>
		</html>
	);
}
