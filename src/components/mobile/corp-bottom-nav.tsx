'use client';

import { Home, ListTodo, MessagesSquare, LayoutGrid, QrCode } from 'lucide-react';
import { cn } from '@/lib/utils';

type Section = 'home' | 'tasks' | 'messages' | 'more';

type Props = {
	section: Section;
	onHome: () => void;
	onTasks: () => void;
	onMessages: () => void;
	onMore: () => void;
	onScanner: () => void;
	hidden?: boolean;
};

/**
 * Flutter CorpBottomNav parity:
 * bar body 64 + safe area, FAB 62, soft U-notch, coral scanner with dual shadow.
 */
export function CorpBottomNav({
	section,
	onHome,
	onTasks,
	onMessages,
	onMore,
	onScanner,
	hidden,
}: Props) {
	if (hidden) return null;

	return (
		<div
			className="pointer-events-none fixed inset-x-0 bottom-0 z-50"
			style={{
				height: 'calc(100px + env(safe-area-inset-bottom, 0px))',
			}}
		>
			{/* Dock shadow + path — mirrors Flutter _DockPainter */}
			<svg
				className="pointer-events-none absolute inset-x-0 bottom-0 w-full"
				style={{ height: 'calc(82px + env(safe-area-inset-bottom, 0px))' }}
				viewBox="0 0 390 100"
				preserveAspectRatio="none"
				aria-hidden
			>
				<defs>
					<filter id="dockShadow" x="-20%" y="-40%" width="140%" height="180%">
						<feDropShadow dx="0" dy="-4" stdDeviation="8" floodColor="#000" floodOpacity="0.28" />
					</filter>
					<linearGradient id="dockWash" x1="0" y1="0" x2="1" y2="0">
						<stop offset="0%" stopColor="#2B6BFF" stopOpacity="0.55" />
						<stop offset="45%" stopColor="#0047FF" stopOpacity="0" />
					</linearGradient>
				</defs>
				{/* top=16, notchDepth=28, notchHalf=42 — same as Flutter */}
				<path
					d="M0 100 V24 Q0 16 12 16 H143 C157 16 165 44 195 44 C225 44 233 16 247 16 H378 Q390 16 390 24 V100 Z"
					fill="#0047FF"
					filter="url(#dockShadow)"
				/>
				<path
					d="M0 100 V28 Q50 14 130 30 C155 38 165 44 195 44 L100 100 Z"
					fill="url(#dockWash)"
				/>
			</svg>

			{/* Nav icons row — Flutter bar body ~64 + padding */}
			<div
				className="pointer-events-auto absolute inset-x-0 bottom-0 flex items-end px-1.5"
				style={{
					height: 'calc(64px + env(safe-area-inset-bottom, 0px))',
					paddingBottom: 'max(10px, calc(env(safe-area-inset-bottom, 0px) * 0.35 + 6px))',
					paddingTop: '22px',
				}}
			>
				<div className="flex w-full items-center">
					<NavBtn active={section === 'home'} onClick={onHome} label="Home">
						<Home className="size-[25px]" strokeWidth={2} />
					</NavBtn>
					<NavBtn active={section === 'tasks'} onClick={onTasks} label="Tasks">
						<ListTodo className="size-[25px]" strokeWidth={2} />
					</NavBtn>
					{/* FAB spacer — 62 + 8 */}
					<div className="w-[70px] shrink-0" aria-hidden />
					<NavBtn active={section === 'messages'} onClick={onMessages} label="Messages">
						<MessagesSquare className="size-[25px]" strokeWidth={2} />
					</NavBtn>
					<NavBtn active={section === 'more'} onClick={onMore} label="More">
						<LayoutGrid className="size-[25px]" strokeWidth={2} />
					</NavBtn>
				</div>
			</div>

			{/* Coral scanner FAB — sits in notch; dual shadow like Flutter */}
			<button
				type="button"
				aria-label="Scan QR to check in"
				onClick={onScanner}
				className="pointer-events-auto absolute left-1/2 z-10 flex size-[62px] -translate-x-1/2 items-center justify-center rounded-full border-[3.5px] border-white bg-[#FF6B5A] text-white active:scale-95 transition-transform"
				style={{
					bottom: 'calc(42px + env(safe-area-inset-bottom, 0px))',
					boxShadow:
						'0 5px 14px rgba(255,107,90,0.45), 0 2px 8px rgba(0,0,0,0.14), 0 0 0 1px rgba(255,255,255,0.15)',
				}}
			>
				<QrCode className="size-[27px]" strokeWidth={2.2} />
			</button>
		</div>
	);
}

function NavBtn({
	active,
	onClick,
	label,
	children,
}: {
	active: boolean;
	onClick: () => void;
	label: string;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			aria-label={label}
			onClick={onClick}
			className={cn(
				'flex h-11 flex-1 items-center justify-center',
				active ? 'text-white' : 'text-[#B8C4FF]',
			)}
		>
			{children}
		</button>
	);
}
