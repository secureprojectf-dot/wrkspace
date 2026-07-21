'use client';

import { useEffect, useState } from 'react';

/** Phone / narrow tablet — Flutter-style shell. Desktop keeps employee website. */
const MOBILE_MQ = '(max-width: 767px)';

export function useIsMobile(defaultValue = false) {
	const [isMobile, setIsMobile] = useState(defaultValue);

	useEffect(() => {
		const mq = window.matchMedia(MOBILE_MQ);
		const apply = () => setIsMobile(mq.matches);
		apply();
		mq.addEventListener('change', apply);
		return () => mq.removeEventListener('change', apply);
	}, []);

	return isMobile;
}
