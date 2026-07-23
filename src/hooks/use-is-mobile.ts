'use client';

import { useEffect, useState } from 'react';

const MOBILE_MQ = '(max-width: 767px)';

/**
 * Wait until after mount so SSR/hydration never mismatch.
 * Latch the value once — do not flip mid-session.
 */
export function useIsMobile() {
	const [isMobile, setIsMobile] = useState<boolean | null>(null);

	useEffect(() => {
		try {
			setIsMobile(window.matchMedia(MOBILE_MQ).matches);
		} catch {
			setIsMobile(false);
		}
	}, []);

	return isMobile;
}
