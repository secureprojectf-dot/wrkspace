'use client';

import { useState } from 'react';

/** Phone / narrow tablet — Flutter-style shell. Desktop keeps employee website. */
const MOBILE_MQ = '(max-width: 767px)';

function readIsMobile(): boolean {
	if (typeof window === 'undefined') return false;
	try {
		return window.matchMedia(MOBILE_MQ).matches;
	} catch {
		return false;
	}
}

/**
 * Latch mobile vs desktop once on first client render.
 * Do NOT flip on resize — remounting MobileAppShell ↔ EmployeeDashboard
 * was contributing to Android Chrome "page couldn't load" crashes.
 */
export function useIsMobile() {
	const [isMobile] = useState(readIsMobile);
	return isMobile;
}
