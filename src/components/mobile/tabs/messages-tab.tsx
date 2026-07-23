'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
	ArrowLeft,
	ChevronRight,
	Copy,
	FileText,
	Image as ImageIcon,
	Lock,
	MessagesSquare,
	Paperclip,
	Pencil,
	Reply,
	Search,
	Send,
	Trash2,
	Video,
	X,
} from 'lucide-react';
import { ChatAvatar } from '@/components/ui/chat-avatar';
import {
	apiDelete,
	apiGet,
	apiPatch,
	apiPost,
	employeeDisplayName,
} from '@/lib/mobile-api';
import { memberChatColor } from '@/lib/chat-member-color';
import { cn } from '@/lib/utils';

type Props = {
	employee: any;
	onChatOpenChange?: (open: boolean) => void;
	/** Incremented by shell on system back to leave an open chat. */
	closeChatSignal?: number;
};

const ALL_CHANNELS = ['public', 'marketing', 'technical', 'core'] as const;
const CHANNEL_COLORS: Record<string, string> = {
	public: '#059669',
	marketing: '#D97706',
	technical: '#0284C7',
	core: '#7C3AED',
};
const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;
const EDIT_MS = 10 * 60 * 1000;
const MAX_ATTACH = 10 * 1024 * 1024;

type Person = {
	id: string;
	name: string;
	email?: string;
	role?: string;
	wingName?: string;
	hasPhoto?: boolean;
};

type Thread = {
	peerId: string;
	lastMessage?: string;
	peer?: Person & { photoUrl?: string | null };
};

type Reaction = { emoji?: string; userId?: string; userName?: string };

type Msg = {
	id: string;
	content?: string;
	senderId?: string;
	senderName?: string;
	createdAt?: string;
	editedAt?: string | null;
	attachmentType?: string | null;
	attachmentUrl?: string | null;
	attachmentName?: string | null;
	replyPreview?: string | null;
	replyToId?: string | null;
	reactions?: Reaction[];
};

function labelChannel(c: string) {
	return c.charAt(0).toUpperCase() + c.slice(1);
}

function formatTime(iso?: string) {
	if (!iso) return '';
	try {
		const d = new Date(iso);
		return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	} catch {
		return '';
	}
}

function fileToDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result || ''));
		reader.onerror = () => reject(new Error('Could not read file'));
		reader.readAsDataURL(file);
	});
}

