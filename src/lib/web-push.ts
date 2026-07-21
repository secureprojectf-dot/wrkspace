'use client';

/** Push disabled — FCM SW registration crashed Android Chrome after login. */
export async function subscribeOfficeExitPush(_onOfficeExit: () => void) {
	/* no-op */
}

export async function registerWebPush(_employeeId?: string) {
	/* no-op until a scoped, non-root SW is proven safe */
}
