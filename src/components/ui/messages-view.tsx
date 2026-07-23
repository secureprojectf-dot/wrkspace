'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
	HashIcon, 
	SendIcon, 
	UsersIcon, 
	MessageSquareIcon, 
	SearchIcon, 
	CircleIcon,
	ArrowLeftIcon,
	ShieldAlertIcon,
	CheckIcon,
	XIcon,
	ChevronDownIcon,
	PencilIcon
} from 'lucide-react';
import { Button } from './button';
import { Input } from './input';
import { cn } from '@/lib/utils';
import { memberChatColor } from '@/lib/chat-member-color';
import { ChatAvatar, clearChatAvatarCache } from './chat-avatar';
import { connectRealtime } from '@/lib/realtime-client';
import { 
	getMessages, 
	postMessage, 
	editMessage,
	toggleMessageReaction,
	getChatMembers,
	requestChannelAccess,
	getChannelAccessStatus,
	getPendingChannelAccessRequests,
	approveChannelAccessRequest,
	rejectChannelAccessRequest
} from '@/app/admin/actions';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;
const EDIT_WINDOW_MS = 10 * 60 * 1000;

/** Solid active colors — readable on employee light portal (avoids /15 tint + forced white text). */
const CHANNEL_META: Record<string, { label: string; accent: string; activeBg: string; activeBorder: string }> = {
	public: {
		label: 'Public Chat',
		accent: '#059669',
		activeBg: '#047857',
		activeBorder: '#065f46',
	},
	marketing: {
		label: 'Marketing Team',
		accent: '#d97706',
		activeBg: '#b45309',
		activeBorder: '#92400e',
	},
	technical: {
		label: 'Technical Team',
		accent: '#0284c7',
		activeBg: '#0369a1',
		activeBorder: '#075985',
	},
	core: {
		label: 'Core Team',
		accent: '#7c3aed',
		activeBg: '#6d28d9',
		activeBorder: '#5b21b6',
	},
};

interface ChatMember {
	id: string;
	name: string;
	email: string;
	role: string;
	hasPhoto?: boolean;
}

interface ReactionType {
	id: string;
	messageId: string;
	userId: string;
	userName: string;
	emoji: string;
}

interface MessageType {
	id: string;
	channel: string;
	senderId: string;
	senderName: string;
	content: string;
	createdAt: Date | string;
	editedAt?: Date | string | null;
	reactions?: ReactionType[];
	senderPhotoUrl?: string | null;
}

interface MessagesViewProps {
	currentUser: {
		id: string;
		name: string;
		email: string;
		role: 'Admin' | 'Employee';
		photoUrl?: string | null;
	};
	/** When opened from admin panel — used for avatar API auth */
	adminEmail?: string;
}