/** Flutter MessagesTab parity: lists + chat with long-press actions & attach. */
export function MobileMessagesTab({ employee, onChatOpenChange, closeChatSignal = 0 }: Props) {
	const myId = String(employee?.id || '');
	const myName = employeeDisplayName(employee);

	const [topTab, setTopTab] = useState<0 | 1>(0);
	const [unlocked, setUnlocked] = useState<string[]>(['public']);
	const [channelsReady, setChannelsReady] = useState(false);

	const [threads, setThreads] = useState<Thread[]>([]);
	const [people, setPeople] = useState<Person[]>([]);
	const [directReady, setDirectReady] = useState(false);
	const [search, setSearch] = useState('');

	const [inChannelChat, setInChannelChat] = useState(false);
	const [channel, setChannel] = useState('public');
	const [dmPeerId, setDmPeerId] = useState<string | null>(null);
	const [dmPeerName, setDmPeerName] = useState<string | null>(null);
	const [dmPeerHasPhoto, setDmPeerHasPhoto] = useState(true);

	const [messages, setMessages] = useState<Msg[]>([]);
	const [msgLoading, setMsgLoading] = useState(false);
	const [sending, setSending] = useState(false);
	const [draft, setDraft] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [toast, setToast] = useState<string | null>(null);

	const [actionMsg, setActionMsg] = useState<Msg | null>(null);
	const [replyingTo, setReplyingTo] = useState<Msg | null>(null);
	const [attachOpen, setAttachOpen] = useState(false);
	const [editOpen, setEditOpen] = useState(false);
	const [editText, setEditText] = useState('');

	const listRef = useRef<HTMLDivElement>(null);
	const fileRef = useRef<HTMLInputElement>(null);
	const fileAccept = useRef('image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt');
	const inDm = Boolean(dmPeerId);
	const inChat = inChannelChat || inDm;

	const setChatOpen = useCallback(
		(open: boolean) => onChatOpenChange?.(open),
		[onChatOpenChange],
	);

	const showToast = (t: string) => {
		setToast(t);
		window.setTimeout(() => setToast(null), 2500);
	};

	const isMine = (m: Msg) => String(m.senderId || '') === myId;
	const canEdit = (m: Msg) => {
		if (!isMine(m) || !m.createdAt) return false;
		try {
			return Date.now() - new Date(m.createdAt).getTime() <= EDIT_MS;
		} catch {
			return false;
		}
	};

	const loadChannels = useCallback(async () => {
		try {
			const data = await apiGet<{ channels?: string[] }>('/api/messages/channels');
			const list = Array.isArray(data.channels) ? data.channels.map(String) : ['public'];
			setUnlocked(list.length ? list : ['public']);
		} catch {
			setUnlocked(['public']);
		} finally {
			setChannelsReady(true);
		}
	}, []);

	const loadDirect = useCallback(async () => {
		try {
			const [dms, dir] = await Promise.all([
				apiGet<{ threads?: Thread[] }>('/api/messages/dms'),
				apiGet<{ people?: Person[] }>('/api/messages/directory'),
			]);
			setThreads(Array.isArray(dms.threads) ? dms.threads : []);
			setPeople(Array.isArray(dir.people) ? dir.people : []);
			setDirectReady(true);
		} catch (e: any) {
			setError(e?.message || 'Failed to load directory');
			setDirectReady(true);
		}
	}, []);

	useEffect(() => {
		void loadChannels();
		void loadDirect();
	}, [loadChannels, loadDirect]);

	const reloadChat = useCallback(async () => {
		if (dmPeerId) {
			const data = await apiGet<{ messages?: Msg[] }>(
				`/api/messages?peerId=${encodeURIComponent(dmPeerId)}`,
			);
			const next = Array.isArray(data.messages) ? data.messages : [];
			setMessages((prev) => {
				if (prev.length === next.length && prev[prev.length - 1]?.id === next[next.length - 1]?.id) {
					return prev;
				}
				return next;
			});
		} else if (inChannelChat) {
			const data = await apiGet<{ messages?: Msg[] }>(
				`/api/messages?channel=${encodeURIComponent(channel)}`,
			);
			const next = Array.isArray(data.messages) ? data.messages : [];
			setMessages((prev) => {
				if (prev.length === next.length && prev[prev.length - 1]?.id === next[next.length - 1]?.id) {
					return prev;
				}
				return next;
			});
		}
	}, [dmPeerId, inChannelChat, channel]);

	useEffect(() => {
		if (!inChat) return;
		const el = listRef.current;
		if (!el) return;
		const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
		if (nearBottom) el.scrollTop = el.scrollHeight;
	}, [messages, inChat]);

	/** Pull new messages from server while chat is open (FCM is for background alerts). */
	useEffect(() => {
		if (!inChat) return;
		let alive = true;
		const tick = async () => {
			if (!alive) return;
			try {
				await reloadChat();
			} catch {
				/* ignore */
			}
		};
		const id = window.setInterval(() => void tick(), 4000);
		return () => {
			alive = false;
			window.clearInterval(id);
		};
	}, [inChat, reloadChat]);

	const closeChat = () => {
		setInChannelChat(false);
		setDmPeerId(null);
		setDmPeerName(null);
		setMessages([]);
		setError(null);
		setDraft('');
		setReplyingTo(null);
		setActionMsg(null);
		setChatOpen(false);
	};

	useEffect(() => {
		if (!closeChatSignal) return;
		closeChat();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [closeChatSignal]);

	const openChannel = async (c: string) => {
		if (!unlocked.includes(c)) {
			try {
				await apiPost('/api/permissions/channel-request', { channel: c });
				showToast(`Access requested for #${c}`);
			} catch (e: any) {
				showToast(e?.message || 'Request failed');
			}
			return;
		}
		setChannel(c);
		setInChannelChat(true);
		setDmPeerId(null);
		setDmPeerName(null);
		setChatOpen(true);
		setMsgLoading(true);
		setError(null);
		try {
			const data = await apiGet<{ messages?: Msg[] }>(
				`/api/messages?channel=${encodeURIComponent(c)}`,
			);
			setMessages(Array.isArray(data.messages) ? data.messages : []);
		} catch (e: any) {
			setError(e?.message || 'Failed to load messages');
			setMessages([]);
		} finally {
			setMsgLoading(false);
		}
	};

	const openDm = async (peerId: string, name?: string, hasPhoto = true) => {
		setDmPeerId(peerId);
		setDmPeerName(name || 'Chat');
		setDmPeerHasPhoto(hasPhoto);
		setInChannelChat(false);
		setChatOpen(true);
		setMsgLoading(true);
		setError(null);
		try {
			const data = await apiGet<{ messages?: Msg[]; peer?: Person }>(
				`/api/messages?peerId=${encodeURIComponent(peerId)}`,
			);
			setMessages(Array.isArray(data.messages) ? data.messages : []);
			if (data.peer?.name) setDmPeerName(data.peer.name);
		} catch (e: any) {
			setError(e?.message || 'Failed to open chat');
			setMessages([]);
		} finally {
			setMsgLoading(false);
		}
	};

	const send = async (extra?: {
		attachmentUrl?: string;
		attachmentType?: string;
		attachmentName?: string;
	}) => {
		const text = draft.trim();
		const hasAttach = Boolean(extra?.attachmentUrl);
		if ((!text && !hasAttach) || sending) return;
		const reply = replyingTo;
		setSending(true);
		const keptReply = reply;
		setReplyingTo(null);
		if (!hasAttach) setDraft('');
		try {
			const body: Record<string, unknown> = {
				content: text,
				...(inDm ? { peerId: dmPeerId } : { channel }),
				...(extra || {}),
				...(reply
					? {
							replyToId: reply.id,
							replyPreview:
								(reply.content || '').trim() ||
								reply.attachmentName ||
								'Attachment',
						}
					: {}),
			};
			const res = await apiPost<{ message?: Msg }>('/api/messages', body);
			if (res.message) setMessages((prev) => [...prev, res.message!]);
		} catch (e: any) {
			setReplyingTo(keptReply);
			if (!hasAttach) setDraft(text);
			showToast(e?.message || 'Send failed');
		} finally {
			setSending(false);
		}
	};

	const react = async (id: string, emoji: string) => {
		try {
			await apiPost(`/api/messages/${encodeURIComponent(id)}/react`, { emoji });
			await reloadChat();
		} catch (e: any) {
			showToast(e?.message || 'Reaction failed');
		}
	};

	const deleteMsg = async (m: Msg) => {
		if (!window.confirm('Delete message? This removes it for everyone.')) return;
		try {
			await apiDelete(`/api/messages/${encodeURIComponent(m.id)}`);
			setMessages((prev) => prev.filter((x) => x.id !== m.id));
			showToast('Deleted');
		} catch (e: any) {
			showToast(e?.message || 'Delete failed');
		}
	};

	const saveEdit = async () => {
		if (!actionMsg || !editText.trim()) return;
		try {
			const res = await apiPatch<{ message?: Msg }>(
				`/api/messages/${encodeURIComponent(actionMsg.id)}`,
				{ content: editText.trim() },
			);
			if (res.message) {
				setMessages((prev) => prev.map((x) => (x.id === actionMsg.id ? res.message! : x)));
			} else {
				await reloadChat();
			}
			setEditOpen(false);
			setActionMsg(null);
			showToast('Edited');
		} catch (e: any) {
			showToast(e?.message || 'Edit failed');
		}
	};

	const onPickFile = async (file: File | null) => {
		if (!file) return;
		if (file.size > MAX_ATTACH) {
			showToast('File too large. Keep under 10 MB.');
			return;
		}
		const mime = file.type || 'application/octet-stream';
		const type = mime.startsWith('image/')
			? 'image'
			: mime.startsWith('video/')
				? 'video'
				: 'file';
		try {
			const dataUrl = await fileToDataUrl(file);
			await send({
				attachmentUrl: dataUrl,
				attachmentType: type,
				attachmentName: file.name,
			});
		} catch (e: any) {
			showToast(e?.message || 'Upload failed');
		}
	};

	const title = inDm
		? dmPeerName || 'Chat'
		: inChannelChat
			? `#${labelChannel(channel)}`
			: 'Messages';

	const q = search.trim().toLowerCase();
	const filteredPeople = people.filter((p) => {
		if (p.id === myId) return false;
		if (!q) return true;
		return (
			p.name?.toLowerCase().includes(q) ||
			p.email?.toLowerCase().includes(q) ||
			p.role?.toLowerCase().includes(q)
		);
	});
	const threadIds = new Set(threads.map((t) => t.peerId));

	return (
		<div className="flex h-full min-h-0 flex-col bg-[#F0F3FF]">
			<input
				ref={fileRef}
				type="file"
				className="hidden"
				accept={fileAccept.current}
				onChange={(e) => {
					const f = e.target.files?.[0] || null;
					e.target.value = '';
					void onPickFile(f);
				}}
			/>

			<div className="shrink-0 border-b border-[#E2E8F0] bg-white px-2 pb-2.5 pt-2">
				<div className="flex items-center gap-1">
					{inChat ? (
						<button
							type="button"
							onClick={closeChat}
							className="flex size-10 items-center justify-center rounded-full text-[#0F172A]"
							aria-label="Back"
						>
							<ArrowLeft className="size-6" strokeWidth={2.2} />
						</button>
					) : (
						<div className="w-2" />
					)}
					{inDm ? (
						<>
							<ChatAvatar
								id={dmPeerId}
								name={dmPeerName || 'Chat'}
								hasPhoto={dmPeerHasPhoto}
								size={36}
							/>
							<span className="w-2.5" />
						</>
					) : null}
					<p className="min-w-0 flex-1 truncate text-[17px] font-extrabold text-[#0F172A]">
						{title}
					</p>
				</div>

				{!inChat ? (
					<div className="mx-2 mt-1 flex rounded-full border border-[#E2E8F0] bg-[#F0F3FF] p-1">
						<button
							type="button"
							onClick={() => setTopTab(0)}
							className={cn(
								'flex-1 rounded-full py-2.5 text-[13.5px] font-bold transition-colors',
								topTab === 0 ? 'bg-[#0047FF] text-white' : 'text-[#64748B]',
							)}
						>
							All
						</button>
						<button
							type="button"
							onClick={() => {
								setTopTab(1);
								void loadDirect();
							}}
							className={cn(
								'flex-1 rounded-full py-2.5 text-[13.5px] font-bold transition-colors',
								topTab === 1 ? 'bg-[#0047FF] text-white' : 'text-[#64748B]',
							)}
						>
							Direct
						</button>
					</div>
				) : null}
			</div>

			{toast ? (
				<div className="bg-[#0047FF] px-3 py-2 text-center text-xs font-semibold text-white">
					{toast}
				</div>
			) : null}

			{!inChat && topTab === 0 ? (
				!channelsReady ? (
					<div className="h-0.5 animate-pulse bg-[#0047FF]/40" />
				) : (
					<div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(172px+env(safe-area-inset-bottom,0px))] pt-3.5">
						<p className="mb-2.5 pl-1 text-xs font-bold tracking-[0.4px] text-[#64748B]">
							Channels
						</p>
						{ALL_CHANNELS.map((c) => {
							const color = CHANNEL_COLORS[c];
							const open = unlocked.includes(c);
							return (
								<button
									key={c}
									type="button"
									onClick={() => void openChannel(c)}
									className="mb-2.5 flex w-full items-center gap-3 rounded-[14px] border border-[#E2E8F0] bg-white px-3.5 py-3.5 text-left"
								>
									<span
										className="flex size-[42px] items-center justify-center rounded-xl text-lg font-black"
										style={{ backgroundColor: `${color}1F`, color }}
									>
										#
									</span>
									<span className="min-w-0 flex-1">
										<span className="block text-[15.5px] font-extrabold text-[#0F172A]">
											{labelChannel(c)}
										</span>
										<span className="block text-xs" style={{ color: open ? '#64748B' : color }}>
											{open ? 'Open channel' : 'Locked · tap to request access'}
										</span>
									</span>
									{open ? (
										<ChevronRight className="size-[22px] text-[#94A3B8]" />
									) : (
										<Lock className="size-5 text-[#94A3B8]" />
									)}
								</button>
							);
						})}
					</div>
				)
			) : null}

			{!inChat && topTab === 1 ? (
				!directReady ? (
					<div className="h-0.5 animate-pulse bg-[#0047FF]/40" />
				) : (
					<div className="flex min-h-0 flex-1 flex-col">
						<div className="px-4 pb-2 pt-3">
							<div className="flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5">
								<Search className="size-5 text-[#94A3B8]" />
								<input
									value={search}
									onChange={(e) => setSearch(e.target.value)}
									placeholder="Search colleagues…"
									className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#94A3B8]"
								/>
							</div>
						</div>
						<div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(172px+env(safe-area-inset-bottom,0px))]">
							{threads.length === 0 ? (
								<div className="mb-3.5 rounded-[14px] bg-[#E8EFFF] p-4 text-[13px] font-semibold leading-snug text-[#0F172A]">
									No direct messages yet. Tap a colleague below to start chatting.
								</div>
							) : (
								<>
									<p className="mb-1 pl-1 text-[11px] font-bold tracking-[0.8px] text-[#64748B]">
										RECENT
									</p>
									{threads.map((t) => (
										<PersonRow
											key={t.peerId}
											id={t.peerId}
											name={t.peer?.name || 'Colleague'}
											subtitle={t.lastMessage || ''}
											role={t.peer?.role}
											wing={t.peer?.wingName}
											hasPhoto={t.peer?.hasPhoto !== false}
											onClick={() =>
												void openDm(t.peerId, t.peer?.name, t.peer?.hasPhoto !== false)
											}
										/>
									))}
									<div className="h-3" />
								</>
							)}
							<p className="mb-1 pl-1 text-[11px] font-bold tracking-[0.8px] text-[#64748B]">
								ALL COLLEAGUES
							</p>
							{filteredPeople
								.filter((p) => !threadIds.has(p.id))
								.map((p) => (
									<PersonRow
										key={p.id}
										id={p.id}
										name={p.name}
										subtitle={p.email || ''}
										role={p.role}
										wing={p.wingName}
										hasPhoto={p.hasPhoto !== false}
										onClick={() => void openDm(p.id, p.name, p.hasPhoto !== false)}
									/>
								))}
						</div>
					</div>
				)
			) : null}

			{inChat ? (
				<>
					<div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5">
						{msgLoading ? (
							<div className="flex justify-center py-16">
								<div className="size-6 animate-spin rounded-full border-2 border-[#0047FF] border-t-transparent" />
							</div>
						) : error ? (
							<p className="px-4 py-10 text-center text-sm text-[#B42318]">{error}</p>
						) : messages.length === 0 ? (
							<div className="flex flex-col items-center justify-center px-8 py-20 text-center">
								<div className="flex size-[72px] items-center justify-center rounded-[20px] bg-[#E8EFFF] text-[#0047FF]">
									<MessagesSquare className="size-9" strokeWidth={1.8} />
								</div>
								<p className="mt-4 text-[17px] font-bold text-[#0F172A]">No messages yet</p>
								<p className="mt-1.5 max-w-[260px] text-[13.5px] font-medium leading-snug text-[#64748B]">
									Say hello — your first message starts this conversation.
								</p>
							</div>
						) : (
							messages.map((m) => {
								const mine = isMine(m);
								const color = memberChatColor(m.senderId || m.senderName);
								const counts: Record<string, number> = {};
								for (const r of m.reactions || []) {
									const e = String(r.emoji || '');
									if (e) counts[e] = (counts[e] || 0) + 1;
								}
								return (
									<div
										key={m.id}
										className={cn(
											'mb-2 flex items-end gap-2',
											mine ? 'flex-row-reverse' : 'flex-row',
										)}
									>
										<ChatAvatar
											id={mine ? myId : m.senderId}
											name={mine ? myName : m.senderName || '?'}
											photoUrl={mine ? employee?.photoUrl : undefined}
											hasPhoto
											size={28}
										/>
										<div
											className={cn(
												'flex max-w-[78%] flex-col',
												mine ? 'items-end' : 'items-start',
											)}
										>
											{!mine && !inDm ? (
												<p
													className="mb-0.5 px-1 text-[11px] font-bold"
													style={{ color: color.bg }}
												>
													{m.senderName}
												</p>
											) : null}
											<button
												type="button"
												onContextMenu={(e) => {
													e.preventDefault();
													setActionMsg(m);
												}}
												onTouchStart={(e) => {
													const t = window.setTimeout(() => setActionMsg(m), 480);
													const clear = () => window.clearTimeout(t);
													e.currentTarget.addEventListener('touchend', clear, { once: true });
													e.currentTarget.addEventListener('touchmove', clear, { once: true });
												}}
												className="w-fit max-w-full rounded-[14px] px-3 py-[9px] text-left"
												style={{
													backgroundColor: color.bg,
													color: color.fg,
													borderBottomRightRadius: mine ? 4 : 14,
													borderBottomLeftRadius: mine ? 14 : 4,
												}}
											>
												{m.replyPreview ? (
													<p className="mb-1.5 rounded-lg border-l-[3px] border-current/40 bg-black/10 px-2 py-1.5 text-[12px] opacity-90">
														{m.replyPreview}
													</p>
												) : null}
												{m.attachmentType === 'image' && m.attachmentUrl ? (
													// eslint-disable-next-line @next/next/no-img-element
													<img
														src={m.attachmentUrl}
														alt=""
														className="mb-1.5 max-h-48 max-w-[220px] rounded-[10px] object-cover"
													/>
												) : null}
												{m.attachmentType &&
												m.attachmentType !== 'image' &&
												m.attachmentUrl ? (
													<a
														href={m.attachmentUrl}
														download={m.attachmentName || 'file'}
														className="mb-1.5 flex max-w-[220px] items-center gap-2 rounded-[10px] bg-black/10 px-2.5 py-2 text-[13px] font-bold"
														onClick={(e) => e.stopPropagation()}
													>
														{m.attachmentType === 'video' ? (
															<Video className="size-4 shrink-0" />
														) : (
															<FileText className="size-4 shrink-0" />
														)}
														<span className="truncate">{m.attachmentName || 'Attachment'}</span>
													</a>
												) : null}
												{m.content ? (
													<p className="whitespace-pre-wrap break-words text-sm font-normal leading-[1.4]">
														{m.content}
													</p>
												) : null}
											</button>
											{Object.keys(counts).length > 0 ? (
												<div
													className={cn(
														'mt-1 flex flex-wrap gap-1',
														mine ? 'justify-end' : 'justify-start',
													)}
												>
													{Object.entries(counts).map(([emoji, n]) => (
														<button
															key={emoji}
															type="button"
															onClick={() => void react(m.id, emoji)}
															className="rounded-full bg-white px-1.5 py-0.5 text-xs shadow-sm ring-1 ring-[#E2E8F0]"
														>
															{emoji}
															{n > 1 ? ` ${n}` : ''}
														</button>
													))}
												</div>
											) : null}
											<p className="mt-0.5 px-1 text-[10px] text-[#64748B]">
												{formatTime(m.createdAt)}
												{m.editedAt ? ' · edited' : ''}
											</p>
										</div>
									</div>
								);
							})
						)}
					</div>

					<div className="shrink-0 border-t border-[#E2E8F0] bg-white px-2 py-2 pb-[max(8px,env(safe-area-inset-bottom))]">
						{replyingTo ? (
							<div className="mb-2 flex items-center gap-2 rounded-xl border-l-[3px] border-[#0047FF] bg-[#F0F3FF] px-3 py-2">
								<div className="min-w-0 flex-1">
									<p className="text-[11px] font-extrabold text-[#0047FF]">
										Replying to {replyingTo.senderName || 'message'}
									</p>
									<p className="truncate text-xs text-[#64748B]">
										{replyingTo.content || replyingTo.attachmentName || 'Attachment'}
									</p>
								</div>
								<button type="button" onClick={() => setReplyingTo(null)} aria-label="Cancel reply">
									<X className="size-4 text-[#64748B]" />
								</button>
							</div>
						) : null}
						<form
							className="flex items-end gap-1.5"
							onSubmit={(e) => {
								e.preventDefault();
								void send();
							}}
						>
							<button
								type="button"
								disabled={sending}
								onClick={() => setAttachOpen(true)}
								className="flex size-11 shrink-0 items-center justify-center text-[#0047FF]"
								aria-label="Attach"
							>
								<Paperclip className="size-5" />
							</button>
							<input
								value={draft}
								onChange={(e) => setDraft(e.target.value)}
								placeholder={inDm ? 'Type a message…' : `Message #${channel}…`}
								className="min-w-0 flex-1 rounded-[22px] bg-[#F0F3FF] px-4 py-2.5 text-sm outline-none"
							/>
							<button
								type="submit"
								disabled={sending || !draft.trim()}
								className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#0047FF] text-white disabled:bg-[#94A3B8]"
								aria-label="Send"
							>
								<Send className="size-5" />
							</button>
						</form>
					</div>
				</>
			) : null}

			{/* Long-press / context actions — Flutter parity */}
			{actionMsg && !editOpen ? (
				<div
					className="fixed inset-0 z-[90] flex items-end bg-black/40"
					onClick={() => setActionMsg(null)}
				>
					<div
						className="w-full rounded-t-2xl bg-white px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="mx-auto mb-3 h-1 w-9 rounded-full bg-[#E2E8F0]" />
						<div className="mb-2 flex justify-evenly">
							{QUICK_EMOJIS.map((e) => (
								<button
									key={e}
									type="button"
									className="rounded-full p-2 text-[26px] active:bg-[#F0F3FF]"
									onClick={() => {
										const id = actionMsg.id;
										setActionMsg(null);
										void react(id, e);
									}}
								>
									{e}
								</button>
							))}
						</div>
						<button
							type="button"
							className="flex w-full items-center gap-3 px-1 py-3 text-left"
							onClick={() => {
								setReplyingTo(actionMsg);
								setActionMsg(null);
							}}
						>
							<Reply className="size-5 text-[#0F172A]" />
							<span className="font-bold">Reply</span>
						</button>
						{isMine(actionMsg) ? (
							<button
								type="button"
								className="flex w-full items-center gap-3 px-1 py-3 text-left text-[#B42318]"
								onClick={() => {
									const m = actionMsg;
									setActionMsg(null);
									void deleteMsg(m);
								}}
							>
								<Trash2 className="size-5" />
								<span>
									<span className="block font-bold">Delete</span>
									<span className="text-xs font-medium text-[#B42318]/80">
										Remove this message for everyone
									</span>
								</span>
							</button>
						) : null}
						<button
							type="button"
							className="flex w-full items-center gap-3 px-1 py-3 text-left"
							onClick={async () => {
								const text = actionMsg.content || '';
								try {
									await navigator.clipboard.writeText(text);
									showToast('Copied');
								} catch {
									showToast('Could not copy');
								}
								setActionMsg(null);
							}}
						>
							<Copy className="size-5" />
							<span className="font-bold">Copy</span>
						</button>
						{canEdit(actionMsg) ? (
							<button
								type="button"
								className="flex w-full items-center gap-3 px-1 py-3 text-left"
								onClick={() => {
									setEditText(actionMsg.content || '');
									setEditOpen(true);
								}}
							>
								<Pencil className="size-5" />
								<span>
									<span className="block font-bold">Edit</span>
									<span className="text-xs font-medium text-[#64748B]">
										Only within 10 minutes
									</span>
								</span>
							</button>
						) : null}
					</div>
				</div>
			) : null}

			{editOpen && actionMsg ? (
				<div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/45 px-4">
					<div className="w-full max-w-sm rounded-2xl bg-white p-4">
						<p className="text-base font-extrabold">Edit message</p>
						<p className="mt-1 text-xs text-[#64748B]">Only within 10 minutes of sending</p>
						<textarea
							value={editText}
							onChange={(e) => setEditText(e.target.value)}
							rows={4}
							className="mt-3 w-full rounded-xl border border-[#E2E8F0] bg-[#F0F3FF] p-3 text-sm outline-none"
						/>
						<div className="mt-3 flex gap-2">
							<button
								type="button"
								className="flex-1 rounded-xl border border-[#E2E8F0] py-2.5 text-sm font-semibold"
								onClick={() => {
									setEditOpen(false);
									setActionMsg(null);
								}}
							>
								Cancel
							</button>
							<button
								type="button"
								className="flex-1 rounded-xl bg-[#0047FF] py-2.5 text-sm font-semibold text-white"
								onClick={() => void saveEdit()}
							>
								Save
							</button>
						</div>
					</div>
				</div>
			) : null}

			{attachOpen ? (
				<div
					className="fixed inset-0 z-[90] flex items-end bg-black/40"
					onClick={() => setAttachOpen(false)}
				>
					<div
						className="w-full rounded-t-2xl bg-white px-2 pb-[max(16px,env(safe-area-inset-bottom))] pt-3"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="mx-auto mb-2 h-1 w-9 rounded-full bg-[#E2E8F0]" />
						<p className="mb-2 text-center text-base font-extrabold">Share</p>
						<button
							type="button"
							className="flex w-full items-center gap-3 px-4 py-3 text-left"
							onClick={() => {
								setAttachOpen(false);
								fileAccept.current = 'image/*';
								if (fileRef.current) {
									fileRef.current.accept = 'image/*';
									fileRef.current.click();
								}
							}}
						>
							<span className="flex size-10 items-center justify-center rounded-full bg-[#E0F2FE] text-[#0284C7]">
								<ImageIcon className="size-5" />
							</span>
							<span>
								<span className="block font-bold">Photo</span>
								<span className="text-xs text-[#64748B]">Camera or gallery</span>
							</span>
						</button>
						<button
							type="button"
							className="flex w-full items-center gap-3 px-4 py-3 text-left"
							onClick={() => {
								setAttachOpen(false);
								fileAccept.current = 'video/*';
								if (fileRef.current) {
									fileRef.current.accept = 'video/*';
									fileRef.current.click();
								}
							}}
						>
							<span className="flex size-10 items-center justify-center rounded-full bg-[#FCE7F3] text-[#DB2777]">
								<Video className="size-5" />
							</span>
							<span>
								<span className="block font-bold">Video</span>
								<span className="text-xs text-[#64748B]">Clip up to 10 MB</span>
							</span>
						</button>
						<button
							type="button"
							className="flex w-full items-center gap-3 px-4 py-3 text-left"
							onClick={() => {
								setAttachOpen(false);
								fileAccept.current = '.pdf,.doc,.docx,.xls,.xlsx,.txt,application/*';
								if (fileRef.current) {
									fileRef.current.accept = fileAccept.current;
									fileRef.current.click();
								}
							}}
						>
							<span className="flex size-10 items-center justify-center rounded-full bg-[#ECFDF5] text-[#059669]">
								<FileText className="size-5" />
							</span>
							<span>
								<span className="block font-bold">Document</span>
								<span className="text-xs text-[#64748B]">PDF, DOC, sheets, and more</span>
							</span>
						</button>
					</div>
				</div>
			) : null}
		</div>
	);
}

function PersonRow({
	id,
	name,
	subtitle,
	role,
	wing,
	hasPhoto,
	onClick,
}: {
	id: string;
	name: string;
	subtitle: string;
	role?: string;
	wing?: string;
	hasPhoto?: boolean;
	onClick: () => void;
}) {
	const meta = [role, wing].filter(Boolean).join(' · ');
	return (
		<button
			type="button"
			onClick={onClick}
			className="mb-2.5 flex w-full items-center gap-3 rounded-[14px] border border-[#E2E8F0] bg-white px-3 py-3 text-left"
		>
			<ChatAvatar id={id} name={name} hasPhoto={hasPhoto !== false} size={44} />
			<span className="min-w-0 flex-1">
				<span className="block truncate text-[15px] font-extrabold text-[#0F172A]">{name}</span>
				{subtitle ? <span className="block truncate text-xs text-[#64748B]">{subtitle}</span> : null}
				{meta ? (
					<span className="mt-0.5 block truncate text-xs font-semibold text-[#0047FF]">{meta}</span>
				) : null}
			</span>
			<ChevronRight className="size-5 text-[#94A3B8]" />
		</button>
	);
}
