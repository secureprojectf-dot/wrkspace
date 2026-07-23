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
 * Flutter CorpBottomNav — slightly shorter dock; scanner FAB stays 64.
 * FAB 64 · bar 68 · dock = bar+18 · FAB bottom = bar-22
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

	const FAB = 64;
	const BAR = 68;
	const DOCK = BAR + 18; // 86
	const SHELL = BAR + 36; // 104
	const FAB_BOTTOM = BAR - 22; // 46

	return (
		<div
			className="pointer-events-none fixed inset-x-0 bottom-0 z-50"
			style={{ height: `calc(${SHELL}px + env(safe-area-inset-bottom, 0px))` }}
		>
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
				<path
					d={`M0 ${DOCK} V24 Q0 16 12 16 H139 C154 16 162 44 195 44 C228 44 236 16 251 16 H378 Q390 16 390 24 V${DOCK} Z`}
					fill="#0047FF"
					filter="url(#wsDockShadow)"
				/>
				<path
					d={`M0 ${DOCK} V26 Q48 12 125 28 C152 36 162 44 195 44 L95 ${DOCK} Z`}
					fill="url(#wsDockWash)"
				/>
			</svg>

			<div
				className="pointer-events-auto absolute inset-x-0 bottom-0 flex w-full items-center px-1"
				style={{
					height: `calc(${BAR}px + env(safe-area-inset-bottom, 0px))`,
					paddingTop: 14,
					paddingBottom: 'max(6px, env(safe-area-inset-bottom, 0px))',
				}}
			>
				<NavBtn active={section === 'home'} onClick={onHome} label="Home">
					<Home className="size-[21px]" strokeWidth={2} />
				</NavBtn>
				<NavBtn active={section === 'tasks'} onClick={onTasks} label="Tasks">
					<ListTodo className="size-[21px]" strokeWidth={2} />
				</NavBtn>
				<div style={{ width: FAB + 8 }} className="shrink-0" aria-hidden />
				<NavBtn active={section === 'messages'} onClick={onMessages} label="Messages">
					<MessagesSquare className="size-[22px]" strokeWidth={2} />
				</NavBtn>
				<NavBtn active={section === 'more'} onClick={onMore} label="More">
					<LayoutGrid className="size-[21px]" strokeWidth={2} />
				</NavBtn>
			</div>

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
	const isMessages = label === 'Messages';
	return (
		<button
			type="button"
			aria-label={label}
			onClick={onClick}
			className={cn(
				'flex min-h-[46px] flex-1 flex-col items-center justify-center gap-0.5',
				active ? 'text-white' : 'text-[#B8C4FF]',
			)}
		>
			{children}
			<span
				className={cn(
					'whitespace-nowrap leading-none',
					isMessages ? 'text-[11.5px]' : 'text-[10.5px]',
					active ? 'font-bold' : 'font-semibold',
				)}
				style={isMessages ? { letterSpacing: '0' } : { letterSpacing: '0.15px' }}
			>
				{label}
			</span>
		</button>
	);
}
