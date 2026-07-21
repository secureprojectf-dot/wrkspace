'use client';

/**
 * Push is optional. Registering messaging SWs was crashing Android Chrome
 * ("This page couldn't load") after login. We only purge SWs for now.
 */
import { purgeBrokenServiceWorkers } from '@/lib/purge-sw';

export async function subscribeOfficeExitPush(_onOfficeExit: () => void) {
	/* disabled until SW is proven safe on Android Chrome */
}

export async function registerWebPush(_employeeId?: string) {
	if (typeof window === 'undefined') return;
	await purgeBrokenServiceWorkers();
}
