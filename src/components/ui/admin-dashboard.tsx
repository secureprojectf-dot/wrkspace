'use client';

import React, { useState, useEffect } from 'react';
import { Button } from './button';
import { Input } from './input';
import {
	Grid2x2PlusIcon,
	LogOutIcon,
	ServerIcon,
	LineChartIcon,
	UsersIcon,
	TerminalIcon,
	RefreshCwIcon,
	PackageIcon,
	CpuIcon,
	HistoryIcon,
	UserPlusIcon,
	PlusIcon,
} from 'lucide-react';
import { getLiveSystemStats, addEmployee, getEmployees, createTask, getTasks, getAllLeaves, updateLeaveStatus, getAllAttendance, createEvent, getEvents, getWorkSubmissions, updateSubmissionStatus, getLeads, updateLeadStatus, assignLead, deleteLead, bulkImportLeads, allowLead, triggerCrawl, allowAllLeads, deleteAllLeads, createManualLead, getAdminProfile, allocateAdmin, getAllAdmins, deleteAdmin } from '@/app/admin/actions';
import { CalendarIcon, MapPinIcon, FileTextIcon, CheckCircleIcon, XCircleIcon, ClockIcon, AlertCircleIcon, BarChart2Icon, UploadIcon, Trash2Icon, UserCheckIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MessagesView } from './messages-view';

interface AdminDashboardProps {
	email: string;
	onLogout: () => void;
}

type TabType = 'overview' | 'employees' | 'leaves' | 'attendance' | 'clients' | 'system_status' | 'messages' | 'task_allocation' | 'events' | 'work_submissions' | 'leads' | 'super_admin';

