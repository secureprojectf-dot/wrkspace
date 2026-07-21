'use client';

import { MessagesView } from '@/components/ui/messages-view';
import { employeeDisplayName } from '@/lib/mobile-api';

type Props = {
	employee: any;
};

/** Full Flutter Messages tab — reuses web MessagesView (photos, DMs, channels). */
export function MobileMessagesTab({ employee }: Props) {
	return (
		<div className="mobile-messages-wrap flex h-full min-h-0 flex-col bg-[#F0F3FF] pt-[env(safe-area-inset-top)]">
			<div className="min-h-0 flex-1 overflow-hidden">
				<MessagesView
					currentUser={{
						id: employee.id,
						name: employeeDisplayName(employee),
						email: employee.email,
						role: 'Employee',
						photoUrl: employee.photoUrl ?? null,
					}}
				/>
			</div>
		</div>
	);
}
