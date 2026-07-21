/** Shared helpers for Flutter-parity mobile web app. */

export function employeeToken(): string {
	if (typeof window === 'undefined') return '';
	try {
		const t = localStorage.getItem('wrkspace_employee_token');
		if (t) return t;
		const s = localStorage.getItem('wrkspace_employee_session');
		if (!s) return '';
		return String((JSON.parse(s) as { token?: string }).token || '');
	} catch {
		return '';
	}
}

export async function apiGet<T = any>(path: string): Promise<T> {
	const token = employeeToken();
	const res = await fetch(path, {
		headers: token ? { Authorization: `Bearer ${token}` } : {},
		cache: 'no-store',
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error((data as any).error || `Request failed (${res.status})`);
	return data as T;
}

export async function apiPost<T = any>(path: string, body: Record<string, unknown> = {}): Promise<T> {
	const token = employeeToken();
	const res = await fetch(path, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...(token ? { Authorization: `Bearer ${token}` } : {}),
		},
		body: JSON.stringify(body),
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error((data as any).error || `Request failed (${res.status})`);
	return data as T;
}

export async function apiPatch<T = any>(path: string, body: Record<string, unknown> = {}): Promise<T> {
	const token = employeeToken();
	const res = await fetch(path, {
		method: 'PATCH',
		headers: {
			'Content-Type': 'application/json',
			...(token ? { Authorization: `Bearer ${token}` } : {}),
		},
		body: JSON.stringify(body),
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error((data as any).error || `Request failed (${res.status})`);
	return data as T;
}

export async function apiDelete<T = any>(path: string): Promise<T> {
	const token = employeeToken();
	const res = await fetch(path, {
		method: 'DELETE',
		headers: token ? { Authorization: `Bearer ${token}` } : {},
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error((data as any).error || `Request failed (${res.status})`);
	return data as T;
}

export function getPosition(timeoutMs = 20000): Promise<GeolocationPosition> {
	return new Promise((resolve, reject) => {
		if (!navigator.geolocation) {
			reject(new Error('Location not available on this device'));
			return;
		}
		navigator.geolocation.getCurrentPosition(resolve, reject, {
			enableHighAccuracy: true,
			timeout: timeoutMs,
			maximumAge: 5000,
		});
	});
}

export function employeeDisplayName(emp: any): string {
	const n = `${emp?.firstName || ''} ${emp?.lastName || ''}`.trim() || emp?.name || 'Employee';
	return n;
}

export function isFemaleEmployee(emp: any): boolean {
	return String(emp?.gender || '').toUpperCase() === 'FEMALE';
}