export function AdminDashboard({ email, onLogout }: AdminDashboardProps) {
	const [activeTab, setActiveTab] = useState<TabType>('overview');
	const isSuperAdmin = email.toLowerCase() === 'webstrixx@gmail.com';

	// Super Admin admin allocation states
	const [adminsList, setAdminsList] = useState<any[]>([]);
	const [newAdminEmail, setNewAdminEmail] = useState('');
	const [newAdminOrgName, setNewAdminOrgName] = useState('');
	const [newAdminPassword, setNewAdminPassword] = useState('admin123');
	const [newAdminPages, setNewAdminPages] = useState<string[]>([
		'overview', 'employees', 'task_allocation', 'attendance', 'leaves', 'clients', 'messages', 'system_status', 'events', 'work_submissions', 'leads'
	]);
	const [allocatedLink, setAllocatedLink] = useState<string | null>(null);
	const [isAllocating, setIsAllocating] = useState(false);
	const [superAdminMsg, setSuperAdminMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

	const [allowedTabs, setAllowedTabs] = useState<string[]>([]);
	const [organizationName, setOrganizationName] = useState('WrkSpace Headquarters');
	const [loadingProfile, setLoadingProfile] = useState(true);

	useEffect(() => {
		async function loadAdminProfile() {
			try {
				const res = await getAdminProfile(email);
				if (res.success && res.profile) {
					setOrganizationName(res.profile.organizationName || 'WrkSpace Headquarters');
					const pages = res.profile.allowedPages || '';
					const tabs = pages.split(',').map(t => t.trim()).filter(Boolean);
					setAllowedTabs(tabs);
					
					if (tabs.length > 0 && !tabs.includes(activeTab)) {
						setActiveTab(tabs[0] as TabType);
					}
				}
			} catch (e) {
				console.error(e);
			} finally {
				setLoadingProfile(false);
			}
		}
		loadAdminProfile();
	}, [email]);

	const fetchAdmins = async () => {
		try {
			const res = await getAllAdmins();
			if (res.success && res.admins) {
				setAdminsList(res.admins);
			}
		} catch (e) {
			console.error(e);
		}
	};

	const handleAllocateAdmin = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsAllocating(true);
		setSuperAdminMsg(null);
		setAllocatedLink(null);

		try {
			const res = await allocateAdmin({
				email: newAdminEmail,
				organizationName: newAdminOrgName,
				allowedPages: newAdminPages.join(','),
				password: newAdminPassword
			});

			if (res.success && res.admin) {
				setSuperAdminMsg({ type: 'success', text: 'Admin allocated successfully!' });
				const inviteUrl = `${window.location.origin}/admin?invite=${res.admin.inviteToken}`;
				setAllocatedLink(inviteUrl);
				setNewAdminEmail('');
				setNewAdminOrgName('');
				setNewAdminPassword('admin123');
				await fetchAdmins();
			} else {
				setSuperAdminMsg({ type: 'error', text: res.error || 'Failed to allocate admin.' });
			}
		} catch (err: any) {
			setSuperAdminMsg({ type: 'error', text: err.message || 'Error occurred.' });
		} finally {
			setIsAllocating(false);
		}
	};

	const handleDeleteAdmin = async (targetEmail: string) => {
		if (confirm(`Are you sure you want to delete admin account ${targetEmail}?`)) {
			const res = await deleteAdmin(targetEmail);
			if (res.success) {
				await fetchAdmins();
			} else {
				alert(res.error || 'Failed to delete admin.');
			}
		}
	};

	const togglePagePermission = (page: string) => {
		if (newAdminPages.includes(page)) {
			setNewAdminPages(newAdminPages.filter(p => p !== page));
		} else {
			setNewAdminPages([...newAdminPages, page]);
		}
	};
	const [stats, setStats] = useState<any>(null);
	const [isRefreshing, setIsRefreshing] = useState(false);

	// Employee Directory States
	const [employeesList, setEmployeesList] = useState<any[]>([]);
	const [showAddForm, setShowAddForm] = useState(false);
	const [firstName, setFirstName] = useState('');
	const [middleName, setMiddleName] = useState('');
	const [lastName, setLastName] = useState('');
	const [empEmail, setEmpEmail] = useState('');
	const [phone, setPhone] = useState('');
	const [wingName, setWingName] = useState('');
	const [wingLeadName, setWingLeadName] = useState('');
	const [empRole, setEmpRole] = useState('Employee');

	const [addMessage, setAddMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
	const [isAdding, setIsAdding] = useState(false);

	// Task Allocation States
	const [tasksList, setTasksList] = useState<any[]>([]);
	const [showTaskForm, setShowTaskForm] = useState(false);
	const [taskTitle, setTaskTitle] = useState('');
	const [taskDescription, setTaskDescription] = useState('');
	const [taskReportTo, setTaskReportTo] = useState('');
	const [taskAssigneeId, setTaskAssigneeId] = useState('');
	const [taskDeadline, setTaskDeadline] = useState('');
	const [taskStatus, setTaskStatus] = useState('Pending');
	const [taskMode, setTaskMode] = useState('Onsite');
	const [assignToAll, setAssignToAll] = useState(false);
	const [taskMessage, setTaskMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
	const [isAddingTask, setIsAddingTask] = useState(false);

	// Leaves Directory State
	const [leavesList, setLeavesList] = useState<any[]>([]);

	// Attendance Logs Directory State
	const [attendanceList, setAttendanceList] = useState<any[]>([]);

	// Events State
	const [eventsList, setEventsList] = useState<any[]>([]);
	const [showEventForm, setShowEventForm] = useState(false);
	const [eventTitle, setEventTitle] = useState('');
	const [eventDescription, setEventDescription] = useState('');
	const [eventCollege, setEventCollege] = useState('');
	const [eventStartDate, setEventStartDate] = useState('');
	const [eventEndDate, setEventEndDate] = useState('');
	const [eventStartTime, setEventStartTime] = useState('');
	const [eventEndTime, setEventEndTime] = useState('');
	const [eventVenue, setEventVenue] = useState('');
	const [eventReps, setEventReps] = useState<string[]>(['', '', '', '', '']);
	const [eventMessage, setEventMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
	const [isAddingEvent, setIsAddingEvent] = useState(false);

	const fetchStats = async () => {
		setIsRefreshing(true);
		try {
			const data = await getLiveSystemStats();
			setStats(data);
		} catch (error) {
			console.error('Failed to fetch system stats:', error);
		} finally {
			setIsRefreshing(false);
		}
	};

	const fetchEmployees = async () => {
		try {
			const data = await getEmployees();
			setEmployeesList(data);
		} catch (error) {
			console.error('Failed to fetch employee list:', error);
		}
	};

	const fetchTasks = async () => {
		try {
			const data = await getTasks();
			setTasksList(data);
		} catch (error) {
			console.error('Failed to fetch tasks:', error);
		}
	};

	const fetchLeaves = async () => {
		try {
			const data = await getAllLeaves();
			setLeavesList(data);
		} catch (error) {
			console.error('Failed to fetch leaves:', error);
		}
	};

	const fetchAttendance = async () => {
		try {
			const data = await getAllAttendance();
			setAttendanceList(data);
		} catch (error) {
			console.error('Failed to fetch attendance logs:', error);
		}
	};

	const fetchEvents = async () => {
		try {
			const data = await getEvents();
			setEventsList(data);
		} catch (error) {
			console.error('Failed to fetch events:', error);
		}
	};

	// Work Submissions State
	const [submissionsList, setSubmissionsList] = useState<any[]>([]);
	const [submissionFilter, setSubmissionFilter] = useState<string>('All');
	const [reviewingId, setReviewingId] = useState<string | null>(null);
	const [reviewNote, setReviewNote] = useState('');
	const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

	const fetchSubmissions = async () => {
		try {
			const data = await getWorkSubmissions();
			setSubmissionsList(data);
		} catch (error) {
			console.error('Failed to fetch work submissions:', error);
		}
	};

	const handleUpdateSubmission = async (id: string, status: string) => {
		setIsUpdatingStatus(true);
		const result = await updateSubmissionStatus(id, status, reviewNote || undefined);
		if (result.success) {
			setReviewingId(null);
			setReviewNote('');
			await fetchSubmissions();
		}
		setIsUpdatingStatus(false);
	};

	// Leads State
	const [leadsList, setLeadsList] = useState<any[]>([]);
	const [leadsFilter, setLeadsFilter] = useState('All');
	const [leadsSourceFilter, setLeadsSourceFilter] = useState('All');
	const [leadsSearch, setLeadsSearch] = useState('');
	const [assigningLeadId, setAssigningLeadId] = useState<string | null>(null);
	const [assignEmployeeId, setAssignEmployeeId] = useState('');
	const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
	const [importLoading, setImportLoading] = useState(false);
	const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);

	// Manual Leads sub-tab & form states (Admin view)
	const [leadsSubTab, setLeadsSubTab] = useState<'pipeline' | 'manual'>('pipeline');
	const [showManualForm, setShowManualForm] = useState(false);
	const [manualBizName, setManualBizName] = useState('');
	const [manualContact, setManualContact] = useState('');
	const [manualEmail, setManualEmail] = useState('');
	const [manualPhone, setManualPhone] = useState('');
	const [manualWeb, setManualWeb] = useState('');
	const [manualLoc, setManualLoc] = useState('');
	const [manualCat, setManualCat] = useState('');
	const [manualDesc, setManualDesc] = useState('');
	const [manualPriority, setManualPriority] = useState('Medium');
	const [manualNotes, setManualNotes] = useState('');
	const [manualAssignTo, setManualAssignTo] = useState('');
	const [isSavingManualLead, setIsSavingManualLead] = useState(false);
	const [manualLeadMsg, setManualLeadMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

	const handleCreateManualLead = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSavingManualLead(true);
		setManualLeadMsg(null);
		try {
			const result = await createManualLead({
				businessName: manualBizName,
				contactName: manualContact,
				email: manualEmail,
				phone: manualPhone,
				website: manualWeb,
				location: manualLoc,
				category: manualCat,
				description: manualDesc,
				priority: manualPriority,
				notes: manualNotes,
				assignedTo: manualAssignTo || undefined, // Admins can optionally assign a lead immediately
			});
			if (result.success) {
				setManualLeadMsg({ type: 'success', text: 'Lead manually created successfully!' });
				// Reset inputs
				setManualBizName('');
				setManualContact('');
				setManualEmail('');
				setManualPhone('');
				setManualWeb('');
				setManualLoc('');
				setManualCat('');
				setManualDesc('');
				setManualPriority('Medium');
				setManualNotes('');
				setManualAssignTo('');
				setShowManualForm(false);
				await fetchLeads();
			} else {
				setManualLeadMsg({ type: 'error', text: result.error || 'Failed to create lead.' });
			}
		} catch (err: any) {
			setManualLeadMsg({ type: 'error', text: err.message || 'Error occurred.' });
		} finally {
			setIsSavingManualLead(false);
		}
	};

	// Automated crawling form states
	const [crawlCity, setCrawlCity] = useState('Hyderabad');
	const [crawlCategory, setCrawlCategory] = useState('IT Services');
	const [isCrawling, setIsCrawling] = useState(false);
	const [crawlMessage, setCrawlMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

	const handleLeadCrawl = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsCrawling(true);
		setCrawlMessage(null);
		try {
			const result = await triggerCrawl(crawlCity, crawlCategory) as any;
			if (result.success) {
				setCrawlMessage({ type: 'success', text: `Crawl successful! Imported ${result.count} new leads.` });
				await fetchLeads();
			} else {
				setCrawlMessage({ type: 'error', text: result.error || 'Crawl failed.' });
			}
		} catch (err: any) {
			setCrawlMessage({ type: 'error', text: err.message || 'Crawl failed.' });
		} finally {
			setIsCrawling(false);
		}
	};

	const handleLeadAllowToggle = async (id: string, allowed: boolean) => {
		setUpdatingLeadId(id);
		await allowLead(id, allowed);
		await fetchLeads();
		setUpdatingLeadId(null);
	};

	const handleAllowAll = async (ids?: string[]) => {
		setIsCrawling(true);
		await allowAllLeads(ids);
		await fetchLeads();
		setIsCrawling(false);
	};

	const handleDeleteAll = async (ids?: string[]) => {
		if (confirm(`Are you sure you want to delete all ${ids ? ids.length : 'selected'} leads?`)) {
			setIsCrawling(true);
			await deleteAllLeads(ids);
			await fetchLeads();
			setIsCrawling(false);
		}
	};

	const fetchLeads = async () => {
		try {
			const data = await getLeads();
			setLeadsList(data);
		} catch (error) {
			console.error('Failed to fetch leads:', error);
		}
	};

	const handleLeadStatusUpdate = async (id: string, status: string) => {
		setUpdatingLeadId(id);
		await updateLeadStatus(id, status);
		await fetchLeads();
		setUpdatingLeadId(null);
	};

	const handleLeadAssign = async (id: string, empId: string) => {
		await assignLead(id, empId || '');
		setAssigningLeadId(null);
		setAssignEmployeeId('');
		await fetchLeads();
	};

	const handleLeadDelete = async (id: string) => {
		if (confirm('Are you sure you want to delete this lead?')) {
			await deleteLead(id);
			await fetchLeads();
		}
	};

	const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		setImportLoading(true);
		setImportMessage(null);
		try {
			const text = await file.text();
			const parsed = JSON.parse(text);
			const rawLeads = Array.isArray(parsed) ? parsed : parsed.leads ?? [];
			if (!rawLeads.length) {
				setImportMessage({ type: 'error', text: 'No leads found in the file.' });
				return;
			}
			const result = await bulkImportLeads(rawLeads);
			if (result.success) {
				setImportMessage({ type: 'success', text: `Successfully imported ${result.count} leads!` });
				await fetchLeads();
			} else {
				setImportMessage({ type: 'error', text: result.error || 'Import failed.' });
			}
		} catch (err: any) {
			setImportMessage({ type: 'error', text: `Parse error: ${err.message}` });
		} finally {
			setImportLoading(false);
			e.target.value = '';
		}
	};

	const handleCreateEvent = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsAddingEvent(true);
		setEventMessage(null);
		const filledReps = eventReps
			.map(r => r.trim())
			.filter(Boolean)
			.map(name => ({ id: name, name }));
		if (filledReps.length === 0) {
			setEventMessage({ type: 'error', text: 'Please add at least one company representative.' });
			setIsAddingEvent(false);
			return;
		}
		const result = await createEvent({
			title: eventTitle,
			description: eventDescription,
			organisingCollege: eventCollege,
			representatives: filledReps,
			startDate: eventStartDate,
			endDate: eventEndDate,
			startTime: eventStartTime,
			endTime: eventEndTime,
			venueAddress: eventVenue,
		});
		if (result.success) {
			setEventMessage({ type: 'success', text: 'Event created successfully.' });
			setEventTitle(''); setEventDescription(''); setEventCollege('');
			setEventStartDate(''); setEventEndDate(''); setEventStartTime(''); setEventEndTime('');
			setEventVenue(''); setEventReps(['', '', '', '', '']);
			setShowEventForm(false);
			fetchEvents();
		} else {
			setEventMessage({ type: 'error', text: result.error || 'Failed to create event.' });
		}
		setIsAddingEvent(false);
	};

	useEffect(() => {
		fetchStats();
		fetchEmployees();
		fetchTasks();
		fetchLeaves();
		fetchAttendance();
		fetchEvents();
		fetchSubmissions();
		fetchLeads();
		if (email.toLowerCase() === 'webstrixx@gmail.com') {
			fetchAdmins();
		}
		const interval = setInterval(fetchStats, 5000);
		return () => clearInterval(interval);
	}, [email]);

	const handleAddEmployee = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsAdding(true);
		setAddMessage(null);

		try {
			const result = await addEmployee({
				firstName,
				middleName,
				lastName,
				email: empEmail,
				phone,
				wingName,
				wingLeadName,
				role: empRole,
			});

			if (result.success && result.employee) {
				setAddMessage({
					type: 'success',
					text: `Employee successfully created! Generated 6-Digit ID: ${result.employee.id}`,
				});
				// Clear inputs
				setFirstName('');
				setMiddleName('');
				setLastName('');
				setEmpEmail('');
				setPhone('');
				setWingName('');
				setWingLeadName('');
				setEmpRole('Employee');

				// Refresh list
				await fetchEmployees();
			} else {
				setAddMessage({ type: 'error', text: 'Failed to add employee.' });
			}
		} catch (error) {
			setAddMessage({ type: 'error', text: 'An unexpected error occurred.' });
		} finally {
			setIsAdding(false);
		}
	};

	const handleCreateTask = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsAddingTask(true);
		setTaskMessage(null);

		let assigneeId = taskAssigneeId;
		let assigneeName = '';

		if (assignToAll) {
			assigneeId = 'ALL';
			assigneeName = 'All Employees';
		} else {
			if (!assigneeId) {
				setTaskMessage({ type: 'error', text: 'Please select an employee or check Assign to All.' });
				setIsAddingTask(false);
				return;
			}
			const selectedEmp = employeesList.find(emp => emp.id === assigneeId);
			assigneeName = selectedEmp ? `${selectedEmp.firstName} ${selectedEmp.lastName}` : assigneeId;
		}

		try {
			const result = await createTask({
				title: taskTitle,
				description: taskDescription,
				reportTo: taskReportTo,
				assigneeId,
				assigneeName,
				deadline: taskDeadline,
				status: taskStatus,
				mode: taskMode,
			});

			if (result.success && result.task) {
				setTaskMessage({
					type: 'success',
					text: `Task successfully allocated! ID: ${result.task.id}`,
				});
				// Clear inputs
				setTaskTitle('');
				setTaskDescription('');
				setTaskReportTo('');
				setTaskAssigneeId('');
				setTaskDeadline('');
				setTaskStatus('Pending');
				setTaskMode('Onsite');
				setAssignToAll(false);
				
				// Refresh list
				await fetchTasks();
			} else {
				setTaskMessage({ type: 'error', text: result.error || 'Failed to allocate task.' });
			}
		} catch (error) {
			setTaskMessage({ type: 'error', text: 'An unexpected error occurred.' });
		} finally {
			setIsAddingTask(false);
		}
	};

	if (!stats) {
		return (
			<main className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center space-y-4">
				<RefreshCwIcon className="size-8 text-indigo-500 animate-spin" />
				<p className="text-zinc-400 text-xs font-mono">Initializing live environment console...</p>
			</main>
		);
	}

	return (
		<main className={cn(
			"bg-zinc-950 text-white relative flex flex-col font-sans",
			activeTab === 'messages' ? "h-screen overflow-hidden" : "min-h-screen overflow-y-auto"
		)}>
			{/* Premium background radial glow */}
			<div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.03),transparent_70%)] z-0 pointer-events-none" />

			{/* Full Width Top Navbar (Window Edged, premium dusty black design) */}
			<header className="w-full border-b border-zinc-900 bg-zinc-950 sticky top-0 z-50 shadow-md shadow-black/40">
				<div className="w-full px-6 md:px-10 h-20 flex items-center justify-between">
					<div className="flex items-center gap-4">
						<img src="https://ik.imagekit.io/dypkhqxip/logogog" alt="WrkSpace Logo" className="h-8 w-auto object-contain" />
						<div className="w-px h-7 bg-zinc-800" />
						<div className="flex flex-col justify-center">
							<p className="text-[10px] text-brand-400 font-bold uppercase tracking-wider leading-none mb-0.5">{organizationName}</p>
							<p className="text-xs text-zinc-400 leading-tight">{email}</p>
						</div>
					</div>
					<div className="flex items-center gap-3">
						<button 
							onClick={fetchStats}
							disabled={isRefreshing}
							className="p-2.5 border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-850 hover:border-zinc-700 text-zinc-400 hover:text-white transition-all rounded-none cursor-pointer disabled:opacity-50"
							title="Refresh Stats"
						>
							<RefreshCwIcon className={`size-4 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
						</button>
						<Button 
							variant="outline" 
							className="border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:bg-zinc-800 hover:text-white hover:border-zinc-700 cursor-pointer rounded-none transition-all duration-200 text-xs py-2.5 px-4 h-auto font-medium"
							onClick={onLogout}
						>
							<LogOutIcon className="size-3.5 me-2 text-zinc-400" />
							Logout
						</Button>
					</div>
				</div>
			</header>

			{/* Full Width Subnavbar */}
			<div className="w-full border-b-2 border-brand-700 bg-brand-950 z-40 sticky top-20 shadow-lg shadow-brand-950/60" style={{backgroundImage: 'linear-gradient(180deg, #1a1040 0%, #0f0824 100%)'}}>
				<div className="w-full px-6 md:px-10 flex gap-6 text-xs md:text-sm font-medium tracking-wide overflow-x-auto">
					{(isSuperAdmin || allowedTabs.includes('overview')) && (
						<button
							onClick={() => setActiveTab('overview')}
							className={`py-3 border-b-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === 'overview' ? 'border-brand-400 text-white font-semibold' : 'border-transparent text-brand-300/60 hover:text-white'}`}
						>
							Overview
						</button>
					)}
					{(isSuperAdmin || allowedTabs.includes('employees')) && (
						<button
							onClick={() => setActiveTab('employees')}
							className={`py-3 border-b-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === 'employees' ? 'border-brand-400 text-white font-semibold' : 'border-transparent text-brand-300/60 hover:text-white'}`}
						>
							Employees
						</button>
					)}
					{(isSuperAdmin || allowedTabs.includes('task_allocation')) && (
						<button
							onClick={() => setActiveTab('task_allocation')}
							className={`py-3 border-b-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === 'task_allocation' ? 'border-brand-400 text-white font-semibold' : 'border-transparent text-brand-300/60 hover:text-white'}`}
						>
							Task/Work Allocation
						</button>
					)}
					{(isSuperAdmin || allowedTabs.includes('attendance')) && (
						<button
							onClick={() => {
								setActiveTab('attendance');
								fetchAttendance();
							}}
							className={`py-3 border-b-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === 'attendance' ? 'border-brand-400 text-white font-semibold' : 'border-transparent text-brand-300/60 hover:text-white'}`}
						>
							Attendance Logs
						</button>
					)}
					{(isSuperAdmin || allowedTabs.includes('leaves')) && (
						<button
							onClick={() => {
								setActiveTab('leaves');
								fetchLeaves();
							}}
							className={`py-3 border-b-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === 'leaves' ? 'border-brand-400 text-white font-semibold' : 'border-transparent text-brand-300/60 hover:text-white'}`}
						>
							Leaves
						</button>
					)}
					{(isSuperAdmin || allowedTabs.includes('clients')) && (
						<button
							onClick={() => setActiveTab('clients')}
							className={`py-3 border-b-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === 'clients' ? 'border-brand-400 text-white font-semibold' : 'border-transparent text-brand-300/60 hover:text-white'}`}
						>
							Clients
						</button>
					)}
					{(isSuperAdmin || allowedTabs.includes('messages')) && (
						<button
							onClick={() => setActiveTab('messages')}
							className={`py-3 border-b-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === 'messages' ? 'border-brand-400 text-white font-semibold' : 'border-transparent text-brand-300/60 hover:text-white'}`}
						>
							Messages
						</button>
					)}
					{(isSuperAdmin || allowedTabs.includes('system_status')) && (
						<button
							onClick={() => setActiveTab('system_status')}
							className={`py-3 border-b-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === 'system_status' ? 'border-brand-400 text-white font-semibold' : 'border-transparent text-brand-300/60 hover:text-white'}`}
						>
							System Status
						</button>
					)}
					{(isSuperAdmin || allowedTabs.includes('events')) && (
						<button
							onClick={() => { setActiveTab('events'); fetchEvents(); }}
							className={`py-3 border-b-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === 'events' ? 'border-brand-400 text-white font-semibold' : 'border-transparent text-brand-300/60 hover:text-white'}`}
						>
							Events
						</button>
					)}
					{(isSuperAdmin || allowedTabs.includes('work_submissions')) && (
						<button
							onClick={() => { setActiveTab('work_submissions'); fetchSubmissions(); }}
							className={`py-3 border-b-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === 'work_submissions' ? 'border-brand-400 text-white font-semibold' : 'border-transparent text-brand-300/60 hover:text-white'}`}
						>
							Work Submissions
						</button>
					)}
					{(isSuperAdmin || allowedTabs.includes('leads')) && (
						<button
							onClick={() => { setActiveTab('leads'); fetchLeads(); }}
							className={`py-3 border-b-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === 'leads' ? 'border-brand-400 text-white font-semibold' : 'border-transparent text-brand-300/60 hover:text-white'}`}
						>
							Leads
						</button>
					)}
					{isSuperAdmin && (
						<button
							onClick={() => { setActiveTab('super_admin'); fetchAdmins(); }}
							className={`py-3 border-b-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === 'super_admin' ? 'border-brand-400 text-white font-semibold' : 'border-transparent text-brand-300/60 hover:text-white'}`}
						>
							Super Admin
						</button>
					)}
				</div>
			</div>

			{/* Main Dashboard Content Area */}
			<div className={cn(
				"flex-1 w-full relative z-10",
				activeTab === 'messages' ? "h-[calc(100vh-128px)] flex flex-col" : "max-w-[90rem] mx-auto p-6 md:p-10 space-y-8"
			)}>

				{/* Tab content: Overview */}
				{activeTab === 'overview' && (
					<div className="space-y-8">
						{/* Stats Grid */}
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
							<div className="bg-zinc-900/30 border border-zinc-800/80 p-6 space-y-2 rounded-none">
								<div className="flex items-center justify-between text-zinc-400">
									<span className="text-xs font-semibold uppercase tracking-wider">Server Node</span>
									<ServerIcon className="size-4 text-emerald-400 animate-pulse" />
								</div>
								<p className="text-2xl font-bold text-white">{stats.serverStatus}</p>
								<p className="text-xs text-emerald-400 font-medium">Uptime: {stats.uptime}</p>
							</div>

							<div className="bg-zinc-900/30 border border-zinc-800/80 p-6 space-y-2 rounded-none">
								<div className="flex items-center justify-between text-zinc-400">
									<span className="text-xs font-semibold uppercase tracking-wider">Node Env</span>
									<CpuIcon className="size-4 text-indigo-400" />
								</div>
								<p className="text-2xl font-bold text-white capitalize">{stats.environment}</p>
								<p className="text-xs text-zinc-400 font-medium">Heap: {stats.heapMemory}</p>
							</div>

							<div className="bg-zinc-900/30 border border-zinc-800/80 p-6 space-y-2 rounded-none">
								<div className="flex items-center justify-between text-zinc-400">
									<span className="text-xs font-semibold uppercase tracking-wider">NPM Packages</span>
									<PackageIcon className="size-4 text-sky-400" />
								</div>
								<p className="text-2xl font-bold text-white">{stats.totalDependencies}</p>
								<p className="text-xs text-sky-400 font-medium">{stats.dependencies} prod, {stats.devDependencies} dev</p>
							</div>

							<div className="bg-zinc-900/30 border border-zinc-800/80 p-6 space-y-2 rounded-none">
								<div className="flex items-center justify-between text-zinc-400">
									<span className="text-xs font-semibold uppercase tracking-wider">Employees Registered</span>
									<UsersIcon className="size-4 text-zinc-400" />
								</div>
								<p className="text-2xl font-bold text-white">{employeesList.length}</p>
								<p className="text-xs text-zinc-400 font-medium">Active members</p>
							</div>
						</div>
					</div>
				)}

				{/* Tab content: Leaves */}
				{activeTab === 'leaves' && (
					<div className="bg-zinc-900/30 border border-zinc-800 p-6 space-y-4 rounded-none">
						<div className="flex justify-between items-center border-b border-zinc-800 pb-3">
							<h3 className="text-sm font-semibold text-white uppercase tracking-wider">
								Employee Leaves Directory
							</h3>
							<button 
								onClick={fetchLeaves}
								className="p-1 border border-zinc-800 bg-zinc-900/20 hover:bg-zinc-850 hover:border-zinc-700 text-zinc-400 hover:text-white transition-all rounded-none cursor-pointer"
							>
								<RefreshCwIcon className="size-3.5" />
							</button>
						</div>

						{leavesList.length === 0 ? (
							<div className="min-h-[200px] flex items-center justify-center text-zinc-500 italic text-sm">
								No leave requests have been logged in the system.
							</div>
						) : (
							<div className="overflow-x-auto border border-zinc-800 bg-zinc-950/20">
								<table className="w-full text-left text-xs border-collapse">
									<thead>
										<tr className="border-b border-zinc-800 text-zinc-400 uppercase font-mono text-[10px] tracking-wider bg-zinc-950/40">
											<th className="p-3">Employee</th>
											<th className="p-3">Leave Type</th>
											<th className="p-3">Period</th>
											<th className="p-3 font-sans">Reason Statement</th>
											<th className="p-3">Status</th>
											<th className="p-3 text-right">Actions</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-zinc-850/50 text-zinc-300">
										{leavesList.map((leave: any) => (
											<tr key={leave.id} className="hover:bg-zinc-900/10 transition-colors">
												<td className="p-3 font-semibold text-white">
													{leave.employeeName}
													<span className="block text-[10px] text-zinc-550 font-mono mt-0.5">{leave.employeeId}</span>
												</td>
												<td className="p-3 font-semibold text-zinc-300">{leave.type}</td>
												<td className="p-3 font-mono text-zinc-400 whitespace-nowrap">
													{new Date(leave.startDate).toLocaleDateString()} to {new Date(leave.endDate).toLocaleDateString()}
												</td>
												<td className="p-3 text-zinc-400 max-w-sm truncate" title={leave.reason}>
													{leave.reason}
												</td>
												<td className="p-3">
													<span className={cn(
														"px-2 py-0.5 text-[10px] font-bold border uppercase font-mono whitespace-nowrap",
														leave.status === 'Pending' && "bg-yellow-950/30 text-yellow-400 border-yellow-900/30",
														leave.status === 'Approved' && "bg-emerald-950/30 text-emerald-400 border-emerald-900/30",
														leave.status === 'Ignored' && "bg-zinc-900 text-zinc-400 border-zinc-800",
														leave.status === 'Cancelled' && "bg-red-950/30 text-red-400 border-red-900/30"
													)}>
														{leave.status}
													</span>
												</td>
												<td className="p-3 text-right whitespace-nowrap">
													{leave.status === 'Pending' ? (
														<div className="inline-flex gap-1.5">
															<button
																onClick={async () => {
																	try {
																		await updateLeaveStatus(leave.id, 'Approved');
																		fetchLeaves();
																	} catch (err) {
																		console.error("Failed to approve leave", err);
																	}
																}}
																className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[10px] uppercase py-1 px-2.5 rounded-none cursor-pointer transition-colors"
															>
																Approve
															</button>
															<button
																onClick={async () => {
																	try {
																		await updateLeaveStatus(leave.id, 'Ignored');
																		fetchLeaves();
																	} catch (err) {
																		console.error("Failed to ignore leave", err);
																	}
																}}
																className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 font-semibold text-[10px] uppercase py-1 px-2.5 rounded-none cursor-pointer transition-colors"
															>
																Ignore
															</button>
															<button
																onClick={async () => {
																	try {
																		await updateLeaveStatus(leave.id, 'Cancelled');
																		fetchLeaves();
																	} catch (err) {
																		console.error("Failed to cancel leave", err);
																	}
																}}
																className="bg-red-600 hover:bg-red-500 text-white font-semibold text-[10px] uppercase py-1 px-2.5 rounded-none cursor-pointer transition-colors"
															>
																Cancel
															</button>
														</div>
													) : (
														<span className="text-[10px] text-zinc-500 italic font-medium">Processed</span>
													)}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</div>
				)}

				{/* Tab content: Attendance Logs */}
				{activeTab === 'attendance' && (
					<div className="bg-zinc-900/30 border border-zinc-800 p-6 space-y-4 rounded-none">
						<div className="flex justify-between items-center border-b border-zinc-800 pb-3">
							<h3 className="text-sm font-semibold text-white uppercase tracking-wider">
								Employee Attendance Logs
							</h3>
							<button 
								onClick={fetchAttendance}
								className="p-1 border border-zinc-800 bg-zinc-900/20 hover:bg-zinc-850 hover:border-zinc-700 text-zinc-400 hover:text-white transition-all rounded-none cursor-pointer"
							>
								<RefreshCwIcon className="size-3.5" />
							</button>
						</div>

						{attendanceList.length === 0 ? (
							<div className="min-h-[200px] flex items-center justify-center text-zinc-500 italic text-sm">
								No attendance logs have been recorded in the database.
							</div>
						) : (
							<div className="overflow-x-auto border border-zinc-800 bg-zinc-950/20">
								<table className="w-full text-left text-xs border-collapse">
									<thead>
										<tr className="border-b border-zinc-800 text-zinc-400 uppercase font-mono text-[10px] tracking-wider bg-zinc-950/40">
											<th className="p-3">Employee</th>
											<th className="p-3">Date</th>
											<th className="p-3">Check-In Time</th>
											<th className="p-3">Check-Out Time</th>
											<th className="p-3">Status</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-zinc-800/50 text-zinc-300 font-mono">
										{attendanceList.map((log: any) => (
											<tr key={log.id} className="hover:bg-zinc-900/10 transition-colors">
												<td className="p-3 font-semibold text-white font-sans">
													{log.employeeName}
													<span className="block text-[10px] text-zinc-550 font-mono mt-0.5">{log.employeeId}</span>
												</td>
												<td className="p-3 text-zinc-300">{log.date}</td>
												<td className="p-3 text-zinc-400">{log.checkIn}</td>
												<td className="p-3 text-zinc-400">{log.checkOut || '--'}</td>
												<td className="p-3">
													<span className={cn(
														"px-2 py-0.5 text-[10px] font-bold border uppercase font-mono whitespace-nowrap",
														log.status === 'Checked In' && "bg-emerald-950/30 text-emerald-400 border-emerald-900/30",
														log.status === 'Present' && "bg-indigo-950/30 text-indigo-400 border-indigo-900/30"
													)}>
														{log.status}
													</span>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</div>
				)}

				{/* Tab content: Clients */}
				{activeTab === 'clients' && (
					<div className="bg-zinc-900/30 border border-zinc-800/80 p-6 space-y-4 rounded-none min-h-[200px] flex items-center justify-center text-zinc-500 italic text-sm">
						Clients panel is ready. Content will be added soon.
					</div>
				)}

				{/* Tab content: System Status */}
				{activeTab === 'system_status' && (
					<div className="space-y-8">
						{/* Stats Grid */}
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
							<div className="bg-zinc-900/30 border border-zinc-800/80 p-6 space-y-2 rounded-none">
								<div className="flex items-center justify-between text-zinc-400">
									<span className="text-xs font-semibold uppercase tracking-wider">Server Node</span>
									<ServerIcon className="size-4 text-emerald-400 animate-pulse" />
								</div>
								<p className="text-2xl font-bold text-white">{stats.serverStatus}</p>
								<p className="text-xs text-emerald-400 font-medium">Uptime: {stats.uptime}</p>
							</div>

							<div className="bg-zinc-900/30 border border-zinc-800/80 p-6 space-y-2 rounded-none">
								<div className="flex items-center justify-between text-zinc-400">
									<span className="text-xs font-semibold uppercase tracking-wider">Node Env</span>
									<CpuIcon className="size-4 text-indigo-400" />
								</div>
								<p className="text-2xl font-bold text-white capitalize">{stats.environment}</p>
								<p className="text-xs text-zinc-400 font-medium">Heap: {stats.heapMemory}</p>
							</div>

							<div className="bg-zinc-900/30 border border-zinc-800/80 p-6 space-y-2 rounded-none">
								<div className="flex items-center justify-between text-zinc-400">
									<span className="text-xs font-semibold uppercase tracking-wider">NPM Packages</span>
									<PackageIcon className="size-4 text-sky-400" />
								</div>
								<p className="text-2xl font-bold text-white">{stats.totalDependencies}</p>
								<p className="text-xs text-sky-400 font-medium">{stats.dependencies} prod, {stats.devDependencies} dev</p>
							</div>

							<div className="bg-zinc-900/30 border border-zinc-800/80 p-6 space-y-2 rounded-none">
								<div className="flex items-center justify-between text-zinc-400">
									<span className="text-xs font-semibold uppercase tracking-wider">Employees Registered</span>
									<UsersIcon className="size-4 text-zinc-400" />
								</div>
								<p className="text-2xl font-bold text-white">{employeesList.length}</p>
								<p className="text-xs text-zinc-400 font-medium">Active members</p>
							</div>
						</div>

						{/* Lifecycle Logs Table */}
						<div className="bg-zinc-900/30 border border-zinc-800/80 p-6 space-y-4 rounded-none">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<TerminalIcon className="size-4 text-indigo-400" />
									<h2 className="text-base font-bold text-white">System Lifecycle Logs</h2>
								</div>
								<span className="text-zinc-550 font-mono text-[10px]">Auto-updates every 5s • Last: {stats.timestamp}</span>
							</div>
							<div className="overflow-x-auto border border-zinc-800 bg-zinc-950/20">
								<table className="w-full text-left text-xs border-collapse">
									<thead>
										<tr className="border-b border-zinc-850 bg-zinc-950/60 text-zinc-400 font-mono">
											<th className="p-3 font-semibold uppercase tracking-wider">Event</th>
											<th className="p-3 font-semibold uppercase tracking-wider">Details</th>
											<th className="p-3 font-semibold uppercase tracking-wider text-right">Source / Timestamp</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-zinc-850/50 font-mono text-zinc-300">
										{stats.logEntries.map((log: any, idx: number) => (
											<tr key={idx} className="hover:bg-zinc-900/20 transition-colors">
												<td className="p-3 font-bold text-indigo-400 whitespace-nowrap">{log.event}</td>
												<td className="p-3 text-zinc-200">{log.details}</td>
												<td className="p-3 text-zinc-500 text-right text-[10px] whitespace-nowrap">{log.timestamp}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				)}

				{/* Tab content: Messages */}
				{activeTab === 'messages' && (
					<MessagesView 
						currentUser={{
							id: 'admin',
							name: 'Admin',
							email: email,
							role: 'Admin'
						}}
					/>
				)}

				{/* Tab content: Task/Work Allocation */}
				{activeTab === 'task_allocation' && (
					<div className="space-y-6">
						<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
							<div className="flex items-center gap-2">
								<TerminalIcon className="size-5 text-brand-400" />
								<h2 className="text-lg font-bold text-white">Task/Work Allocation</h2>
							</div>
							<Button
								onClick={() => {
									setShowTaskForm(!showTaskForm);
									setTaskMessage(null);
								}}
								className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2 px-4 rounded-none h-auto cursor-pointer"
							>
								{showTaskForm ? 'Cancel Allocation' : (
									<>
										<PlusIcon className="size-4 me-2 inline" />
										Allocate Task
									</>
								)}
							</Button>
						</div>

						{/* Notification message */}
						{taskMessage && (
							<div className={cn(
								"p-3 rounded-none text-xs border font-mono",
								taskMessage.type === 'success'
									? "bg-emerald-950/30 border-emerald-800 text-emerald-400"
									: "bg-red-950/30 border-red-800 text-red-400"
							)}>
								{taskMessage.text}
							</div>
						)}

						{/* Allocate Task Form Card */}
						{showTaskForm && (
							<form onSubmit={handleCreateTask} className="bg-zinc-900/40 border border-zinc-800 p-6 space-y-4 rounded-none">
								<h3 className="text-sm font-semibold text-white uppercase tracking-wider border-b border-zinc-800 pb-2">
									Create & Allocate New Task
								</h3>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div className="space-y-1">
										<label className="text-[10px] text-zinc-400 uppercase font-medium">Task Title</label>
										<Input
											placeholder="Implement Login Auth Flow"
											required
											className="bg-zinc-950 border-zinc-800 text-white text-xs placeholder:text-zinc-650 focus-visible:ring-1 focus-visible:ring-zinc-700 focus-visible:ring-offset-0 focus-visible:border-zinc-700 rounded-none h-9 transition-colors"
											value={taskTitle}
											onChange={e => setTaskTitle(e.target.value)}
										/>
									</div>
									<div className="space-y-1">
										<label className="text-[10px] text-zinc-400 uppercase font-medium">Report To</label>
										<Input
											placeholder="Admin / Team Lead Name"
											required
											className="bg-zinc-950 border-zinc-800 text-white text-xs placeholder:text-zinc-655 focus-visible:ring-1 focus-visible:ring-zinc-700 focus-visible:ring-offset-0 focus-visible:border-zinc-700 rounded-none h-9 transition-colors"
											value={taskReportTo}
											onChange={e => setTaskReportTo(e.target.value)}
										/>
									</div>
								</div>

								<div className="space-y-1">
									<label className="text-[10px] text-zinc-400 uppercase font-medium">Task Description</label>
									<textarea
										placeholder="Describe the tasks, objectives, and deliverables..."
										required
										rows={3}
										className="w-full bg-zinc-950 border border-zinc-800 text-white text-xs placeholder:text-zinc-660 focus-visible:ring-1 focus-visible:ring-zinc-700 focus-visible:ring-offset-0 focus-visible:border-zinc-700 rounded-none p-3 outline-none transition-colors"
										value={taskDescription}
										onChange={e => setTaskDescription(e.target.value)}
									/>
								</div>

								<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
									{/* Whom you want to send dropdown */}
									<div className="space-y-1 md:col-span-2">
										<div className="flex items-center justify-between">
											<label className="text-[10px] text-zinc-400 uppercase font-medium">Whom you want to send</label>
											{/* Send to all toggle option */}
											<button
												type="button"
												onClick={() => setAssignToAll(!assignToAll)}
												className={cn(
													"text-[10px] px-2 py-0.5 border font-mono uppercase transition-all cursor-pointer",
													assignToAll 
														? "bg-brand-600/20 border-brand-500 text-brand-300"
														: "border-zinc-800 text-zinc-500 hover:text-zinc-300"
												)}
											>
												{assignToAll ? '✓ Assigning All' : 'Assign to All'}
											</button>
										</div>
										<select
											disabled={assignToAll}
											value={taskAssigneeId}
											onChange={e => setTaskAssigneeId(e.target.value)}
											className="w-full bg-zinc-950 border border-zinc-800 text-white text-xs rounded-none h-9 px-2 outline-none focus:border-zinc-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
										>
											<option value="">-- Select Employee --</option>
											{employeesList.map((emp) => (
												<option key={emp.id} value={emp.id}>
													{emp.firstName} {emp.lastName} ({emp.id} - {emp.wingName})
												</option>
											))}
										</select>
									</div>

									{/* Deadline Date */}
									<div className="space-y-1">
										<label className="text-[10px] text-zinc-400 uppercase font-medium">Deadline Date</label>
										<Input
											type="date"
											required
											className="bg-zinc-950 border-zinc-800 text-white text-xs focus-visible:ring-1 focus-visible:ring-zinc-700 focus-visible:ring-offset-0 focus-visible:border-zinc-700 rounded-none h-9 transition-colors"
											value={taskDeadline}
											onChange={e => setTaskDeadline(e.target.value)}
										/>
									</div>

									{/* Mode of the task */}
									<div className="space-y-1">
										<label className="text-[10px] text-zinc-400 uppercase font-medium">Mode</label>
										<select
											value={taskMode}
											onChange={e => setTaskMode(e.target.value)}
											className="w-full bg-zinc-950 border border-zinc-800 text-white text-xs rounded-none h-9 px-2 outline-none focus:border-zinc-700 transition-colors"
										>
											<option value="Onsite">Onsite</option>
											<option value="Remote">Remote</option>
											<option value="Hybrid">Hybrid</option>
										</select>
									</div>
								</div>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									{/* Status of the task */}
									<div className="space-y-1">
										<label className="text-[10px] text-zinc-400 uppercase font-medium">Status</label>
										<select
											value={taskStatus}
											onChange={e => setTaskStatus(e.target.value)}
											className="w-full bg-zinc-950 border border-zinc-800 text-white text-xs rounded-none h-9 px-2 outline-none focus:border-zinc-700 transition-colors"
										>
											<option value="Pending">Pending</option>
											<option value="In Progress">In Progress</option>
											<option value="Completed">Completed</option>
										</select>
									</div>

									{/* Submit button */}
									<div className="flex items-end">
										<Button
											type="submit"
											disabled={isAddingTask}
											className="w-full bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold py-2 px-4 rounded-none h-9 cursor-pointer transition-colors"
										>
											{isAddingTask ? 'Allocating...' : 'Submit Allocation'}
										</Button>
									</div>
								</div>
							</form>
						)}

						{/* Task List Table */}
						<div className="bg-zinc-900/30 border border-zinc-800/80 p-6 space-y-4 rounded-none">
							<h3 className="text-sm font-semibold text-white uppercase tracking-wider border-b border-zinc-800 pb-2">
								Allocated Tasks Directory
							</h3>
							
							{tasksList.length === 0 ? (
								<p className="text-zinc-500 text-xs italic py-4 text-center">No tasks allocated yet.</p>
							) : (
								<div className="overflow-x-auto">
									<table className="w-full text-left text-xs border-collapse">
										<thead>
											<tr className="border-b border-zinc-800 text-zinc-400 uppercase font-mono text-[10px] tracking-wider bg-zinc-950/40">
												<th className="p-3">Title</th>
												<th className="p-3">Assignee</th>
												<th className="p-3">Report To</th>
												<th className="p-3">Deadline</th>
												<th className="p-3">Mode</th>
												<th className="p-3">Status</th>
												<th className="p-3">Allocated At</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-zinc-800/50 font-sans text-zinc-300">
											{tasksList.map((task: any) => (
												<tr 
													key={task.id} 
													className={cn(
														"transition-colors duration-150",
														task.status === 'Completed' 
															? "bg-emerald-600/15 hover:bg-emerald-600/25" 
															: task.status === 'In Progress'
																? "bg-blue-600/15 hover:bg-blue-600/25"
																: "hover:bg-zinc-900/20"
													)}
												>
													<td className="p-3">
														<div className="font-bold text-white">{task.title}</div>
														<div className="text-[10px] text-zinc-550 line-clamp-1 mt-0.5">{task.description}</div>
													</td>
													<td className="p-3 whitespace-nowrap">
														<span className={cn(
															"px-2 py-0.5 font-mono text-[10px] border",
															task.assigneeId === 'ALL'
																? "bg-brand-950/30 border-brand-850 text-brand-400 font-bold"
																: "bg-zinc-900 border-zinc-800 text-zinc-300"
														)}>
															{task.assigneeName} {task.assigneeId !== 'ALL' && `(${task.assigneeId})`}
														</span>
													</td>
													<td className="p-3 text-zinc-400 whitespace-nowrap">{task.reportTo}</td>
													<td className="p-3 text-zinc-400 whitespace-nowrap font-mono">
														{new Date(task.deadline).toLocaleDateString()}
													</td>
													<td className="p-3 whitespace-nowrap">
														<span className={cn(
															"px-2 py-0.5 text-[10px] uppercase font-bold border",
															task.mode === 'Remote' && "bg-cyan-950/20 text-cyan-455 border-cyan-900/50",
															task.mode === 'Onsite' && "bg-amber-950/20 text-amber-455 border-amber-900/50",
															task.mode === 'Hybrid' && "bg-purple-950/20 text-purple-455 border-purple-900/50"
														)}>
															{task.mode}
														</span>
													</td>
													<td className="p-3 whitespace-nowrap">
														<span className={cn(
															"px-2 py-0.5 text-[10px] uppercase font-mono font-bold border",
															task.status === 'Completed' && "bg-emerald-950/30 text-emerald-400 border-emerald-900/50",
															task.status === 'In Progress' && "bg-blue-950/30 text-blue-400 border-blue-900/50",
															task.status === 'Pending' && "bg-yellow-950/30 text-yellow-400 border-yellow-900/50"
														)}>
															{task.status}
														</span>
													</td>
													<td className="p-3 text-zinc-500 font-mono text-[10px] whitespace-nowrap">
														{new Date(task.createdAt).toLocaleString()}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							)}
						</div>
					</div>
				)}

				{/* Tab content: Employees Directory */}
				{activeTab === 'employees' && (
					<div className="space-y-6">
						<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
							<div className="flex items-center gap-2">
								<UsersIcon className="size-5 text-brand-400" />
								<h2 className="text-lg font-bold text-white">Employee Directory</h2>
							</div>
							<Button
								onClick={() => {
									setShowAddForm(!showAddForm);
									setAddMessage(null);
								}}
								className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2 px-4 rounded-none h-auto cursor-pointer"
							>
								{showAddForm ? 'Cancel Registration' : (
									<>
										<UserPlusIcon className="size-4 me-2 inline" />
										Add New Employee
									</>
								)}
							</Button>
						</div>

						{/* Notification message */}
						{addMessage && (
							<div className={cn(
								"p-3 rounded-none text-xs border font-mono",
								addMessage.type === 'success'
									? "bg-emerald-950/30 border-emerald-800 text-emerald-400"
									: "bg-red-950/30 border-red-800 text-red-400"
							)}>
								{addMessage.text}
							</div>
						)}

						{/* Add Employee Form Card */}
						{showAddForm && (
							<form onSubmit={handleAddEmployee} className="bg-zinc-900/40 border border-zinc-800 p-6 space-y-4 rounded-none">
								<h3 className="text-sm font-semibold text-white uppercase tracking-wider border-b border-zinc-800 pb-2">
									Register New Member
								</h3>
								<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
									<div className="space-y-1">
										<label className="text-[10px] text-zinc-400 uppercase font-medium">First Name</label>
										<Input
											placeholder="John"
											required
											className="bg-zinc-950 border-zinc-800 text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-zinc-700 rounded-none h-9 transition-colors"
											value={firstName}
											onChange={e => setFirstName(e.target.value)}
										/>
									</div>
									<div className="space-y-1">
										<label className="text-[10px] text-zinc-400 uppercase font-medium">Middle Name</label>
										<Input
											placeholder="Lee"
											className="bg-zinc-950 border-zinc-800 text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-zinc-700 rounded-none h-9 transition-colors"
											value={middleName}
											onChange={e => setMiddleName(e.target.value)}
										/>
									</div>
									<div className="space-y-1">
										<label className="text-[10px] text-zinc-400 uppercase font-medium">Last Name</label>
										<Input
											placeholder="Doe"
											required
											className="bg-zinc-950 border-zinc-800 text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-zinc-700 rounded-none h-9 transition-colors"
											value={lastName}
											onChange={e => setLastName(e.target.value)}
										/>
									</div>
								</div>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div className="space-y-1">
										<label className="text-[10px] text-zinc-400 uppercase font-medium">Email ID</label>
										<Input
											type="email"
											placeholder="john.doe@company.com"
											required
											className="bg-zinc-950 border-zinc-800 text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-zinc-700 rounded-none h-9 transition-colors"
											value={empEmail}
											onChange={e => setEmpEmail(e.target.value)}
										/>
									</div>
									<div className="space-y-1">
										<label className="text-[10px] text-zinc-400 uppercase font-medium">Phone Number</label>
										<Input
											type="tel"
											placeholder="+1 (555) 000-0000"
											required
											className="bg-zinc-950 border-zinc-800 text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-zinc-700 rounded-none h-9 transition-colors"
											value={phone}
											onChange={e => setPhone(e.target.value)}
										/>
									</div>
								</div>

								<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
									<div className="space-y-1">
										<label className="text-[10px] text-zinc-400 uppercase font-medium">Wing Name</label>
										<Input
											placeholder="Engineering / Sales / Support"
											required
											className="bg-zinc-950 border-zinc-800 text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-zinc-700 rounded-none h-9 transition-colors"
											value={wingName}
											onChange={e => setWingName(e.target.value)}
										/>
									</div>
									<div className="space-y-1">
										<label className="text-[10px] text-zinc-400 uppercase font-medium">Wing Lead Name</label>
										<Input
											placeholder="Jane Smith"
											required
											className="bg-zinc-950 border-zinc-800 text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-zinc-700 rounded-none h-9 transition-colors"
											value={wingLeadName}
											onChange={e => setWingLeadName(e.target.value)}
										/>
									</div>
									<div className="space-y-1">
										<label className="text-[10px] text-zinc-400 uppercase font-medium">Role</label>
										<Input
											placeholder="Software Engineer / Designer"
											required
											className="bg-zinc-950 border-zinc-800 text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-zinc-700 rounded-none h-9 transition-colors"
											value={empRole}
											onChange={e => setEmpRole(e.target.value)}
										/>
									</div>
								</div>

								<Button
									type="submit"
									disabled={isAdding}
									className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold py-2 px-4 rounded-none h-10 w-full cursor-pointer transition-all duration-200"
								>
									{isAdding ? 'Registering...' : 'Register Employee & Generate ID'}
								</Button>
							</form>
						)}

						{/* Employee List Table */}
						<div className="bg-zinc-900/30 border border-zinc-800 overflow-x-auto rounded-none">
							<table className="w-full text-left text-xs text-zinc-300 font-mono">
								<thead className="bg-zinc-950/70 border-b border-zinc-800 text-[10px] text-zinc-400 uppercase tracking-wider">
									<tr>
										<th className="p-4 font-semibold">Employee ID</th>
										<th className="p-4 font-semibold">Full Name</th>
										<th className="p-4 font-semibold">Email ID</th>
										<th className="p-4 font-semibold">Phone</th>
										<th className="p-4 font-semibold">Wing</th>
										<th className="p-4 font-semibold">Wing Lead</th>
										<th className="p-4 font-semibold">Role</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-zinc-850 bg-zinc-950/10">
									{employeesList.length === 0 ? (
										<tr>
											<td colSpan={7} className="p-8 text-center text-zinc-550 text-xs italic font-sans">
												No employees registered in directory. Click "Add New Employee" to get started.
											</td>
										</tr>
									) : (
										employeesList.map((emp) => (
											<tr key={emp.id} className="hover:bg-zinc-900/30 transition-colors">
												<td className="p-4 font-semibold text-indigo-400">{emp.id}</td>
												<td className="p-4 text-white font-sans font-medium">
													{emp.firstName} {emp.middleName ? `${emp.middleName} ` : ''}{emp.lastName}
												</td>
												<td className="p-4">{emp.email}</td>
												<td className="p-4">{emp.phone}</td>
												<td className="p-4 text-zinc-200">{emp.wingName}</td>
												<td className="p-4 text-zinc-200">{emp.wingLeadName}</td>
												<td className="p-4 text-zinc-200">{emp.role || 'Employee'}</td>
											</tr>
										))
									)}
								</tbody>
							</table>
						</div>
					</div>
				)}

				{/* TAB: EVENTS */}
				{activeTab === 'events' && (
					<div className="space-y-6">
						{/* Header */}
						<div className="flex items-center justify-between">
							<div>
								<h2 className="text-xl font-bold text-white flex items-center gap-2">
									<CalendarIcon className="size-5 text-brand-400" />
									Events
								</h2>
								<p className="text-zinc-400 text-sm mt-0.5">Manage company events, college visits, and external engagements</p>
							</div>
							<button
								onClick={() => { setShowEventForm(v => !v); setEventMessage(null); }}
								className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold px-4 py-2 rounded-none cursor-pointer transition-colors"
							>
								<PlusIcon className="size-3.5" />
								{showEventForm ? 'Cancel' : 'Create Event'}
							</button>
						</div>

						{eventMessage && (
							<div className={cn(
								"p-3 text-xs border font-mono font-bold",
								eventMessage.type === 'success' ? "bg-emerald-950/30 border-emerald-800 text-emerald-400" : "bg-red-950/30 border-red-800 text-red-400"
							)}>
								{eventMessage.text}
							</div>
						)}

						{/* Create Event Form */}
						{showEventForm && (
							<form onSubmit={handleCreateEvent} className="bg-zinc-900/40 border border-zinc-800 p-6 space-y-5">
								<h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider border-b border-zinc-800 pb-3">New Event Details</h3>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div className="space-y-1.5">
										<label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Event Title *</label>
										<Input
											value={eventTitle}
											onChange={e => setEventTitle(e.target.value)}
											required
											placeholder="e.g. Tech Career Fair 2026"
											className="bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-600 rounded-none text-sm"
										/>
									</div>
									<div className="space-y-1.5">
										<label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Organising College *</label>
										<Input
											value={eventCollege}
											onChange={e => setEventCollege(e.target.value)}
											required
											placeholder="e.g. IIT Bombay"
											className="bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-600 rounded-none text-sm"
										/>
									</div>
								</div>

								<div className="space-y-1.5">
									<label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Event Description *</label>
									<textarea
										value={eventDescription}
										onChange={e => setEventDescription(e.target.value)}
										required
										rows={3}
										placeholder="Brief description of the event, goals, and activities..."
										className="w-full bg-zinc-950 border border-zinc-800 text-white placeholder:text-zinc-600 rounded-none text-sm p-3 resize-none focus:outline-none focus:ring-1 focus:ring-brand-600"
									/>
								</div>

								<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
									<div className="space-y-1.5">
										<label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Start Date *</label>
										<Input
											type="date"
											value={eventStartDate}
											onChange={e => setEventStartDate(e.target.value)}
											required
											className="bg-zinc-950 border-zinc-800 text-white rounded-none text-sm"
										/>
									</div>
									<div className="space-y-1.5">
										<label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">End Date *</label>
										<Input
											type="date"
											value={eventEndDate}
											onChange={e => setEventEndDate(e.target.value)}
											required
											className="bg-zinc-950 border-zinc-800 text-white rounded-none text-sm"
										/>
									</div>
									<div className="space-y-1.5">
										<label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Start Time *</label>
										<Input
											type="time"
											value={eventStartTime}
											onChange={e => setEventStartTime(e.target.value)}
											required
											className="bg-zinc-950 border-zinc-800 text-white rounded-none text-sm"
										/>
									</div>
									<div className="space-y-1.5">
										<label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">End Time *</label>
										<Input
											type="time"
											value={eventEndTime}
											onChange={e => setEventEndTime(e.target.value)}
											required
											className="bg-zinc-950 border-zinc-800 text-white rounded-none text-sm"
										/>
									</div>
								</div>

								<div className="space-y-1.5">
									<label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Venue / Address *</label>
									<Input
										value={eventVenue}
										onChange={e => setEventVenue(e.target.value)}
										required
										placeholder="e.g. Main Auditorium, IIT Bombay, Powai, Mumbai 400076"
										className="bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-600 rounded-none text-sm"
									/>
								</div>

								<div className="space-y-3">
									<label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Company Representatives (up to 5)</label>
									<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
										{eventReps.map((rep, idx) => (
											<div key={idx} className="flex items-center gap-2">
												<span className="text-xs text-zinc-600 font-mono w-4">{idx + 1}.</span>
												<Input
													value={rep}
													onChange={e => {
														const updated = [...eventReps];
														updated[idx] = e.target.value;
														setEventReps(updated);
													}}
													placeholder={`Representative ${idx + 1} name`}
													className="bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-600 rounded-none text-sm"
												/>
											</div>
										))}
									</div>
								</div>

								<div className="flex justify-end pt-2 border-t border-zinc-800">
									<button
										type="submit"
										disabled={isAddingEvent}
										className="bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold px-6 py-2.5 rounded-none cursor-pointer transition-colors disabled:opacity-50"
									>
										{isAddingEvent ? 'Creating...' : 'Create Event'}
									</button>
								</div>
							</form>
						)}

						{/* Events List */}
						{eventsList.length === 0 ? (
							<div className="text-center py-16 text-zinc-600 border border-zinc-900">
								<CalendarIcon className="size-10 mx-auto mb-3 opacity-40" />
								<p className="text-sm font-medium">No events created yet</p>
								<p className="text-xs mt-1">Click "Create Event" to add the first event</p>
							</div>
						) : (
							<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
								{eventsList.map((event: any) => {
									const reps: { id: string; name: string }[] = JSON.parse(event.representatives || '[]');
									const startD = new Date(event.startDate);
									const endD = new Date(event.endDate);
									const fmt = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
									return (
										<div key={event.id} className="bg-zinc-900/30 border border-zinc-800/80 p-5 space-y-4 hover:border-brand-900/60 transition-colors">
											<div className="flex items-start justify-between gap-3">
												<div>
													<h3 className="text-base font-bold text-white">{event.title}</h3>
													<p className="text-xs text-brand-400 font-medium mt-0.5">{event.organisingCollege}</p>
												</div>
												<span className="text-[10px] bg-brand-950/40 border border-brand-900/40 text-brand-300 px-2 py-1 font-mono uppercase tracking-wider whitespace-nowrap">
													Event
												</span>
											</div>

											<p className="text-sm text-zinc-400 leading-relaxed">{event.description}</p>

											<div className="grid grid-cols-2 gap-3 text-xs">
												<div className="space-y-0.5">
													<p className="text-zinc-600 uppercase tracking-wider font-semibold">Start</p>
													<p className="text-zinc-200">{fmt(startD)} · {event.startTime}</p>
												</div>
												<div className="space-y-0.5">
													<p className="text-zinc-600 uppercase tracking-wider font-semibold">End</p>
													<p className="text-zinc-200">{fmt(endD)} · {event.endTime}</p>
												</div>
											</div>

											<div className="flex items-start gap-2 text-xs text-zinc-400">
												<MapPinIcon className="size-3.5 mt-0.5 text-zinc-600 shrink-0" />
												<span>{event.venueAddress}</span>
											</div>

											{reps.length > 0 && (
												<div className="space-y-1.5">
													<p className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold">Company Representatives</p>
													<div className="flex flex-wrap gap-1.5">
														{reps.map((r, i) => (
															<span key={i} className="text-xs bg-zinc-800/60 border border-zinc-700/60 text-zinc-300 px-2 py-0.5">
																{r.name}
															</span>
														))}
													</div>
												</div>
											)}
										</div>
									);
								})}
							</div>
						)}
					</div>
				)}

				{/* TAB: WORK SUBMISSIONS */}
				{activeTab === 'work_submissions' && (
					<div className="space-y-6">
						{/* Header */}
						<div className="flex items-center justify-between flex-wrap gap-3">
							<div>
								<h2 className="text-xl font-bold text-white flex items-center gap-2">
									<FileTextIcon className="size-5 text-brand-400" />
									Work Submissions
								</h2>
								<p className="text-zinc-400 text-sm mt-0.5">Review and approve employee work submissions</p>
							</div>
							{/* Filter pills */}
							<div className="flex items-center gap-2 flex-wrap">
								{['All', 'Submitted', 'Reviewed', 'Approved', 'Needs Revision'].map(f => (
									<button
										key={f}
										onClick={() => setSubmissionFilter(f)}
										className={cn(
											"text-xs px-3 py-1.5 font-medium border transition-colors cursor-pointer",
											submissionFilter === f
												? "bg-brand-600 border-brand-500 text-white"
												: "bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white"
										)}
									>
										{f}
									</button>
								))}
							</div>
						</div>

						{/* Stats bar */}
						<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
							{[
								{ label: 'Total', count: submissionsList.length, color: 'text-zinc-300' },
								{ label: 'Pending Review', count: submissionsList.filter(s => s.status === 'Submitted').length, color: 'text-amber-400' },
								{ label: 'Approved', count: submissionsList.filter(s => s.status === 'Approved').length, color: 'text-emerald-400' },
								{ label: 'Needs Revision', count: submissionsList.filter(s => s.status === 'Needs Revision').length, color: 'text-red-400' },
							].map(stat => (
								<div key={stat.label} className="bg-zinc-900/30 border border-zinc-800/80 p-4 space-y-1">
									<p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">{stat.label}</p>
									<p className={`text-2xl font-bold ${stat.color}`}>{stat.count}</p>
								</div>
							))}
						</div>

						{/* Submissions list */}
						{submissionsList.filter(s => submissionFilter === 'All' || s.status === submissionFilter).length === 0 ? (
							<div className="text-center py-16 text-zinc-600 border border-zinc-900">
								<FileTextIcon className="size-10 mx-auto mb-3 opacity-40" />
								<p className="text-sm font-medium">No submissions {submissionFilter !== 'All' ? `with status "${submissionFilter}"` : 'yet'}</p>
							</div>
						) : (
							<div className="space-y-3">
								{submissionsList
									.filter(s => submissionFilter === 'All' || s.status === submissionFilter)
									.map((sub: any) => {
										const statusColors: Record<string, string> = {
											'Submitted': 'bg-amber-950/30 border-amber-900/40 text-amber-300',
											'Reviewed': 'bg-blue-950/30 border-blue-900/40 text-blue-300',
											'Approved': 'bg-emerald-950/30 border-emerald-900/40 text-emerald-300',
											'Needs Revision': 'bg-red-950/30 border-red-900/40 text-red-300',
										};
										const isReviewing = reviewingId === sub.id;
										return (
											<div key={sub.id} className="bg-zinc-900/30 border border-zinc-800/80 p-5 space-y-3 hover:border-zinc-700/80 transition-colors">
												<div className="flex items-start justify-between gap-3 flex-wrap">
													<div className="space-y-1">
														<h3 className="text-base font-bold text-white">{sub.title}</h3>
														<div className="flex items-center gap-3 text-xs text-zinc-500">
															<span className="font-semibold text-zinc-300">{sub.employeeName}</span>
															<span>·</span>
															<span className="font-mono text-zinc-500">{sub.employeeId}</span>
															<span>·</span>
															<span>{new Date(sub.submittedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
															<span>·</span>
															<span className="text-brand-400 font-semibold">{sub.hoursSpent}h</span>
														</div>
													</div>
													<span className={cn("text-[10px] px-2 py-1 font-mono uppercase tracking-wider border", statusColors[sub.status] || 'bg-zinc-800/40 border-zinc-700/40 text-zinc-400')}>
														{sub.status}
													</span>
												</div>

												<p className="text-sm text-zinc-400 leading-relaxed">{sub.description}</p>

												{sub.taskTitle && (
													<div className="flex items-center gap-1.5 text-xs text-zinc-500">
														<ClockIcon className="size-3.5 text-zinc-600" />
														<span>Linked task: <span className="text-zinc-300 font-medium">{sub.taskTitle}</span></span>
													</div>
												)}

												{sub.adminNote && (
													<div className="bg-zinc-900/60 border border-zinc-800 p-3 text-xs text-zinc-400 italic">
														<span className="text-zinc-500 not-italic font-semibold">Admin Note: </span>{sub.adminNote}
													</div>
												)}

												{/* Review panel */}
												{isReviewing ? (
													<div className="space-y-3 pt-2 border-t border-zinc-800">
														<textarea
															value={reviewNote}
															onChange={e => setReviewNote(e.target.value)}
															rows={2}
															placeholder="Optional note to employee..."
															className="w-full bg-zinc-950 border border-zinc-800 text-white placeholder:text-zinc-600 rounded-none text-xs p-3 resize-none focus:outline-none focus:ring-1 focus:ring-brand-600"
														/>
														<div className="flex items-center gap-2 flex-wrap">
															<button
																onClick={() => handleUpdateSubmission(sub.id, 'Approved')}
																disabled={isUpdatingStatus}
																className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs px-3 py-1.5 cursor-pointer transition-colors disabled:opacity-50"
															>
																<CheckCircleIcon className="size-3.5" /> Approve
															</button>
															<button
																onClick={() => handleUpdateSubmission(sub.id, 'Needs Revision')}
																disabled={isUpdatingStatus}
																className="flex items-center gap-1.5 bg-red-800 hover:bg-red-700 text-white text-xs px-3 py-1.5 cursor-pointer transition-colors disabled:opacity-50"
															>
																<XCircleIcon className="size-3.5" /> Needs Revision
															</button>
															<button
																onClick={() => handleUpdateSubmission(sub.id, 'Reviewed')}
																disabled={isUpdatingStatus}
																className="flex items-center gap-1.5 bg-blue-800 hover:bg-blue-700 text-white text-xs px-3 py-1.5 cursor-pointer transition-colors disabled:opacity-50"
															>
																<AlertCircleIcon className="size-3.5" /> Mark Reviewed
															</button>
															<button
																onClick={() => { setReviewingId(null); setReviewNote(''); }}
																className="text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer px-2 py-1.5 transition-colors"
															>
																Cancel
															</button>
														</div>
													</div>
												) : (
													<div className="pt-1">
														<button
															onClick={() => { setReviewingId(sub.id); setReviewNote(sub.adminNote || ''); }}
															className="text-xs text-brand-400 hover:text-brand-300 cursor-pointer transition-colors font-medium"
														>
															Review →
														</button>
													</div>
												)}
											</div>
										);
									})}
							</div>
						)}
					</div>
				)}

				{/* TAB: LEADS */}
				{activeTab === 'leads' && (() => {
					const STATUS_COLOURS: Record<string, string> = {
						New:        'bg-zinc-800/60 border-zinc-700 text-zinc-300',
						Contacted:  'bg-blue-950/40 border-blue-800/60 text-blue-300',
						Qualified:  'bg-amber-950/40 border-amber-800/60 text-amber-300',
						Proposal:   'bg-violet-950/40 border-violet-800/60 text-violet-300',
						Won:        'bg-emerald-950/40 border-emerald-800/60 text-emerald-300',
						Lost:       'bg-red-950/40 border-red-800/60 text-red-300',
					};
					const SOURCE_COLOURS: Record<string, string> = {
						JustDial:   'text-orange-400',
						Sulekha:    'text-amber-400',
						Yelp:       'text-red-400',
						Clutch:     'text-brand-400',
						Upwork:     'text-green-400',
						Freelancer: 'text-teal-400',
						IndiaMART:  'text-yellow-400',
						'Google Maps': 'text-sky-400',
						LinkedIn:   'text-blue-400',
						Behance:    'text-cyan-400',
					};

					const allSources = ['All', ...Array.from(new Set(leadsList.map(l => l.source)))];
					const filtered = leadsList.filter(l => {
						const subTabOk = leadsSubTab === 'pipeline' ? l.source !== 'Manual' : l.source === 'Manual';
						const statusOk = leadsFilter === 'All' || l.status === leadsFilter;
						const sourceOk = leadsSourceFilter === 'All' || l.source === leadsSourceFilter;
						const searchOk = !leadsSearch || l.businessName.toLowerCase().includes(leadsSearch.toLowerCase()) || (l.location || '').toLowerCase().includes(leadsSearch.toLowerCase()) || (l.category || '').toLowerCase().includes(leadsSearch.toLowerCase());
						return subTabOk && statusOk && sourceOk && searchOk;
					});

					return (
						<div className="space-y-6">
							{/* Header */}
							<div className="flex items-start justify-between gap-4 flex-wrap">
								<div>
									<h2 className="text-xl font-bold text-white flex items-center gap-2">
										<BarChart2Icon className="size-5 text-brand-400" />
										Leads Management
									</h2>
									<p className="text-zinc-400 text-sm mt-0.5">{leadsList.filter(l => leadsSubTab === 'pipeline' ? l.source !== 'Manual' : l.source === 'Manual').length} total leads · {filtered.length} shown</p>
								</div>
								
								<div className="flex items-center gap-2 flex-wrap">
									{/* Sub-tab selection */}
									<div className="bg-zinc-950 border border-zinc-800 p-0.5 flex gap-0.5 font-mono">
										<button
											onClick={() => { setLeadsSubTab('pipeline'); setLeadsFilter('All'); setLeadsSourceFilter('All'); }}
											className={cn("text-[10px] px-3 py-1.5 font-semibold cursor-pointer transition-all", leadsSubTab === 'pipeline' ? "bg-brand-600 text-white" : "text-zinc-500 hover:text-white")}
										>
											Pipeline Leads
										</button>
										<button
											onClick={() => { setLeadsSubTab('manual'); setLeadsFilter('All'); setLeadsSourceFilter('All'); }}
											className={cn("text-[10px] px-3 py-1.5 font-semibold cursor-pointer transition-all", leadsSubTab === 'manual' ? "bg-brand-600 text-white" : "text-zinc-500 hover:text-white")}
										>
											Manual Leads
										</button>
									</div>

									{/* Action buttons conditional on subtab */}
									{leadsSubTab === 'pipeline' ? (
										<label className={cn(
											"flex items-center gap-2 text-xs font-semibold px-4 py-2 cursor-pointer transition-colors border",
											importLoading ? "bg-zinc-800 border-zinc-700 text-zinc-500 cursor-wait" : "bg-brand-700 hover:bg-brand-600 border-brand-600 text-white"
										)}>
											<UploadIcon className="size-3.5" />
											{importLoading ? 'Importing…' : 'Import leads_latest.json'}
											<input type="file" accept=".json" className="hidden" onChange={handleImportJson} disabled={importLoading} />
										</label>
									) : (
										<button
											onClick={() => setShowManualForm(!showManualForm)}
											className="bg-brand-600 hover:bg-brand-500 border border-brand-500 text-white text-xs font-semibold px-4 py-2 cursor-pointer transition-colors"
										>
											{showManualForm ? 'Hide Form' : 'Add Lead Manually'}
										</button>
									)}
								</div>
							</div>

							{importMessage && (
								<div className={cn("p-3 text-xs border font-mono", importMessage.type === 'success' ? "bg-emerald-950/30 border-emerald-800 text-emerald-400" : "bg-red-950/30 border-red-800 text-red-400")}>
									{importMessage.text}
								</div>
							)}

							{manualLeadMsg && (
								<div className={cn("p-3 text-xs border font-mono", manualLeadMsg.type === 'success' ? "bg-emerald-950/30 border-emerald-800 text-emerald-400" : "bg-red-950/30 border-red-800 text-red-400")}>
									{manualLeadMsg.text}
								</div>
							)}

							{/* Feed Manual Lead Form (Admin View) */}
							{leadsSubTab === 'manual' && showManualForm && (
								<form onSubmit={handleCreateManualLead} className="bg-zinc-900/30 border border-zinc-800 p-5 space-y-4">
									<div className="flex items-center justify-between border-b border-zinc-800 pb-2">
										<h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Feed Manual Lead</h3>
										<button type="button" onClick={() => setShowManualForm(false)} className="text-xs text-zinc-500 hover:text-zinc-300">Cancel</button>
									</div>
									
									<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
										<div className="space-y-1">
											<label className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Business Name *</label>
											<input
												type="text"
												value={manualBizName}
												onChange={e => setManualBizName(e.target.value)}
												required
												placeholder="e.g. Delta Corp"
												className="w-full bg-zinc-950 border border-zinc-800 text-white text-xs p-2.5 focus:outline-none focus:ring-1 focus:ring-brand-600"
											/>
										</div>
										<div className="space-y-1">
											<label className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Contact Person</label>
											<input
												type="text"
												value={manualContact}
												onChange={e => setManualContact(e.target.value)}
												placeholder="e.g. Jane Smith"
												className="w-full bg-zinc-950 border border-zinc-800 text-white text-xs p-2.5 focus:outline-none focus:ring-1 focus:ring-brand-600"
											/>
										</div>
										<div className="space-y-1">
											<label className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Category</label>
											<input
												type="text"
												value={manualCat}
												onChange={e => setManualCat(e.target.value)}
												placeholder="e.g. Web Development"
												className="w-full bg-zinc-950 border border-zinc-800 text-white text-xs p-2.5 focus:outline-none focus:ring-1 focus:ring-brand-600"
											/>
										</div>
									</div>

									<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
										<div className="space-y-1">
											<label className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Phone Number</label>
											<input
												type="text"
												value={manualPhone}
												onChange={e => setManualPhone(e.target.value)}
												placeholder="e.g. +91 9988776655"
												className="w-full bg-zinc-950 border border-zinc-800 text-white text-xs p-2.5 focus:outline-none focus:ring-1 focus:ring-brand-600"
											/>
										</div>
										<div className="space-y-1">
											<label className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Email Address</label>
											<input
												type="email"
												value={manualEmail}
												onChange={e => setManualEmail(e.target.value)}
												placeholder="e.g. contact@delta.com"
												className="w-full bg-zinc-950 border border-zinc-800 text-white text-xs p-2.5 focus:outline-none focus:ring-1 focus:ring-brand-600"
											/>
										</div>
										<div className="space-y-1">
											<label className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Website</label>
											<input
												type="text"
												value={manualWeb}
												onChange={e => setManualWeb(e.target.value)}
												placeholder="e.g. www.delta.com"
												className="w-full bg-zinc-950 border border-zinc-800 text-white text-xs p-2.5 focus:outline-none focus:ring-1 focus:ring-brand-600"
											/>
										</div>
									</div>

									<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
										<div className="space-y-1">
											<label className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Location / Address</label>
											<input
												type="text"
												value={manualLoc}
												onChange={e => setManualLoc(e.target.value)}
												placeholder="e.g. Gachibowli, Hyderabad"
												className="w-full bg-zinc-950 border border-zinc-800 text-white text-xs p-2.5 focus:outline-none focus:ring-1 focus:ring-brand-600"
											/>
										</div>
										<div className="space-y-1">
											<label className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Priority</label>
											<select
												value={manualPriority}
												onChange={e => setManualPriority(e.target.value)}
												className="w-full bg-zinc-950 border border-zinc-800 text-white text-xs p-2.5 focus:outline-none focus:ring-1 focus:ring-brand-600 cursor-pointer"
											>
												<option value="Low">Low</option>
												<option value="Medium">Medium</option>
												<option value="High">High</option>
											</select>
										</div>
										<div className="space-y-1">
											<label className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Assign Immediately to Employee</label>
											<select
												value={manualAssignTo}
												onChange={e => setManualAssignTo(e.target.value)}
												className="w-full bg-zinc-950 border border-zinc-800 text-white text-xs p-2.5 focus:outline-none focus:ring-1 focus:ring-brand-600 cursor-pointer"
											>
												<option value="">— Leave Unassigned —</option>
												{employeesList.map((emp: any) => (
													<option key={emp.id} value={emp.id}>
														{emp.firstName} {emp.lastName} ({emp.id})
													</option>
												))}
											</select>
										</div>
									</div>

									<div className="space-y-1">
										<label className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Description / Notes</label>
										<textarea
											value={manualDesc}
											onChange={e => setManualDesc(e.target.value)}
											rows={2}
											placeholder="Enter any initial details about the client, requirements, or lead description..."
											className="w-full bg-zinc-950 border border-zinc-800 text-white text-xs p-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-brand-600"
										/>
									</div>

									<div className="flex justify-end pt-2 border-t border-zinc-850">
										<button
											type="submit"
											disabled={isSavingManualLead}
											className="bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold px-5 py-2 cursor-pointer transition-colors disabled:opacity-50"
										>
											{isSavingManualLead ? 'Saving...' : 'Save Lead'}
										</button>
									</div>
								</form>
							)}

							{/* Crawl leads panel */}
							{leadsSubTab === 'pipeline' && (
								<form onSubmit={handleLeadCrawl} className="bg-zinc-900/30 border border-zinc-800 p-4 space-y-4">
									<div className="flex items-center justify-between border-b border-zinc-800 pb-2">
										<h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Automated Leads Crawler</h3>
										<span className="text-[10px] text-zinc-500 font-mono">Runs crawler.py</span>
									</div>
									<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
										<div className="space-y-1">
											<label className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Target City</label>
											<input
												type="text"
												value={crawlCity}
												onChange={e => setCrawlCity(e.target.value)}
												placeholder="e.g. Hyderabad"
												required
												className="w-full bg-zinc-950 border border-zinc-800 text-white placeholder:text-zinc-700 text-xs p-2.5 focus:outline-none focus:ring-1 focus:ring-brand-600"
											/>
										</div>
										<div className="space-y-1">
											<label className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Business Category</label>
											<input
												type="text"
												value={crawlCategory}
												onChange={e => setCrawlCategory(e.target.value)}
												placeholder="e.g. IT Services"
												required
												className="w-full bg-zinc-950 border border-zinc-800 text-white placeholder:text-zinc-700 text-xs p-2.5 focus:outline-none focus:ring-1 focus:ring-brand-600"
											/>
										</div>
										<div className="flex items-end">
											<button
												type="submit"
												disabled={isCrawling}
												className="w-full bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold py-2.5 cursor-pointer transition-colors disabled:opacity-50"
											>
												{isCrawling ? 'Crawling Resources...' : 'Crawl Data'}
											</button>
										</div>
									</div>
									{crawlMessage && (
										<div className={cn("p-2 text-[11px] border font-mono", crawlMessage.type === 'success' ? "bg-emerald-950/20 border-emerald-900/40 text-emerald-400" : "bg-red-950/20 border-red-900/40 text-red-400")}>
											{crawlMessage.text}
										</div>
									)}
								</form>
							)}

							{/* Stats bar */}
							<div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
								{Object.entries(STATUS_COLOURS).map(([status, cls]) => (
									<button key={status} onClick={() => setLeadsFilter(leadsFilter === status ? 'All' : status)}
										className={cn("border p-3 text-left transition-colors cursor-pointer", leadsFilter === status ? cls + " ring-1 ring-brand-500" : "bg-zinc-900/30 border-zinc-800 hover:border-zinc-700")}>
										<p className="text-[10px] text-zinc-500 uppercase tracking-wider">{status}</p>
										<p className="text-lg font-bold text-white">{leadsList.filter(l => {
											const subTabOk = leadsSubTab === 'pipeline' ? l.source !== 'Manual' : l.source === 'Manual';
											return subTabOk && l.status === status;
										}).length}</p>
									</button>
								))}
							</div>

							{/* Search + Source filter */}
							<div className="flex gap-3 flex-wrap items-center justify-between">
								<div className="flex gap-3 flex-1 flex-wrap items-center">
									<input
										type="text"
										value={leadsSearch}
										onChange={e => setLeadsSearch(e.target.value)}
										placeholder="Search by name, location, category…"
										className="flex-1 min-w-[220px] bg-zinc-950 border border-zinc-800 text-white placeholder:text-zinc-600 text-xs p-2.5 rounded-none focus:outline-none focus:ring-1 focus:ring-brand-600"
									/>
									{leadsSubTab === 'pipeline' && (
										<div className="flex gap-1.5 flex-wrap">
											{allSources.filter(s => s !== 'Manual').map(s => (
												<button key={s} onClick={() => setLeadsSourceFilter(s)}
													className={cn("text-[10px] px-2.5 py-1 border font-medium cursor-pointer transition-colors",
														leadsSourceFilter === s ? "bg-brand-700 border-brand-600 text-white" : "bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700")}>
													{s}
												</button>
											))}
										</div>
									)}
								</div>
								<div className="flex gap-2 flex-wrap">
									{filtered.some(l => !l.allowed) && (
										<button
											onClick={() => handleAllowAll(filtered.filter(l => !l.allowed).map(l => l.id))}
											className="bg-emerald-700 hover:bg-emerald-600 border border-emerald-600 text-white text-xs font-semibold px-4 py-2.5 cursor-pointer transition-colors"
										>
											Allow All ({filtered.filter(l => !l.allowed).length})
										</button>
									)}
									{filtered.length > 0 && (
										<button
											onClick={() => handleDeleteAll(filtered.map(l => l.id))}
											className="bg-red-850 hover:bg-red-700 border border-red-700 text-white text-xs font-semibold px-4 py-2.5 cursor-pointer transition-colors"
										>
											Delete All ({filtered.length})
										</button>
									)}
								</div>
							</div>

							{/* Leads list */}
							{filtered.length === 0 ? (
								<div className="text-center py-16 border border-zinc-900 text-zinc-600">
									<BarChart2Icon className="size-10 mx-auto mb-3 opacity-30" />
									<p className="text-sm font-medium">No leads found</p>
									<p className="text-xs mt-1">
										{leadsSubTab === 'pipeline' 
											? 'Import a crawled lead file or crawl new leads to populate the pipeline.' 
											: 'Add your first manual lead using the "Add Lead Manually" button above.'}
									</p>
								</div>
							) : leadsSubTab === 'manual' ? (
								<div className="overflow-x-auto border border-zinc-800 bg-zinc-950/20">
									<table className="w-full text-left border-collapse text-xs font-sans">
										<thead>
											<tr className="bg-zinc-900/60 border-b border-zinc-800 text-zinc-400 font-mono uppercase tracking-wider text-[10px]">
												<th className="p-3 font-semibold">Business Name</th>
												<th className="p-3 font-semibold">Contact Person</th>
												<th className="p-3 font-semibold">Category / Location</th>
												<th className="p-3 font-semibold">Phone / Website</th>
												<th className="p-3 font-semibold">Notes / Description</th>
												<th className="p-3 font-semibold">Priority</th>
												<th className="p-3 font-semibold">Assignee</th>
												<th className="p-3 font-semibold text-right">Actions</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-zinc-900">
											{filtered.map((lead: any) => {
												const assignedEmployee = employeesList.find(e => e.id === lead.assignedTo);
												return (
													<tr key={lead.id} className="hover:bg-zinc-900/40 transition-colors">
														<td className="p-3 font-bold text-white max-w-[180px] truncate">{lead.businessName}</td>
														<td className="p-3 text-zinc-300 font-mono">{lead.contactName || '—'}</td>
														<td className="p-3 text-zinc-400">
															<div className="font-semibold text-zinc-300">{lead.category || '—'}</div>
															<div className="text-[10px] text-zinc-500 mt-0.5">{lead.location || '—'}</div>
														</td>
														<td className="p-3 text-zinc-400">
															<div className="font-mono text-zinc-300">{lead.phone || '—'}</div>
															<div className="text-[10px] text-brand-400 mt-0.5 truncate max-w-[140px]" title={lead.website}>
																{lead.website ? (
																	<a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
																		{lead.website.replace(/^https?:\/\//, '')}
																	</a>
																) : '—'}
															</div>
														</td>
														<td className="p-3 text-zinc-500 max-w-[200px] truncate" title={lead.notes || lead.description || ''}>
															{lead.notes || lead.description || '—'}
														</td>
														<td className="p-3">
															<span className={cn(
																"text-[9px] px-1.5 py-0.5 font-semibold font-mono",
																lead.priority === 'High' ? 'text-red-400 bg-red-950/20 border border-red-900/40' :
																lead.priority === 'Medium' ? 'text-amber-400 bg-amber-950/20 border border-amber-900/40' :
																'text-zinc-400 bg-zinc-900/40 border border-zinc-800'
															)}>
																{lead.priority}
															</span>
														</td>
														<td className="p-3">
															<select
																value={lead.assignedTo || ''}
																onChange={e => handleLeadAssign(lead.id, e.target.value)}
																className="bg-zinc-950 border border-zinc-800 text-white text-[10px] p-1.5 focus:outline-none max-w-[130px] truncate cursor-pointer"
															>
																<option value="">— Unassigned —</option>
																{employeesList.map((emp: any) => (
																	<option key={emp.id} value={emp.id}>
																		{emp.firstName} {emp.lastName}
																	</option>
																))}
															</select>
														</td>
														<td className="p-3 text-right">
															<div className="flex items-center justify-end gap-1.5">
																<select
																	value={lead.status}
																	onChange={e => handleLeadStatusUpdate(lead.id, e.target.value)}
																	disabled={updatingLeadId === lead.id}
																	className={cn("text-[10px] px-2 py-1 border font-mono uppercase tracking-wider cursor-pointer bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-brand-600 transition-colors disabled:opacity-50", STATUS_COLOURS[lead.status] || 'border-zinc-700 text-zinc-400')}
																>
																	{['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'].map(s => (
																		<option key={s} value={s}>{s}</option>
																	))}
																</select>
																<button
																	onClick={() => handleLeadAllowToggle(lead.id, !lead.allowed)}
																	disabled={updatingLeadId === lead.id}
																	className={cn(
																		"text-[10px] px-2 py-1 border transition-colors cursor-pointer disabled:opacity-50 font-semibold tracking-wider uppercase font-mono",
																		lead.allowed 
																			? "bg-emerald-950/40 border-emerald-800 text-emerald-400" 
																			: "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white"
																	)}
																>
																	{lead.allowed ? 'Allowed' : 'Allow'}
																</button>
																<button
																	onClick={() => handleLeadDelete(lead.id)}
																	className="p-1.5 text-red-500 hover:bg-red-950/20 border border-transparent hover:border-red-900/40 transition-colors cursor-pointer"
																	title="Delete Lead"
																>
																	<Trash2Icon className="size-3.5" />
																</button>
															</div>
														</td>
													</tr>
												);
											})}
										</tbody>
									</table>
								</div>
							) : (
								<div className="space-y-2">
									{filtered.map((lead: any) => {
										const assignedEmployee = employeesList.find(e => e.id === lead.assignedTo);
										const isAssigning = assigningLeadId === lead.id;

										return (
											<div key={lead.id} className="bg-zinc-900/30 border border-zinc-800/80 p-4 hover:border-zinc-700/70 transition-colors">
												<div className="flex items-start justify-between gap-3 flex-wrap">
													<div className="space-y-0.5 flex-1 min-w-0">
														<div className="flex items-center gap-2 flex-wrap">
															<h3 className="text-sm font-bold text-white truncate">{lead.businessName}</h3>
															{lead.rating && <span className="text-[10px] text-amber-400 font-mono">★ {lead.rating}</span>}
															{lead.reviewCount && <span className="text-[10px] text-zinc-600">({lead.reviewCount})</span>}
														</div>
														<div className="flex items-center gap-2 text-[11px] text-zinc-500 flex-wrap">
															{lead.category && <span>{lead.category}</span>}
															{lead.location && <><span>·</span><span>{lead.location}</span></>}
															{lead.phone && <><span>·</span><span className="text-zinc-400">{lead.phone}</span></>}
															{lead.website && (
																<>
																	<span>·</span>
																	<a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:underline truncate max-w-[160px]">
																		{lead.website.replace(/^https?:\/\//, '')}
																	</a>
																</>
															)}
														</div>
														{lead.description && <p className="text-[11px] text-zinc-500 mt-1 line-clamp-2">{lead.description}</p>}
														
														{/* Assignment info */}
														<div className="text-[11px] text-zinc-400 mt-2 flex items-center gap-2 flex-wrap">
															<UserCheckIcon className="size-3.5 text-zinc-500" />
															{isAssigning ? (
																<div className="flex items-center gap-2">
																	<select
																		value={assignEmployeeId}
																		onChange={e => setAssignEmployeeId(e.target.value)}
																		className="bg-zinc-950 border border-zinc-800 text-white text-[10px] p-1 focus:outline-none"
																	>
																		<option value="">— Unassigned —</option>
																		{employeesList.map((emp: any) => (
																			<option key={emp.id} value={emp.id}>
																				{emp.firstName} {emp.lastName} ({emp.id})
																			</option>
																		))}
																	</select>
																	<button
																		onClick={() => handleLeadAssign(lead.id, assignEmployeeId)}
																		className="bg-brand-600 hover:bg-brand-500 text-white text-[9px] px-2 py-1 font-semibold"
																	>
																		Save
																	</button>
																	<button
																		onClick={() => { setAssigningLeadId(null); setAssignEmployeeId(''); }}
																		className="text-zinc-500 hover:text-zinc-300 text-[9px]"
																	>
																		Cancel
																	</button>
																</div>
															) : (
																<span>
																	Assigned to:{' '}
																	<span className="text-brand-300 font-medium">
																		{assignedEmployee ? `${assignedEmployee.firstName} ${assignedEmployee.lastName}` : 'Unassigned'}
																	</span>{' '}
																	<button
																		onClick={() => { setAssigningLeadId(lead.id); setAssignEmployeeId(lead.assignedTo || ''); }}
																		className="text-brand-400 hover:underline ml-1 font-semibold cursor-pointer"
																	>
																		[Change]
																	</button>
																</span>
															)}
														</div>
													</div>
													<div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
														<span className={cn("text-[9px] px-1.5 py-0.5 font-semibold uppercase tracking-wider", SOURCE_COLOURS[lead.source] || 'text-zinc-400')}>
															{lead.source}
														</span>
														<select
															value={lead.status}
															onChange={e => handleLeadStatusUpdate(lead.id, e.target.value)}
															disabled={updatingLeadId === lead.id}
															className={cn("text-[10px] px-2 py-1 border font-mono uppercase tracking-wider bg-zinc-950 cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-600 transition-colors disabled:opacity-50", STATUS_COLOURS[lead.status] || 'border-zinc-700 text-zinc-400')}
														>
															{['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'].map(s => (
																<option key={s} value={s}>{s}</option>
															))}
														</select>
														<button
															onClick={() => handleLeadAllowToggle(lead.id, !lead.allowed)}
															disabled={updatingLeadId === lead.id}
															className={cn(
																"text-[10px] px-2 py-1 border transition-colors cursor-pointer disabled:opacity-50 font-semibold tracking-wider uppercase font-mono",
																lead.allowed 
																	? "bg-emerald-950/40 border-emerald-800 text-emerald-400" 
																	: "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white"
															)}
														>
															{lead.allowed ? 'Allowed' : 'Allow'}
														</button>
														<button
															onClick={() => handleLeadDelete(lead.id)}
															className="p-1.5 text-red-500 hover:bg-red-950/20 border border-transparent hover:border-red-900/40 transition-colors cursor-pointer"
															title="Delete Lead"
														>
															<Trash2Icon className="size-3.5" />
														</button>
													</div>
												</div>
												{lead.notes && (
													<div className="mt-2 text-[11px] text-zinc-500 italic border-t border-zinc-800/60 pt-1.5">
														{lead.notes}
													</div>
												)}
												{lead.sourceUrl && (
													<a href={lead.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-brand-500 hover:text-brand-400 hover:underline mt-1 inline-block">
														View source →
													</a>
												)}
											</div>
										);
									})}
								</div>
							)}
						</div>
					);
				})()}

				{activeTab === 'super_admin' && isSuperAdmin && (
					<div className="space-y-6">
						<div className="flex items-center justify-between border-b border-zinc-800 pb-3">
							<div>
								<h2 className="text-xl font-bold text-white flex items-center gap-2 font-sans">
									<ServerIcon className="size-5 text-brand-400" />
									Super Admin Dashboard
								</h2>
								<p className="text-zinc-400 text-sm mt-0.5">Allocate admin directories and configure page-level access permissions</p>
							</div>
						</div>

						{superAdminMsg && (
							<div className={cn("p-3 text-xs border font-mono", superAdminMsg.type === 'success' ? "bg-emerald-950/30 border-emerald-800 text-emerald-400" : "bg-red-950/30 border-red-800 text-red-400")}>
								{superAdminMsg.text}
							</div>
						)}

						{allocatedLink && (
							<div className="p-4 bg-brand-950/20 border border-brand-800/80 space-y-2">
								<h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Generated Invitation Link</h4>
								<p className="text-zinc-400 text-xs">Send this URL to the invited admin. They will be directed to the login page with their email prefilled:</p>
								<div className="flex items-center gap-2">
									<input
										type="text"
										readOnly
										value={allocatedLink}
										className="flex-1 bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs p-2 focus:outline-none"
									/>
									<button
										onClick={() => {
											navigator.clipboard.writeText(allocatedLink);
											alert('Invite URL copied to clipboard!');
										}}
										className="bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold px-4 py-2 cursor-pointer transition-colors"
									>
										Copy Link
									</button>
								</div>
							</div>
						)}

						<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
							{/* Allocation Form */}
							<div className="lg:col-span-1 bg-zinc-900/30 border border-zinc-800 p-5 space-y-4">
								<h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider border-b border-zinc-800 pb-2 font-mono">Allocate New Admin</h3>
								<form onSubmit={handleAllocateAdmin} className="space-y-4">
									<div className="space-y-1">
										<label className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold font-mono">Admin Email Address</label>
										<input
											type="email"
											required
											value={newAdminEmail}
											onChange={e => setNewAdminEmail(e.target.value)}
											placeholder="e.g. admin@domain.com"
											className="w-full bg-zinc-950 border border-zinc-800 text-white text-xs p-2.5 focus:outline-none focus:ring-1 focus:ring-brand-600"
										/>
									</div>
									<div className="space-y-1">
										<label className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold font-mono">Organization Name</label>
										<input
											type="text"
											required
											value={newAdminOrgName}
											onChange={e => setNewAdminOrgName(e.target.value)}
											placeholder="e.g. Acme Corp"
											className="w-full bg-zinc-950 border border-zinc-800 text-white text-xs p-2.5 focus:outline-none focus:ring-1 focus:ring-brand-600"
										/>
									</div>
									<div className="space-y-1">
										<label className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold font-mono">Initial Password</label>
										<input
											type="password"
											required
											value={newAdminPassword}
											onChange={e => setNewAdminPassword(e.target.value)}
											placeholder="admin123"
											className="w-full bg-zinc-950 border border-zinc-800 text-white text-xs p-2.5 focus:outline-none focus:ring-1 focus:ring-brand-600"
										/>
									</div>

									{/* Permission Toggles */}
									<div className="space-y-2">
										<label className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold block font-mono">Select Allowed Pages</label>
										<div className="grid grid-cols-1 gap-2 max-h-[220px] overflow-y-auto border border-zinc-850 p-2.5 bg-zinc-950/40">
											{[
												{ id: 'overview', name: 'Overview Stats' },
												{ id: 'employees', name: 'Employees Directory' },
												{ id: 'task_allocation', name: 'Task Allocation' },
												{ id: 'attendance', name: 'Attendance Logs' },
												{ id: 'leaves', name: 'Leave Requests' },
												{ id: 'clients', name: 'Clients Tab' },
												{ id: 'messages', name: 'Chat Messages' },
												{ id: 'system_status', name: 'System Resource Status' },
												{ id: 'events', name: 'Events Calendar' },
												{ id: 'work_submissions', name: 'Work Submissions' },
												{ id: 'leads', name: 'Leads CRM Pipeline' }
											].map(item => (
												<label key={item.id} className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer hover:text-white select-none">
													<input
														type="checkbox"
														checked={newAdminPages.includes(item.id)}
														onChange={() => togglePagePermission(item.id)}
														className="rounded bg-zinc-950 border-zinc-800 text-brand-600 focus:ring-brand-600"
													/>
													<span>{item.name}</span>
												</label>
											))}
										</div>
									</div>

									<button
										type="submit"
										disabled={isAllocating}
										className="w-full bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold py-2.5 cursor-pointer transition-colors disabled:opacity-50 font-mono"
									>
										{isAllocating ? 'Allocating Admin...' : 'Allocate Admin'}
									</button>
								</form>
							</div>

							{/* Directory list */}
							<div className="lg:col-span-2 bg-zinc-900/30 border border-zinc-800 p-5 space-y-4">
								<h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider border-b border-zinc-800 pb-2 font-mono">Active Admin Directories</h3>
								<div className="overflow-x-auto">
									<table className="w-full text-left border-collapse text-xs">
										<thead>
											<tr className="bg-zinc-900/60 border-b border-zinc-800 text-zinc-400 font-mono uppercase tracking-wider text-[10px]">
												<th className="p-3 font-semibold">Admin Email</th>
												<th className="p-3 font-semibold">Organization</th>
												<th className="p-3 font-semibold">Page Access</th>
												<th className="p-3 font-semibold text-right">Action</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-zinc-900">
											{adminsList.map((adm: any) => (
												<tr key={adm.id} className="hover:bg-zinc-900/10 transition-colors">
													<td className="p-3 font-bold text-white font-mono">{adm.email}</td>
													<td className="p-3 text-zinc-300">{adm.organizationName || 'WrkSpace Headquarters'}</td>
													<td className="p-3 text-zinc-400 max-w-[240px] truncate" title={adm.allowedPages || ''}>
														{adm.allowedPages ? (
															<div className="flex flex-wrap gap-1">
																{(adm.allowedPages || '').split(',').map((p: string) => (
																	<span key={p} className="text-[9px] px-1 bg-zinc-850 border border-zinc-800 text-zinc-400 capitalize">
																		{p.replace('_', ' ')}
																	</span>
																))}
															</div>
														) : '—'}
													</td>
													<td className="p-3 text-right">
														{adm.email.toLowerCase() !== 'webstrixx@gmail.com' ? (
															<div className="flex justify-end gap-2">
																<button
																	onClick={() => {
																		const inviteUrl = `${window.location.origin}/admin?invite=${adm.inviteToken}`;
																		navigator.clipboard.writeText(inviteUrl);
																		alert('Invite URL copied to clipboard!');
																	}}
																	className="text-[10px] text-brand-400 hover:text-brand-300 hover:underline font-semibold"
																>
																	Invite URL
																</button>
																<button
																	onClick={() => handleDeleteAdmin(adm.email)}
																	className="text-[10px] text-red-500 hover:text-red-400 hover:underline font-semibold"
																>
																	Revoke
																</button>
															</div>
														) : (
															<span className="text-[10px] text-zinc-600 font-mono italic">Primary Super Admin</span>
														)}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</div>
						</div>
					</div>
				)}

			</div>
		</main>
	);
}