export function MessagesView({ currentUser, adminEmail }: MessagesViewProps) {
	const avatarAdminEmail = adminEmail || (currentUser.role === 'Admin' ? currentUser.email : undefined);
	const [members, setMembers] = useState<ChatMember[]>([]);
	const [activeChannel, setActiveChannel] = useState<string>('public');
	const [channelTitle, setChannelTitle] = useState<string>('Public Chat');
	const [messages, setMessages] = useState<MessageType[]>([]);
	const [messageText, setMessageText] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [isSending, setIsSending] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	
	// Access Control States
	const [accessStatus, setAccessStatus] = useState<'Approved' | 'Pending' | 'Rejected' | 'None'>('Approved');
	const [isCheckingAccess, setIsCheckingAccess] = useState(false);
	const [isRequestingAccess, setIsRequestingAccess] = useState(false);
	const [pendingRequests, setPendingRequests] = useState<any[]>([]);

	// Mobile View State: 'sidebar' shows the list, 'chat' shows the message body
	const [mobileView, setMobileView] = useState<'sidebar' | 'chat'>('sidebar');
	const [menuMsgId, setMenuMsgId] = useState<string | null>(null);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editText, setEditText] = useState('');
	const [reactBusyId, setReactBusyId] = useState<string | null>(null);
	
	const messagesEndRef = useRef<HTMLDivElement>(null);

	const canEditMessage = (msg: MessageType) => {
		if (msg.senderId !== currentUser.id) return false;
		const created = new Date(msg.createdAt).getTime();
		return Date.now() - created <= EDIT_WINDOW_MS;
	};

	const handleReact = async (messageId: string, emoji: string) => {
		setReactBusyId(messageId);
		try {
			await toggleMessageReaction(messageId, currentUser.id, currentUser.name, emoji);
			await fetchMessages(false);
		} catch (err) {
			console.error(err);
		} finally {
			setReactBusyId(null);
			setMenuMsgId(null);
		}
	};

	const handleSaveEdit = async () => {
		if (!editingId || !editText.trim()) return;
		const res = await editMessage(editingId, currentUser.id, editText);
		if (res.success) {
			setEditingId(null);
			setEditText('');
			await fetchMessages(false);
		} else {
			alert(res.error || 'Could not edit message');
		}
	};

	// Load members
	useEffect(() => {
		const loadMembers = async () => {
			const res = await getChatMembers();
			if (res.success && res.members) {
				// Exclude self from direct messages list
				const filtered = res.members.filter(m => m.id !== currentUser.id);
				setMembers(filtered);
			}
		};
		loadMembers();
	}, [currentUser.id]);

	// Live profile photo updates → refresh avatars on all open Messages screens
	useEffect(() => {
		const token =
			typeof window !== 'undefined'
				? localStorage.getItem('wrkspace_employee_token') ||
					(() => {
						try {
							const s = localStorage.getItem('wrkspace_employee_session');
							return s ? (JSON.parse(s) as { token?: string }).token || '' : '';
						} catch {
							return '';
						}
					})()
				: '';
		if (!token) return;
		const stop = connectRealtime({
			token,
			onSafety: (p) => {
				if (String(p.kind || '') !== 'photo_updated') return;
				const id = String(p.employeeId || '');
				clearChatAvatarCache(id || undefined);
				setMembers((prev) =>
					prev.map((m) =>
						m.id === id ? { ...m, hasPhoto: Boolean(p.hasPhoto) } : { ...m },
					),
				);
				// Force remount-ish refresh of message list avatars
				setMessages((prev) => [...prev]);
			},
		});
		return stop;
	}, []);

	// Check access to target channel
	const checkAccess = async (channelId: string) => {
		if (channelId === 'public' || channelId.startsWith('dm:')) {
			setAccessStatus('Approved');
			return;
		}

		if (currentUser.role === 'Admin') {
			setAccessStatus('Approved');
			loadPendingRequests(channelId);
			return;
		}

		setIsCheckingAccess(true);
		try {
			const res = await getChannelAccessStatus(currentUser.id, channelId);
			if (res.success && res.status) {
				setAccessStatus(res.status as any);
			} else {
				setAccessStatus('None');
			}
		} catch {
			setAccessStatus('None');
		} finally {
			setIsCheckingAccess(false);
		}
	};

	// Load pending channel access requests (Admin Only)
	const loadPendingRequests = async (channelId: string) => {
		if (currentUser.role !== 'Admin') return;
		try {
			const res = await getPendingChannelAccessRequests(channelId, currentUser.role);
			if (res.success && res.requests) {
				setPendingRequests(res.requests);
			}
		} catch (err) {
			console.error(err);
		}
	};

	// Fetch messages for active channel
	const fetchMessages = async (showLoading = false) => {
		if (showLoading) setIsLoading(true);
		try {
			const res = await getMessages(activeChannel, currentUser.id, currentUser.role);
			if (res.success && res.messages) {
				setMessages(res.messages as any);
			}
		} catch (err) {
			console.error(err);
		} finally {
			if (showLoading) setIsLoading(false);
		}
	};

	// Polling for new messages and requests
	useEffect(() => {
		checkAccess(activeChannel);
		fetchMessages(true);

		const interval = setInterval(() => {
			// Only fetch messages if approved
			const isUnrestricted = activeChannel === 'public' || activeChannel.startsWith('dm:') || currentUser.role === 'Admin';
			if (isUnrestricted || accessStatus === 'Approved') {
				fetchMessages(false);
			}
			
			if (currentUser.role === 'Admin' && (activeChannel === 'marketing' || activeChannel === 'technical' || activeChannel === 'core')) {
				loadPendingRequests(activeChannel);
			} else if (currentUser.role === 'Employee' && (activeChannel === 'marketing' || activeChannel === 'technical' || activeChannel === 'core')) {
				// Re-verify employee's access status silently in case admin just approved it
				getChannelAccessStatus(currentUser.id, activeChannel).then(res => {
					if (res.success && res.status) {
						setAccessStatus(res.status as any);
					}
				});
			}
		}, 1000);

		return () => clearInterval(interval);
	}, [activeChannel, accessStatus]);

	const scrollMessagesToBottom = () => {
		// Scroll only the chat pane — never the whole page
		const el = messagesEndRef.current?.parentElement;
		if (el) el.scrollTop = el.scrollHeight;
	};

	const handleSendMessage = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!messageText.trim() || isSending) return;

		setIsSending(true);
		const tempText = messageText;
		setMessageText('');

		try {
			const res = await postMessage(
				activeChannel,
				currentUser.id,
				currentUser.role === 'Admin' ? 'Admin' : currentUser.name,
				tempText,
				currentUser.role
			);
			if (res.success) {
				await fetchMessages(false);
				// Only jump down when the user just sent — never on poll refresh
				requestAnimationFrame(scrollMessagesToBottom);
			} else {
				setMessageText(tempText); // restore text on failure
			}
		} catch (err) {
			console.error(err);
		} finally {
			setIsSending(false);
		}
	};

	const handleRequestAccess = async () => {
		setIsRequestingAccess(true);
		try {
			const res = await requestChannelAccess(currentUser.id, currentUser.name, activeChannel);
			if (res.success && res.request) {
				setAccessStatus(res.request.status as any);
			}
		} catch (err) {
			console.error(err);
		} finally {
			setIsRequestingAccess(false);
		}
	};

	const handleApproveRequest = async (requestId: string) => {
		try {
			const res = await approveChannelAccessRequest(requestId, currentUser.role);
			if (res.success) {
				await loadPendingRequests(activeChannel);
			}
		} catch (err) {
			console.error(err);
		}
	};

	const handleRejectRequest = async (requestId: string) => {
		try {
			const res = await rejectChannelAccessRequest(requestId, currentUser.role);
			if (res.success) {
				await loadPendingRequests(activeChannel);
			}
		} catch (err) {
			console.error(err);
		}
	};

	const selectChannel = (channelId: string, title: string) => {
		setActiveChannel(channelId);
		setChannelTitle(title);
		setMessages([]);
		setMobileView('chat');
		setPendingRequests([]);
		checkAccess(channelId);
	};

	const selectDM = (member: ChatMember) => {
		// Create deterministic DM channel string: dm:minId:maxId
		const sortedIds = [currentUser.id, member.id].sort();
		const dmChannelId = `dm:${sortedIds[0]}:${sortedIds[1]}`;
		selectChannel(dmChannelId, member.name);
	};

	const filteredMembers = members.filter(m => 
		m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
		m.email.toLowerCase().includes(searchQuery.toLowerCase())
	);

	return (
		<div className="w-full h-full border-t border-zinc-800 bg-zinc-950 flex overflow-hidden">
			{/* Left Sidebar (Channels / Users) */}
			<div className={cn(
				"w-full md:w-80 border-r border-zinc-800 flex flex-col bg-zinc-950/80 shrink-0",
				mobileView === 'chat' ? "hidden md:flex" : "flex"
			)}>
				{/* Top Search bar */}
				<div className="p-4 border-b border-zinc-900">
					<div className="relative">
						<SearchIcon className="absolute left-3 top-2.5 size-4 text-zinc-550" />
						<Input
							type="text"
							placeholder="Search people..."
							className="pl-9 bg-zinc-900/60 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 text-xs h-9 focus-visible:ring-0 focus-visible:border-zinc-700 focus:outline-none"
							value={searchQuery}
							onChange={e => setSearchQuery(e.target.value)}
						/>
					</div>
				</div>

				{/* Sidebar Content */}
				<div className="flex-1 overflow-y-auto p-3 space-y-6 scrollbar-thin scrollbar-thumb-zinc-800">
					{/* Global & Team Rooms */}
					<div className="space-y-1.5">
						<div className="flex items-center gap-2 px-1">
							{mobileView === 'chat' && (
								<button
									type="button"
									onClick={() => setMobileView('sidebar')}
									className="md:hidden p-1 text-zinc-400 hover:text-white cursor-pointer shrink-0"
									aria-label="Back to channels"
								>
									<ArrowLeftIcon className="size-4" />
								</button>
							)}
							<h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-2">Channels</h3>
						</div>

						{(['public', 'marketing', 'technical', 'core'] as const).map((id) => {
							const meta = CHANNEL_META[id];
							const restricted = id !== 'public' && currentUser.role === 'Employee';
							const active = activeChannel === id;
							return (
								<button
									key={id}
									type="button"
									onClick={() => selectChannel(id, meta.label)}
									className={cn(
										"w-full text-left px-3 py-2.5 text-sm flex items-center justify-between gap-2 transition-colors cursor-pointer border-l-2 font-semibold",
										active ? "channel-pill-active" : "border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40 font-normal"
									)}
									style={active ? {
										backgroundColor: meta.activeBg,
										borderLeftColor: meta.activeBorder,
									} : undefined}
								>
									<span className="flex items-center gap-2.5 min-w-0">
										{id === 'public' ? (
											<UsersIcon className="size-4 shrink-0 opacity-90" style={!active ? { color: meta.accent } : undefined} />
										) : (
											<HashIcon className="size-4 shrink-0 opacity-90" style={!active ? { color: meta.accent } : undefined} />
										)}
										<span className="truncate leading-none pt-px">{meta.label}</span>
									</span>
									{restricted ? (
										<span className="text-[9px] font-mono uppercase tracking-wider font-semibold shrink-0 opacity-90">
											Restricted
										</span>
									) : (
										<span className="w-14 shrink-0" aria-hidden />
									)}
								</button>
							);
						})}
					</div>

					{/* Direct Messages Section */}
					<div className="space-y-1.5">
						<div className="flex items-center gap-2 px-1">
							{mobileView === 'chat' && activeChannel.startsWith('dm:') && (
								<button
									type="button"
									onClick={() => setMobileView('sidebar')}
									className="md:hidden p-1 text-zinc-400 hover:text-white cursor-pointer shrink-0"
									aria-label="Back to direct messages"
								>
									<ArrowLeftIcon className="size-4" />
								</button>
							)}
							<h3 className="px-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Direct Messages</h3>
						</div>
						
						{filteredMembers.length === 0 ? (
							<p className="px-3 text-xs text-zinc-600 italic">No members found</p>
						) : (
							filteredMembers.map((member) => {
								const sortedIds = [currentUser.id, member.id].sort();
								const dmId = `dm:${sortedIds[0]}:${sortedIds[1]}`;
								const isSelected = activeChannel === dmId;

								return (
									<button
										key={member.id}
										onClick={() => selectDM(member)}
										className={cn(
											"w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors cursor-pointer",
											isSelected
												? "bg-indigo-600/10 border-l-2 border-indigo-500 text-indigo-400 font-semibold"
												: "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40"
										)}
									>
										<div className="flex items-center gap-2.5 overflow-hidden">
											<ChatAvatar
												id={member.id}
												name={member.name}
												hasPhoto={member.hasPhoto !== false}
												adminEmail={avatarAdminEmail}
												size={28}
											/>
											<span className="truncate">{member.name}</span>
										</div>
										<span className={cn(
											"text-[9px] px-1.5 py-0.5 font-mono shrink-0 font-semibold uppercase tracking-wide",
											member.role === 'Admin'
												? "bg-indigo-600 text-white border border-indigo-700"
												: "bg-slate-200 text-slate-800 border border-slate-300"
										)}>
											{member.role}
										</span>
									</button>
								);
							})
						)}
					</div>
				</div>

				{/* User Profile Footer */}
				<div className="p-3 border-t border-zinc-900 bg-zinc-950 flex items-center justify-between">
					<div className="flex items-center gap-2 overflow-hidden">
						{(() => {
							return (
								<div className="shrink-0">
									{currentUser.role === 'Admin' && !currentUser.photoUrl ? (
										<span className="size-8 rounded-full flex items-center justify-center text-xs font-bold bg-indigo-600 text-white">
											AD
										</span>
									) : (
										<ChatAvatar
											id={currentUser.id}
											name={currentUser.name}
											photoUrl={currentUser.photoUrl}
											adminEmail={avatarAdminEmail}
											size={32}
										/>
									)}
								</div>
							);
						})()}
						<div className="overflow-hidden">
							<p className="text-xs font-bold text-zinc-200 truncate">{currentUser.name}</p>
							<p className="text-[10px] text-zinc-550 truncate">{currentUser.email}</p>
						</div>
					</div>
					<CircleIcon className="size-2 text-emerald-400 fill-emerald-400 shrink-0" />
				</div>
			</div>

			{/* Right Section (Messages Container) */}
			<div className={cn(
				"flex-1 flex flex-col bg-zinc-950",
				mobileView === 'sidebar' ? "hidden md:flex" : "flex"
			)}>
				{/* Compact title row (no tall navbar) */}
				<div className="px-4 py-2 border-b border-zinc-800 flex items-center gap-2 bg-zinc-950 min-h-0">
					<button
						type="button"
						onClick={() => setMobileView('sidebar')}
						className="md:hidden p-1 text-zinc-400 hover:text-white cursor-pointer shrink-0"
						aria-label="Back"
					>
						<ArrowLeftIcon className="size-4" />
					</button>
					<p className="text-sm font-semibold text-zinc-100 truncate">{channelTitle}</p>
				</div>

				{/* Admin Review Banner (Pending requests) */}
				{currentUser.role === 'Admin' && pendingRequests.length > 0 && (
					<div className="bg-indigo-950/20 border-b border-indigo-900/40 px-6 py-3 flex flex-col space-y-2">
						<div className="flex items-center justify-between">
							<p className="text-xs text-indigo-400 font-bold flex items-center gap-2">
								<span className="size-2 rounded-full bg-indigo-500 animate-ping shrink-0" />
								Registry Alert: {pendingRequests.length} Pending Channel Access Request{pendingRequests.length > 1 ? 's' : ''}
							</p>
						</div>
						<div className="divide-y divide-indigo-950/40 max-h-40 overflow-y-auto space-y-2">
							{pendingRequests.map((req) => (
								<div key={req.id} className="flex items-center justify-between text-xs py-1.5 first:pt-0">
									<div className="flex flex-col">
										<span className="font-bold text-zinc-200">{req.employeeName}</span>
										<span className="text-[10px] text-zinc-500 font-mono">Employee ID: {req.employeeId}</span>
									</div>
									<div className="flex gap-2">
										<button
											onClick={() => handleApproveRequest(req.id)}
											className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer transition-colors"
											title="Approve Request"
										>
											<CheckIcon className="size-3.5" />
										</button>
										<button
											onClick={() => handleRejectRequest(req.id)}
											className="p-1.5 bg-red-650/80 hover:bg-red-500 text-white cursor-pointer transition-colors"
											title="Decline Request"
										>
											<XIcon className="size-3.5" />
										</button>
									</div>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Messages Scroll Area */}
				<div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin scrollbar-thumb-zinc-800 bg-zinc-950 flex flex-col justify-start">
					{isCheckingAccess ? (
						<div className="h-full flex items-center justify-center">
							<span className="text-xs text-zinc-550 font-mono flex items-center gap-2">
								<span className="size-4 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
								Verifying directory security credentials...
							</span>
						</div>
					) : accessStatus === 'None' ? (
						<div className="max-w-md mx-auto my-auto text-center space-y-6 p-8 border border-zinc-800 bg-zinc-900/10">
							<div className="w-12 h-12 bg-indigo-950 border border-indigo-900/40 rounded-none flex items-center justify-center mx-auto text-indigo-400">
								<ShieldAlertIcon className="size-6" />
							</div>
							<div className="space-y-2">
								<h3 className="text-lg font-bold text-white uppercase tracking-wider">Access Request Required</h3>
								<p className="text-xs text-zinc-400 leading-relaxed font-medium">
									The channel <span className="text-indigo-400 font-bold">#{activeChannel}</span> is restricted to approved members of the department only. You must submit a registry access request to the system administrators.
								</p>
							</div>
							<Button
								onClick={handleRequestAccess}
								disabled={isRequestingAccess}
								className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 px-6 rounded-none cursor-pointer w-full transition-all"
							>
								{isRequestingAccess ? 'Submitting request...' : 'Request Access'}
							</Button>
						</div>
					) : accessStatus === 'Pending' ? (
						<div className="max-w-md mx-auto my-auto text-center space-y-6 p-8 border border-zinc-850 bg-zinc-900/10">
							<div className="w-12 h-12 bg-yellow-950 border border-yellow-900/40 rounded-none flex items-center justify-center mx-auto text-yellow-400">
								<CircleIcon className="size-4 fill-yellow-400 animate-pulse" />
							</div>
							<div className="space-y-2">
								<h3 className="text-lg font-bold text-white uppercase tracking-wider">Access Request Pending</h3>
								<p className="text-xs text-zinc-400 leading-relaxed font-medium">
									Your request to join <span className="text-indigo-400 font-bold">#{activeChannel}</span> has been logged in the system queue. System administrators must approve your access before you can enter the channel chat room.
								</p>
							</div>
							<div className="text-[10px] text-zinc-550 font-mono italic">
								Status: Awaiting Admin Approval
							</div>
						</div>
					) : accessStatus === 'Rejected' ? (
						<div className="max-w-md mx-auto my-auto text-center space-y-6 p-8 border border-red-900/20 bg-zinc-900/10">
							<div className="w-12 h-12 bg-red-950 border border-red-900/40 rounded-none flex items-center justify-center mx-auto text-red-400">
								<ShieldAlertIcon className="size-6 text-red-400" />
							</div>
							<div className="space-y-2">
								<h3 className="text-lg font-bold text-white uppercase tracking-wider">Access Request Declined</h3>
								<p className="text-xs text-zinc-400 leading-relaxed font-medium">
									Your request to join <span className="text-indigo-400 font-bold">#{activeChannel}</span> was declined by the administrator directory registry.
								</p>
							</div>
							<Button
								onClick={handleRequestAccess}
								disabled={isRequestingAccess}
								className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 px-6 rounded-none cursor-pointer w-full transition-all"
							>
								{isRequestingAccess ? 'Resubmitting...' : 'Re-Submit Access Request'}
							</Button>
						</div>
					) : (
						<>
							{isLoading ? (
								<div className="h-full flex items-center justify-center">
									<span className="text-xs text-zinc-550 font-mono flex items-center gap-2">
										<span className="size-4 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
										Syncing messages console...
									</span>
								</div>
							) : messages.length === 0 ? (
								<div className="h-full flex flex-col items-center justify-center text-center p-4 my-auto">
									<MessageSquareIcon className="size-8 text-zinc-700 mb-2" />
									<p className="text-xs text-zinc-500 font-bold">No messages here yet</p>
									<p className="text-[10px] text-zinc-650 mt-1 max-w-[240px]">
										Start the conversation! Type a message below and hit send.
									</p>
								</div>
							) : (
								messages.map((msg) => {
									const isSelf = msg.senderId === currentUser.id;
									const timeStr = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
									const color = memberChatColor(msg.senderId || msg.senderName);
									const reactions = msg.reactions || [];
									const byEmoji = QUICK_EMOJIS.map((emoji) => ({
										emoji,
										count: reactions.filter((r) => r.emoji === emoji).length,
										mine: reactions.some((r) => r.emoji === emoji && r.userId === currentUser.id),
									})).filter((r) => r.count > 0);
									const menuOpen = menuMsgId === msg.id;
									const isEditing = editingId === msg.id;

									return (
										<div 
											key={msg.id} 
											className={cn(
												"flex gap-2 max-w-[85%] sm:max-w-[75%] first:mt-auto group",
												isSelf ? "ml-auto flex-row-reverse" : "mr-auto flex-row"
											)}
										>
											<div className="shrink-0 mt-5" title={msg.senderName}>
												<ChatAvatar
													id={msg.senderId}
													name={msg.senderName}
													photoUrl={
														isSelf
															? currentUser.photoUrl
															: msg.senderPhotoUrl
													}
													hasPhoto
													adminEmail={avatarAdminEmail}
													size={32}
												/>
											</div>
											<div className={cn("flex flex-col min-w-0 relative", isSelf ? "items-end" : "items-start")}>
												<div className="flex items-center gap-2 mb-1">
													<span
														className="text-[10px] font-bold font-mono"
														style={{ color: color.accent }}
													>
														{msg.senderName}
													</span>
													<span className="text-[9px] text-zinc-600 font-mono">{timeStr}</span>
													{msg.editedAt && (
														<span className="text-[9px] text-zinc-600 italic">edited</span>
													)}
												</div>
												<div className="relative w-full">
													{/* Hover chevron (WhatsApp-style) */}
													<button
														type="button"
														onClick={() => setMenuMsgId(menuOpen ? null : msg.id)}
														className={cn(
															"absolute -top-1 z-10 size-6 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer",
															isSelf ? "-left-8" : "-right-8",
															menuOpen && "opacity-100"
														)}
														aria-label="Message actions"
													>
														<ChevronDownIcon className="size-3.5" />
													</button>

													{menuOpen && (
														<div
															className={cn(
																"absolute z-20 top-0 mb-1 p-2 rounded-xl bg-zinc-900 border border-zinc-700 shadow-xl min-w-[200px]",
																isSelf ? "right-0" : "left-0"
															)}
														>
															<div className="flex gap-1 mb-2 justify-between">
																{QUICK_EMOJIS.map((emoji) => (
																	<button
																		key={emoji}
																		type="button"
																		disabled={reactBusyId === msg.id}
																		onClick={() => handleReact(msg.id, emoji)}
																		className="size-8 text-base hover:bg-zinc-800 rounded-lg cursor-pointer"
																	>
																		{emoji}
																	</button>
																))}
															</div>
															{canEditMessage(msg) && (
																<button
																	type="button"
																	onClick={() => {
																		setEditingId(msg.id);
																		setEditText(msg.content);
																		setMenuMsgId(null);
																	}}
																	className="w-full flex items-center gap-2 text-xs text-zinc-200 hover:bg-zinc-800 px-2 py-1.5 rounded-md cursor-pointer"
																>
																	<PencilIcon className="size-3.5" />
																	Edit
																</button>
															)}
														</div>
													)}

													{isEditing ? (
														<div className="w-full space-y-2 rounded-xl border border-zinc-700 bg-zinc-900 p-3">
															<textarea
																value={editText}
																onChange={(e) => setEditText(e.target.value)}
																rows={3}
																className="w-full bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 p-2 rounded-md resize-none focus:outline-none"
															/>
															<div className="flex justify-end gap-2">
																<button
																	type="button"
																	onClick={() => { setEditingId(null); setEditText(''); }}
																	className="text-xs text-zinc-400 px-2 py-1 cursor-pointer"
																>
																	Cancel
																</button>
																<button
																	type="button"
																	onClick={handleSaveEdit}
																	className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-md cursor-pointer"
																>
																	Save
																</button>
															</div>
														</div>
													) : (
														<div
															className="px-4 py-2.5 text-sm rounded-xl border leading-relaxed break-words text-start w-full"
															style={{
																backgroundColor: color.bg,
																color: color.fg,
																borderColor: color.soft,
															}}
														>
															{msg.content}
														</div>
													)}
												</div>
												{byEmoji.length > 0 && (
													<div className={cn("flex flex-wrap gap-1 mt-1", isSelf ? "justify-end" : "justify-start")}>
														{byEmoji.map((r) => (
															<button
																key={r.emoji}
																type="button"
																onClick={() => handleReact(msg.id, r.emoji)}
																className={cn(
																	"text-[11px] px-1.5 py-0.5 rounded-full border cursor-pointer",
																	r.mine
																		? "bg-indigo-950/60 border-indigo-600 text-indigo-200"
																		: "bg-zinc-900 border-zinc-700 text-zinc-300"
																)}
															>
																{r.emoji} {r.count}
															</button>
														))}
													</div>
												)}
											</div>
										</div>
									);
								})
							)}
							<div ref={messagesEndRef} />
						</>
					)}
				</div>

				{/* Input box (only visible if approved) */}
				{accessStatus === 'Approved' && (
					<form onSubmit={handleSendMessage} className="p-4 border-t border-zinc-800 bg-zinc-950 flex gap-3">
						<Input
							type="text"
							placeholder={`Message ${channelTitle}...`}
							className="flex-1 bg-zinc-900/40 border-zinc-800 text-zinc-150 placeholder:text-zinc-600 focus-visible:ring-0 focus-visible:border-zinc-700 h-11 focus:outline-none"
							value={messageText}
							onChange={e => setMessageText(e.target.value)}
						/>
						<Button 
							type="submit" 
							disabled={!messageText.trim() || isSending}
							className="bg-indigo-600 hover:bg-indigo-500 hover:shadow-md hover:shadow-indigo-600/20 text-white size-11 flex items-center justify-center shrink-0 cursor-pointer transition-all"
						>
							<SendIcon className="size-4" />
						</Button>
					</form>
				)}
			</div>
		</div>
	);
}
