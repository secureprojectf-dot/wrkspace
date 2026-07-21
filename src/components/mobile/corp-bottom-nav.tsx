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
 * Exact Flutter CorpBottomNav geometry (pixel path, NOT stretched):
 * FAB 62 · bar 64 · dock = bar+18 · FAB bottom = bar-22
 * viewBox matches dock height so the U-notch leaves a gap around the circle.
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

	// Flutter constants (no safe-area in these numbers — safe-area added only as padding)
	const FAB = 62;
	const BAR = 64;
	const DOCK = BAR + 18; // 82
	const SHELL = BAR + 36; // 100 — room for FAB peeking above dock
	const FAB_BOTTOM = BAR - 22; // 42

	return (
		<div
			className="pointer-events-none fixed inset-x-0 bottom-0 z-50"
			style={{ height: `calc(${SHELL}px + env(safe-area-inset-bottom, 0px))` }}
		>
			{/* Dock — viewBox height === rendered dock height (no vertical warp) */}
			<svg
				className="pointer-events-none absolute inset-x-0 bottom-0 w-full"
				style={{
					height: `calc(${DOCK}px + env(safe-area-inset-bottom, 0px))`,
				}}
				viewBox={`0 0 390 ${DOCK}`}
				preserveAspectRatio="none"
				aria-hidden
			>
				<defs>
					<filter id="wsDockShadow" x="-8%" y="-35%" width="116%" height="160%">
						<feDropShadow dx="0" dy="-3" stdDeviation="7" floodColor="#000" floodOpacity="0.26" />
					</filter>
					<linearGradient id="wsDockWash" x1="0" y1="0" x2="1" y2="0">
						<stop offset="0%" stopColor="#2B6BFF" stopOpacity="0.55" />
						<stop offset="42%" stopColor="#0047FF" stopOpacity="0" />
					</linearGradient>
				</defs>
				{/*
				  Flutter _DockPainter in a ${DOCK}-tall canvas:
				  top=16, notchDepth=28, notchHalf=42 → notch floor at y=44
				*/}
				<path
					d={`M0 ${DOCK} V24 Q0 16 12 16 H141 C156 16 164 44 195 44 C226 44 234 16 249 16 H378 Q390 16 390 24 V${DOCK} Z`}
					fill="#0047FF"
					filter="url(#wsDockShadow)"
				/>
				<path
					d={`M0 ${DOCK} V26 Q48 12 125 28 C152 36 162 44 195 44 L95 ${DOCK} Z`}
					fill="url(#wsDockWash)"
				/>
			</svg>

			{/* Icons sit in the flat dock band under the notch */}
			<div
				className="pointer-events-auto absolute inset-x-0 bottom-0 flex w-full items-center px-1.5"
				style={{
					height: `calc(${BAR}px + env(safe-area-inset-bottom, 0px))`,
					paddingTop: 20,
					paddingBottom: 'max(8px, calc(env(safe-area-inset-bottom, 0px) * 0.35 + 4px))',
				}}
			>
				<NavBtn active={section === 'home'} onClick={onHome} label="Home">
					<Home className="size-[22px]" strokeWidth={2} />
				</NavBtn>
				<NavBtn active={section === 'tasks'} onClick={onTasks} label="Tasks">
					<ListTodo className="size-[22px]" strokeWidth={2} />
				</NavBtn>
				<div style={{ width: FAB + 8 }} className="shrink-0" aria-hidden />
				<NavBtn active={section === 'messages'} onClick={onMessages} label="Messages">
					<MessagesSquare className="size-[22px]" strokeWidth={2} />
				</NavBtn>
				<NavBtn active={section === 'more'} onClick={onMore} label="More">
					<LayoutGrid className="size-[22px]" strokeWidth={2} />
				</NavBtn>
			</div>

			{/* Perfect circle FAB — white ring creates visible gap vs blue notch */}
			<button
				type="button"
				aria-label="Scan QR to check in"
				onClick={onScanner}
				className="pointer-events-auto absolute left-1/2 z-20 -translate-x-1/2 bg-[#FF6B5A] text-white active:scale-95 transition-transform"
				style={{
					width: FAB,
					height: FAB,
					bottom: `calc(${FAB_BOTTOM}px + env(safe-area-inset-bottom, 0px))`,
					borderRadius: '50%',
					border: '3.5px solid #fff',
					boxShadow:
						'0 5px 14px rgba(255,107,90,0.42), 0 2px 8px rgba(0,0,0,0.14)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					padding: 0,
					WebkitAppearance: 'none',
					appearance: 'none',
				}}
			>
				<QrCode className="size-[26px]" strokeWidth={2.2} />
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
	const isMessages = label === 'Messages';
	return (
		<button
			type="button"
			aria-label={label}
			onClick={onClick}
			className={cn(
				'flex h-12 flex-1 flex-col items-center justify-center gap-0.5',
				active ? 'text-white' : 'text-[#B8C4FF]',
			)}
		>
			{children}
			<span
				className={cn(
					'whitespace-nowrap font-semibold leading-none',
					isMessages ? 'text-[11px]' : 'text-[10.5px]',
					active ? 'font-bold' : 'font-semibold',
				)}
				style={isMessages ? { letterSpacing: '-0.15px' } : { letterSpacing: '0.1px' }}
			>
				{label}
			</span>
		</button>
	);
}
