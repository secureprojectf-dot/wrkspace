'use client';

import { HomeLocationPicker } from '@/components/ui/home-location-picker';
import { isFemaleEmployee } from '@/lib/mobile-api';

type Props = {
	employee: any;
	onEmployeeUpdate?: (next: any) => void;
};

export function MobileHomePin({ employee, onEmployeeUpdate }: Props) {
	if (!isFemaleEmployee(employee)) {
		return (
			<div className="p-4">
				<p className="rounded-xl border border-[#E2E8F0] bg-white p-4 text-sm text-[#64748B]">
					Home pin is for Girl Safety enrolled employees.
				</p>
			</div>
		);
	}

	return (
		<div className="p-4 pb-8">
			<p className="mb-3 text-sm text-[#64748B]">
				Set your home once. After save it locks — ask admin to unlock if you need to change it.
			</p>
			<div className="overflow-hidden rounded-[14px] border border-[#E2E8F0] bg-white">
				<HomeLocationPicker
					employee={employee}
					onSaved={(next) => {
						const merged = { ...employee, ...next };
						onEmployeeUpdate?.(merged);
						try {
							localStorage.setItem('wrkspace_employee_session', JSON.stringify(merged));
						} catch {
							/* ignore */
						}
					}}
				/>
			</div>
		</div>
	);
}
