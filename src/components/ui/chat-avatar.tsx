'use client';

import React, { useEffect, useState } from 'react';
import { memberChatColor, memberInitials } from '@/lib/chat-member-color';
import { loadEmployeeAvatar } from '@/app/admin/actions';
import { cn } from '@/lib/utils';

type Props = {
	id?: string | null;
	name: string;
	photoUrl?: string | null;
	hasPhoto?: boolean;
	size?: number;
	className?: string;
	/** Admin email — uses /api/admin/avatars/:id when no employee JWT */
	adminEmail?: string | null;
};

const _cache = new Map<string, string>();
const _failed = new Set<string>();

export function clearChatAvatarCache(employeeId?: string) {
	if (!employeeId) {
		_cache.clear();
		_failed.clear();
		return;
	}
	_cache.delete(employeeId);
	_failed.delete(employeeId);
}

function employeeToken(): string {
	if (typeof window === 'undefined') return '';
	try {
		const t = localStorage.getItem('wrkspace_employee_token');
		if (t) return t;
		const s = localStorage.getItem('wrkspace_employee_session');
		if (!s) return '';
		return (JSON.parse(s) as { token?: string }).token || '';
	} catch {
		return '';
	}
}

function adminEmailFromStorage(): string {
	if (typeof window === 'undefined') return '';
	try {
		const s = localStorage.getItem('wrkspace_admin_session');
		if (!s) return '';
		return String((JSON.parse(s) as { email?: string }).email || '')
			.trim()
			.toLowerCase();
	} catch {
		return '';
	}
}

/**
 * WhatsApp-style chat avatar — loads real profile photo by employee id.
 */
export function ChatAvatar({
	id,
	name,
	photoUrl,
	hasPhoto = true,
	size = 32,
	className,
	adminEmail,
}: Props) {
	const color = memberChatColor(id || name);
	const initials = memberInitials(name);
	const [src, setSrc] = useState<string | null>(() => {
		const u = (photoUrl || '').trim();
		if (u) return u;
		if (id && _cache.has(id)) return _cache.get(id)!;
		return null;
	});

	useEffect(() => {
		const direct = (photoUrl || '').trim();
		if (direct) {
			setSrc(direct);
			if (id) _cache.set(id, direct);
			return;
		}
		if (!id) return;
		if (_cache.has(id)) {
			setSrc(_cache.get(id)!);
			return;
		}
		if (_failed.has(id) && hasPhoto === false) {
			setSrc(null);
			return;
		}

		let cancelled = false;
		let objectUrl: string | null = null;

		(async () => {
			const token = employeeToken();
			const admin = (adminEmail || adminEmailFromStorage() || '').trim().toLowerCase();

			// 1) Employee JWT → binary avatar API (best for employee portal)
			if (token) {
				try {
					const res = await fetch(`/api/employees/${encodeURIComponent(id)}/avatar`, {
						headers: { Authorization: `Bearer ${token}` },
					});
					if (res.ok) {
						const blob = await res.blob();
						if (blob.size > 50) {
							objectUrl = URL.createObjectURL(blob);
							_cache.set(id, objectUrl);
							_failed.delete(id);
							if (!cancelled) setSrc(objectUrl);
							return;
						}
					}
				} catch (_) {}
			}

			// 2) Admin email → admin avatar API
			if (admin) {
				try {
					const res = await fetch(
						`/api/admin/avatars/${encodeURIComponent(id)}?email=${encodeURIComponent(admin)}`,
					);
					if (res.ok) {
						const blob = await res.blob();
						if (blob.size > 50) {
							objectUrl = URL.createObjectURL(blob);
							_cache.set(id, objectUrl);
							_failed.delete(id);
							if (!cancelled) setSrc(objectUrl);
							return;
						}
					}
				} catch (_) {}
			}

			// 3) Server action fallback (data URL)
			try {
				const res = await loadEmployeeAvatar(id);
				const url = (res.photoUrl || '').trim();
				if (url) {
					_cache.set(id, url);
					_failed.delete(id);
					if (!cancelled) setSrc(url);
					return;
				}
			} catch (_) {}

			_failed.add(id);
			if (!cancelled) setSrc(null);
		})();

		return () => {
			cancelled = true;
		};
	}, [id, photoUrl, hasPhoto, adminEmail]);

	if (src) {
		return (
			// eslint-disable-next-line @next/next/no-img-element
			<img
				src={src}
				alt={name}
				width={size}
				height={size}
				className={cn('rounded-full object-cover shrink-0 bg-zinc-200', className)}
				style={{ width: size, height: size }}
				onError={() => {
					if (id) {
						_cache.delete(id);
						_failed.add(id);
					}
					setSrc(null);
				}}
			/>
		);
	}

	return (
		<span
			className={cn('rounded-full flex items-center justify-center font-bold shrink-0', className)}
			style={{
				width: size,
				height: size,
				backgroundColor: color.bg,
				color: color.fg,
				fontSize: Math.max(10, size * 0.36),
			}}
			aria-hidden
		>
			{initials}
		</span>
	);
}
