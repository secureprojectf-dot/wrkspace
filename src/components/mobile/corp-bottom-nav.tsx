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

/** Flutter CorpBottomNav — blue dock + coral QR FAB. */
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
		<div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 h-[118px]">
			<svg
				className="pointer-events-none absolute inset-x-0 bottom-0 h-[100px] w-full drop-shadow-[0_-4px_16px_rgba(0,0,0,0.22)]"
				viewBox="0 0 390 100"
				preserveAspectRatio="none"
				aria-hidden
			>
				<defs>
					<linearGradient id="dockWash" x1="0" y1="0" x2="1" y2="0">
						<stop offset="0%" stopColor="#2B6BFF" stopOpacity="0.55" />
						<stop offset="45%" stopColor="#0047FF" stopOpacity="0" />
					</linearGradient>
				</defs>
				<path
					d="M0 100 V28 Q0 16 14 16 H153 C168 16 175 44 195 44 C215 44 222 16 237 16 H376 Q390 16 390 28 V100 Z"
					fill="#0047FF"
				/>
				<path
					d="M0 100 V30 Q40 12 120 28 C150 36 160 44 195 44 L90 100 Z"
					fill="url(#dockWash)"
				/>
			</svg>

			<div className="pointer-events-auto absolute inset-x-0 bottom-0 flex h-[72px] items-end px-2 pb-[max(10px,env(safe-area-inset-bottom))]">
				<div className="flex w-full items-center pb-1">
					<NavBtn active={section === 'home'} onClick={onHome} label="Home">
						<Home className="size-[25px]" strokeWidth={2.2} />
					</NavBtn>
					<NavBtn active={section === 'tasks'} onClick={onTasks} label="Tasks">
						<ListTodo className="size-[25px]" strokeWidth={2.2} />
					</NavBtn>
					<div className="w-[70px] shrink-0" />
					<NavBtn active={section === 'messages'} onClick={onMessages} label="Messages">
						<MessagesSquare className="size-[25px]" strokeWidth={2.2} />
					</NavBtn>
					<NavBtn active={section === 'more'} onClick={onMore} label="More">
						<LayoutGrid className="size-[25px]" strokeWidth={2.2} />
					</NavBtn>
				</div>
			</div>

			<button
				type="button"
				aria-label="Scan QR to check in"
				onClick={onScanner}
				className="pointer-events-auto absolute left-1/2 bottom-[52px] z-10 flex size-[62px] -translate-x-1/2 items-center justify-center rounded-full border-[3.5px] border-white bg-[#FF6B5A] text-white shadow-[0_5px_14px_rgba(255,107,90,0.4),0_2px_8px_rgba(0,0,0,0.12)] active:scale-95 transition-transform"
			>
				<QrCode className="size-[27px]" strokeWidth={2.4} />
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
