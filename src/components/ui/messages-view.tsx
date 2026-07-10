'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
	HashIcon, 
	SendIcon, 
	UserIcon, 
	UsersIcon, 
	MessageSquareIcon, 
	SearchIcon, 
	CircleIcon,
	RefreshCwIcon,
	ArrowLeftIcon,
	ShieldAlertIcon,
	CheckIcon,
	XIcon
} from 'lucide-react';
import { Button } from './button';
import { Input } from './input';
import { cn } from '@/lib/utils';
import { 
	getMessages, 
	postMessage, 
	getChatMembers,
	requestChannelAccess,
	getChannelAccessStatus,
	getPendingChannelAccessRequests,
	approveChannelAccessRequest,
	rejectChannelAccessRequest
} from '@/app/admin/actions';

interface ChatMember {
	id: string;
	name: string;
	email: string;
	role: string;
}

interface MessageType {
	id: string;
	channel: string;
	senderId: string;
	senderName: string;
	content: string;
	createdAt: Date;
}

interface MessagesViewProps {
	currentUser: {
		id: string;
		name: string;
		email: string;
		role: 'Admin' | 'Employee';
	};
}

export function MessagesView({ currentUser }: MessagesViewProps) {
	const [members, setMembers] = useState<ChatMember[]>([]);
	const [activeChannel, setActiveChannel] = useState<string>('public');
	const [channelTitle, setChannelTitle] = useState<string>('Public Chat');
	const [messages, setMessages] = useState<MessageType[]>([]);
	const [messageText, setMessageText] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [isSending, setIsSending] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [isRefreshing, setIsRefreshing] = useState(false);
	
	// Access Control States
	const [accessStatus, setAccessStatus] = useState<'Approved' | 'Pending' | 'Rejected' | 'None'>('Approved');
	const [isCheckingAccess, setIsCheckingAccess] = useState(false);
	const [isRequestingAccess, setIsRequestingAccess] = useState(false);
	const [pendingRequests, setPendingRequests] = useState<any[]>([]);

	// Mobile View State: 'sidebar' shows the list, 'chat' shows the message body
	const [mobileView, setMobileView] = useState<'sidebar' | 'chat'>('sidebar');
	
	const messagesEndRef = useRef<HTMLDivElement>(null);

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

	// Scroll to bottom on new messages
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messages]);

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

	const handleRefresh = async () => {
		setIsRefreshing(true);
		await checkAccess(activeChannel);
		await fetchMessages(false);
		setIsRefreshing(false);
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
						<div className="flex items-center justify-between px-3">
							<h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Channels</h3>
						</div>
						
						{/* Public Room */}
						<button
							onClick={() => selectChannel('public', 'Public Chat')}
							className={cn(
								"w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 transition-colors cursor-pointer",
								activeChannel === 'public'
									? "bg-indigo-600/10 border-l-2 border-indigo-500 text-indigo-400 font-semibold"
									: "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40"
							)}
						>
							<UsersIcon className="size-4 opacity-75" />
							<span>Public Chat</span>
						</button>

						{/* Marketing Team Room */}
						<button
							onClick={() => selectChannel('marketing', 'Marketing Team')}
							className={cn(
								"w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors cursor-pointer",
								activeChannel === 'marketing'
									? "bg-indigo-600/10 border-l-2 border-indigo-500 text-indigo-400 font-semibold"
									: "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40"
							)}
						>
							<div className="flex items-center gap-2.5">
								<HashIcon className="size-4 opacity-75" />
								<span>Marketing Team</span>
							</div>
							{currentUser.role === 'Employee' && (
								<span className="text-[9px] text-zinc-600 font-mono uppercase tracking-wider font-semibold">
									Restricted
								</span>
							)}
						</button>

						{/* Technical Team Room */}
						<button
							onClick={() => selectChannel('technical', 'Technical Team')}
							className={cn(
								"w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors cursor-pointer",
								activeChannel === 'technical'
									? "bg-indigo-600/10 border-l-2 border-indigo-500 text-indigo-400 font-semibold"
									: "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40"
							)}
						>
							<div className="flex items-center gap-2.5">
								<HashIcon className="size-4 opacity-75" />
								<span>Technical Team</span>
							</div>
							{currentUser.role === 'Employee' && (
								<span className="text-[9px] text-zinc-600 font-mono uppercase tracking-wider font-semibold">
									Restricted
								</span>
							)}
						</button>

						{/* Core Team Room */}
						<button
							onClick={() => selectChannel('core', 'Core Team')}
							className={cn(
								"w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors cursor-pointer",
								activeChannel === 'core'
									? "bg-indigo-600/10 border-l-2 border-indigo-500 text-indigo-400 font-semibold"
									: "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40"
							)}
						>
							<div className="flex items-center gap-2.5">
								<HashIcon className="size-4 opacity-75" />
								<span>Core Team</span>
							</div>
							{currentUser.role === 'Employee' && (
								<span className="text-[9px] text-zinc-600 font-mono uppercase tracking-wider font-semibold">
									Restricted
								</span>
							)}
						</button>
					</div>

					{/* Direct Messages Section */}
					<div className="space-y-1.5">
						<h3 className="px-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Direct Messages</h3>
						
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
											<UserIcon className="size-4 opacity-75 shrink-0" />
											<span className="truncate">{member.name}</span>
										</div>
										<span className={cn(
											"text-[9px] px-1.5 py-0.5 font-mono shrink-0",
											member.role === 'Admin' 
												? "bg-indigo-950 text-indigo-455 border border-indigo-900/30" 
												: "bg-zinc-900 text-zinc-500 border border-zinc-800"
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
						<div className="size-8 rounded-none bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
							<span className="text-xs font-bold text-zinc-300">
								{currentUser.role === 'Admin' ? 'AD' : currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2)}
							</span>
						</div>
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
				{/* Top bar */}
				<div className="h-[60px] px-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-950">
					<div className="flex items-center gap-3 overflow-hidden">
						{/* Mobile Back Button */}
						<button
							onClick={() => setMobileView('sidebar')}
							className="md:hidden p-1 mr-1 text-zinc-400 hover:text-white hover:bg-zinc-900/60 rounded-none cursor-pointer shrink-0"
						>
							<ArrowLeftIcon className="size-4" />
						</button>

						{activeChannel.startsWith('dm:') ? (
							<UserIcon className="size-5 text-indigo-400 shrink-0" />
						) : activeChannel === 'public' ? (
							<UsersIcon className="size-5 text-indigo-400 shrink-0" />
						) : (
							<HashIcon className="size-5 text-indigo-400 shrink-0" />
						)}
						<div className="overflow-hidden">
							<h2 className="text-sm font-bold text-white tracking-wide truncate">{channelTitle}</h2>
							<p className="text-[10px] text-zinc-550 font-mono truncate">
								{activeChannel.startsWith('dm:') ? 'Private Direct Message' : `Channel: #${activeChannel}`}
							</p>
						</div>
					</div>
					
					<Button
						variant="ghost"
						size="icon"
						onClick={handleRefresh}
						disabled={isRefreshing}
						className="size-8 text-zinc-400 hover:text-white hover:bg-zinc-900/60 cursor-pointer shrink-0"
					>
						<RefreshCwIcon className={cn("size-4", isRefreshing && "animate-spin")} />
					</Button>
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
									
									return (
										<div 
											key={msg.id} 
											className={cn(
												"flex flex-col max-w-[75%] sm:max-w-[70%] first:mt-auto",
												isSelf ? "ml-auto items-end" : "mr-auto items-start"
											)}
										>
											{/* Name & Time */}
											<div className="flex items-center gap-2 mb-1">
												<span className={cn(
													"text-[10px] font-bold font-mono",
													isSelf ? "text-indigo-400" : "text-zinc-450"
												)}>
													{msg.senderName}
												</span>
												<span className="text-[9px] text-zinc-600 font-mono">{timeStr}</span>
											</div>

											{/* Message Body */}
											<div className={cn(
												"px-4 py-2.5 text-sm rounded-none border leading-relaxed break-words text-start w-full",
												isSelf 
													? "bg-indigo-650/10 border-indigo-500/30 text-zinc-150" 
													: "bg-zinc-900/60 border-zinc-800 text-zinc-300"
											)}>
												{msg.content}
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
