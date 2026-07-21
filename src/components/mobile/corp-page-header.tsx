'use client';

import { ChatAvatar } from '@/components/ui/chat-avatar';
import { employeeDisplayName } from '@/lib/mobile-api';

type Props = {
	employee: any;
	subtitle?: string;
	onProfile?: () => void;
};

export function CorpPageHeader({ employee, subtitle, onProfile }: Props) {
	const name = employeeDisplayName(employee);
	return (
		<header className="shrink-0 bg-gradient-to-br from-[#0047FF] via-[#2B6BFF] to-[#0036C7] text-white">
			<div className="px-5 pb-6 pt-[max(20px,env(safe-area-inset-top))]">
				<div className="flex h-[152px] flex-col justify-center">
					<div className="flex items-center gap-3">
						<div className="min-w-0 flex-1">
							<img
								src="/icon.png"
								alt="wrkspace"
								className="h-7 w-auto object-contain brightness-0 invert"
								onError={(e) => {
									(e.target as HTMLImageElement).style.display = 'none';
								}}
							/>
							<p className="mt-0.5 text-[13px] font-semibold tracking-wide text-white/90">
								wrkspace
							</p>
						</div>
						<button
							type="button"
							onClick={onProfile}
							className="shrink-0 rounded-full ring-2 ring-white/40"
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
					<p className="mt-3.5 truncate text-[22px] font-bold leading-tight">{name}</p>
					{subtitle ? (
						<p className="mt-1 text-[13px] font-medium text-white/80">{subtitle}</p>
					) : null}
				</div>
			</div>
		</header>
	);
}
