'use client';

import {
	Building2,
	CalendarDays,
	ChevronRight,
	FileText,
	History,
	Home,
	IdCard,
	Leaf,
	LogOut,
	Route,
	Shield,
	Siren,
	TrendingUp,
	UserRound,
} from 'lucide-react';
import { CorpPageHeader } from '../corp-page-header';
import { isFemaleEmployee } from '@/lib/mobile-api';

type Item = {
	key: string;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
	color: string;
};

type Props = {
	employee: any;
	onOpenPanel: (panel: string) => void;
	onLogout: () => void;
	onProfile: () => void;
};

export function MobileMoreTab({ employee, onOpenPanel, onLogout, onProfile }: Props) {
	const female = isFemaleEmployee(employee);

	const work: Item[] = [
		{ key: 'attendance', label: 'Attendance logs', icon: History, color: '#D97706' },
		{ key: 'leaves', label: 'Leaves', icon: Leaf, color: '#7C3AED' },
		{ key: 'events', label: 'All events', icon: CalendarDays, color: '#DB2777' },
		{ key: 'submissions', label: 'Submissions', icon: FileText, color: '#4F46E5' },
	];

	const business: Item[] = [
		{ key: 'leads', label: 'Leads', icon: TrendingUp, color: '#EA580C' },
		{ key: 'companies', label: 'Companies', icon: Building2, color: '#0D9488' },
		{ key: 'profile', label: 'Profile', icon: UserRound, color: '#0047FF' },
		{ key: 'id_card', label: 'ID card', icon: IdCard, color: '#0F766E' },
	];

	const safety: Item[] = female
		? [
				{ key: 'safety', label: 'Girl Safety hub', icon: Shield, color: '#9D174D' },
				{ key: 'sos', label: 'Emergency SOS', icon: Siren, color: '#B42318' },
				{ key: 'home_pin', label: 'Home pin', icon: Home, color: '#0369A1' },
				{ key: 'trips', label: 'Trip history', icon: Route, color: '#475569' },
			]
		: [];

	const Section = ({ title, items }: { title: string; items: Item[] }) => (
		<div className="mb-4">
			<p className="px-3 pb-1 pt-2 text-[11px] font-bold tracking-[0.8px] text-[#64748B]">
				{title.toUpperCase()}
			</p>
			{items.map((item, i) => {
				const Icon = item.icon;
				return (
					<div key={item.key}>
						<button
							type="button"
							onClick={() => (item.key === 'profile' ? onProfile() : onOpenPanel(item.key))}
							className="flex w-full items-center gap-3 px-3 py-3 text-left"
						>
							<span
								className="flex size-9 items-center justify-center rounded-[10px]"
								style={{ backgroundColor: `${item.color}1F`, color: item.color }}
							>
								<Icon className="size-[18px]" />
							</span>
							<span className="flex-1 text-[15px] font-semibold text-[#0F172A]">
								{item.label}
							</span>
							<ChevronRight className="size-5 text-[#94A3B8]" />
						</button>
						{i < items.length - 1 ? (
							<div className="ml-[60px] h-px bg-[#E2E8F0]" />
						) : null}
					</div>
				);
			})}
		</div>
	);

	return (
		<div className="flex h-full min-h-0 flex-col bg-[#F0F3FF]">
			<CorpPageHeader
				employee={employee}
				subtitle="Leaves, logs, profile & tools"
				onProfile={onProfile}
			/>
			<div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(172px+env(safe-area-inset-bottom,0px))] pt-4">
				<div className="rounded-[14px] border border-[#E2E8F0] bg-white px-1 py-2">
					<Section title="Workspace" items={work} />
					<Section title="Business" items={business} />
					{safety.length ? <Section title="Safety tools" items={safety} /> : null}
				</div>

				<button
					type="button"
					onClick={onLogout}
					className="mt-4 flex w-full items-center justify-center gap-2 rounded-[14px] border border-[#FEE4E2] bg-white py-3.5 text-sm font-semibold text-[#B42318]"
				>
					<LogOut className="size-4" />
					Sign out
				</button>

				<div className="mt-7 flex items-center px-1 text-xs font-semibold text-[#64748B]">
					<span>wrkspace</span>
					<span className="ml-auto font-medium">version 2.0</span>
				</div>
			</div>
		</div>
	);
}
