'use client';

import { ChatAvatar } from '@/components/ui/chat-avatar';
import { employeeDisplayName } from '@/lib/mobile-api';

type Props = {
	employee: any;
	subtitle?: string;
	onProfile?: () => void;
};

/** Matches Flutter CorpPageHeader — brand logo + avatar + name. */
export function CorpPageHeader({ employee, subtitle, onProfile }: Props) {
	const name = employeeDisplayName(employee);
	return (
		<header className="shrink-0 bg-gradient-to-br from-[#0047FF] via-[#2B6BFF] to-[#0036C7] text-white">
			<div
				className="px-5 pb-6 pt-[max(20px,env(safe-area-inset-top))]"
				style={{ minHeight: 'calc(152px + env(safe-area-inset-top))' }}
			>
				<div className="flex h-[152px] flex-col justify-center">
					<div className="flex items-center gap-3">
						<div className="min-w-0 flex-1">
							{/* Same asset as Flutter BrandLogo(onDark) */}
							<img
								src="/branding/wrkspace-logo-on-dark.png"
								alt="wrkspace"
								className="h-7 w-auto max-w-[168px] object-contain object-left"
								onError={(e) => {
									const el = e.target as HTMLImageElement;
									el.src = '/branding/wrkspace-logo.png';
									el.classList.add('brightness-0', 'invert');
								}}
							/>
						</div>
						<button
							type="button"
							onClick={onProfile}
							className="shrink-0 rounded-full ring-[2.5px] ring-white/35"
							aria-label="Open profile"
						>
							<ChatAvatar
								id={employee?.id}
								name={name}
								photoUrl={employee?.photoUrl}
								size={52}
							/>
						</button>
					</div>
					<p className="mt-3.5 truncate text-[22px] font-bold leading-tight tracking-[-0.3px]">
						{name}
					</p>
					{subtitle ? (
						<p className="mt-[5px] truncate text-[13.5px] font-medium text-white/80">
							{subtitle}
						</p>
					) : null}
				</div>
			</div>
		</header>
	);
}
