'use client';

import { useEffect } from 'react';

const FLAG = 'wrkspace_chunk_reload_v1';

export default function GlobalError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		const msg = `${error?.name ?? ''} ${error?.message ?? ''}`;
		if (!/ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module/i.test(msg)) {
			return;
		}
		try {
			if (sessionStorage.getItem(FLAG) === '1') return;
			sessionStorage.setItem(FLAG, '1');
		} catch {
			/* still reload */
		}
		window.location.reload();
	}, [error]);

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
					<p style={{ fontSize: 18, fontWeight: 600 }}>This page couldn’t load</p>
					<p style={{ fontSize: 14, opacity: 0.7, maxWidth: 360 }}>
						Tap Reload. After a site update, one reload usually fixes it.
					</p>
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
