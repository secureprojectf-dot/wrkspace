'use client';

import { ChatAvatar } from '@/components/ui/chat-avatar';
import { employeeDisplayName } from '@/lib/mobile-api';

type Props = {
	employee: any;
	subtitle?: string;
	onProfile?: () => void;
};

/** Flutter CorpPageHeader — flexible height (no fixed overflow). */
export function CorpPageHeader({ employee, subtitle, onProfile }: Props) {
	const name = employeeDisplayName(employee);
	return (
		<header
			className="shrink-0 text-white"
			style={{
				background: 'linear-gradient(135deg, #0047FF 0%, #2B6BFF 48%, #0036C7 100%)',
				fontFamily:
					'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
			}}
		>
			<div
				className="px-5 pb-5"
				style={{
					// Shell already paints env(safe-area-inset-top) in brand blue
					paddingTop: 16,
				}}
			>
				<div className="flex flex-col">
					<div className="flex items-center gap-3">
						<div className="min-w-0 flex-1">
							<img
								src="/branding/wrkspace-logo-on-dark.png"
								alt="wrkspace"
								width={168}
								height={28}
								className="h-7 w-auto max-w-[168px] object-contain object-left"
								style={{ imageRendering: 'auto' }}
								onError={(e) => {
									const el = e.target as HTMLImageElement;
									el.src = '/branding/wrkspace-logo.png';
									el.style.filter = 'brightness(0) invert(1)';
								}}
							/>
						</div>
						<button
							type="button"
							onClick={onProfile}
							className="shrink-0 overflow-hidden rounded-full"
							style={{ boxShadow: '0 0 0 2.5px rgba(255,255,255,0.35)' }}
							aria-label="Open profile"
						>
							<ChatAvatar
								id={employee?.id}
								name={name}
								photoUrl={employee?.photoUrl}
								size={48}
							/>
						</button>
					</div>
					<p
						className="mt-3 truncate leading-[1.15] text-white"
						style={{
							fontSize: 22,
							fontWeight: 700,
							letterSpacing: '-0.3px',
							fontFamily: 'inherit',
						}}
					>
						{name}
					</p>
					{subtitle ? (
						<p
							className="mt-1 truncate leading-[1.2] text-white/80"
							style={{ fontSize: 13.5, fontWeight: 500, fontFamily: 'inherit' }}
						>
							{subtitle}
						</p>
					) : null}
				</div>
			</div>
		</header>
	);
}
