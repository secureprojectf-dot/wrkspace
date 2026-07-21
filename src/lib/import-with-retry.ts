'use client';

/** Retry dynamic imports — Android often flakes once after cache clear / deploy. */
export async function importWithRetry<T>(
	loader: () => Promise<T>,
	retries = 3,
	delayMs = 400,
): Promise<T> {
	let last: unknown;
	for (let i = 0; i < retries; i++) {
		try {
			return await loader();
		} catch (err) {
			last = err;
			if (i < retries - 1) {
				await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
			}
		}
	}
	throw last;
}
