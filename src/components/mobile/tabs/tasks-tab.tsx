'use client';

import { useCallback, useEffect, useState } from 'react';
import { ListTodo } from 'lucide-react';
import { getEmployeeTasks, updateTaskStatus } from '@/app/admin/actions';
import { cn } from '@/lib/utils';

type Props = { employee: any };

export function MobileTasksTab({ employee }: Props) {
	const [tasks, setTasks] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [busyId, setBusyId] = useState<string | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const rows = await getEmployeeTasks(employee.id);
			setTasks(Array.isArray(rows) ? rows : []);
			setError(null);
		} catch (e: any) {
			setError(e?.message || 'Failed to load tasks');
		} finally {
			setLoading(false);
		}
	}, [employee.id]);

	useEffect(() => {
		void load();
	}, [load]);

	const pending = tasks.filter((t) => String(t.status) !== 'Completed').length;

	const cycleStatus = async (task: any) => {
		const cur = String(task.status || 'Pending');
		const next =
			cur === 'Pending' ? 'In Progress' : cur === 'In Progress' ? 'Completed' : 'Pending';
		setBusyId(task.id);
		try {
			await updateTaskStatus(task.id, next);
			await load();
		} catch (e: any) {
			setError(e?.message || 'Update failed');
		} finally {
			setBusyId(null);
		}
	};

	const statusColor = (status: string) => {
		if (status === 'Completed') return 'text-[#067647] bg-[#ECFDF3]';
		if (status === 'In Progress') return 'text-[#0047FF] bg-[#E8EFFF]';
		return 'text-[#D97706] bg-[#FFF7ED]';
	};

	return (
		<div className="flex h-full min-h-0 flex-col bg-[#F0F3FF]">
			<div className="shrink-0 border-b border-[#E2E8F0] bg-white px-4 pb-4 pt-4">
				<div className="flex items-center gap-3">
					<div className="flex size-11 items-center justify-center rounded-xl bg-[#E8EFFF] text-[#0047FF]">
						<ListTodo className="size-5" />
					</div>
					<div>
						<p className="text-lg font-bold text-[#0F172A]">Allocated work</p>
						<p className="text-[13px] text-[#64748B]">
							{pending} open · {tasks.length} total — tap to update
						</p>
					</div>
				</div>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(172px+env(safe-area-inset-bottom,0px))] pt-4">
				{error ? <p className="mb-3 text-xs font-medium text-[#B42318]">{error}</p> : null}
				{loading ? (
					<div className="flex justify-center py-16">
						<div className="size-6 animate-spin rounded-full border-2 border-[#0047FF] border-t-transparent" />
					</div>
				) : tasks.length === 0 ? (
					<div className="rounded-[14px] border border-[#E2E8F0] bg-white py-12 text-center text-sm text-[#64748B]">
						No tasks are currently allocated to you.
					</div>
				) : (
					<ul className="space-y-3">
						{tasks.map((t) => (
							<li key={t.id}>
								<button
									type="button"
									disabled={busyId === t.id}
									onClick={() => void cycleStatus(t)}
									className="w-full rounded-[14px] border border-[#E2E8F0] bg-white p-4 text-left active:scale-[0.99]"
								>
									<div className="flex items-start justify-between gap-2">
										<p className="text-[15px] font-bold text-[#0F172A]">
											{t.title || t.name || 'Task'}
										</p>
										<span
											className={cn(
												'shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold',
												statusColor(String(t.status || 'Pending')),
											)}
										>
											{t.status || 'Pending'}
										</span>
									</div>
									{t.description ? (
										<p className="mt-1 line-clamp-2 text-[13px] text-[#64748B]">
											{t.description}
										</p>
									) : null}
									{t.dueDate ? (
										<p className="mt-2 text-[12px] font-medium text-[#94A3B8]">
											Due {String(t.dueDate).slice(0, 10)}
										</p>
									) : null}
								</button>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}
