'use client';

type Handler = (payload: Record<string, unknown>) => void;

/**
 * Lightweight Socket.IO client for admin/employee live boards.
 * Connects to Render API (Vercel cannot host Socket.IO).
 */
export function connectRealtime(opts: {
	token: string;
	onAttendance?: Handler;
	onSafety?: Handler;
	backendUrl?: string;
}): () => void {
	const base = (opts.backendUrl || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://wrkspace-api.onrender.com').replace(
		/\/$/,
		'',
	);
	let socket: any = null;
	let stopped = false;

	(async () => {
		try {
			const { io } = await import('socket.io-client');
			if (stopped) return;
			socket = io(base, {
				path: '/socket.io',
				transports: ['websocket'],
				auth: { token: opts.token },
				reconnection: true,
			});
			socket.on('attendance:update', (p: Record<string, unknown>) => opts.onAttendance?.(p));
			socket.on('safety:update', (p: Record<string, unknown>) => opts.onSafety?.(p));
		} catch (e) {
			console.warn('[realtime] connect failed', e);
		}
	})();

	return () => {
		stopped = true;
		try {
			socket?.disconnect();
		} catch (_) {}
		socket = null;
	};
}
