export type EventRep = { id: string; name: string };

export function parseEventRepresentatives(raw: unknown): EventRep[] {
	if (!raw) return [];
	try {
		const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
		if (!Array.isArray(parsed)) return [];
		return parsed
			.map((r) => ({
				id: String((r as any)?.id || '').trim(),
				name: String((r as any)?.name || '').trim(),
			}))
			.filter((r) => r.id);
	} catch {
		return [];
	}
}

export function eventHasRepresentative(raw: unknown, employeeId: string): boolean {
	const id = String(employeeId || '').trim();
	if (!id) return false;
	return parseEventRepresentatives(raw).some((r) => r.id === id);
}

export function representativeIds(raw: unknown): string[] {
	return [...new Set(parseEventRepresentatives(raw).map((r) => r.id))];
}
