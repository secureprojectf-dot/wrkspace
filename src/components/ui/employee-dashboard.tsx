'use client';

import React, { useState, useEffect } from 'react';
import { Button } from './button';
import { 
	CalendarIcon, 
	ClockIcon, 
	BriefcaseIcon, 
	LogOutIcon, 
	MapPinIcon, 
	Grid2x2PlusIcon,
	RefreshCwIcon,
	BarChart2Icon,
	UploadIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
	getEmployeeTasks,
	updateTaskStatus,
	requestLeave,
	getEmployeeLeaves,
	clockIn,
	clockOut,
	getEmployeeAttendance,
	getCurrentAttendanceStatus,
	getEvents,
	createWorkSubmission,
	getEmployeeWorkSubmissions,
	getLeads,
	updateLeadStatus,
	bulkImportLeads,
	createManualLead,
} from '@/app/admin/actions';
import { MessagesView } from './messages-view';

type EmpTabType = 'overview' | 'tasks' | 'attendance' | 'leaves' | 'messages' | 'events' | 'work_submission' | 'leads' | 'profile';

interface EmployeeDashboardProps {
	employee: any;
	onLogout: () => void;
}

export function EmployeeDashboard({ employee, onLogout }: EmployeeDashboardProps) {
	const [activeTab, setActiveTab] = useState<EmpTabType>('overview');
	const [empTasks, setEmpTasks] = useState<any[]>([]);
	const [isTasksLoading, setIsTasksLoading] = useState(false);

	// Employee Dashboard attendance states
	const [attendanceStatus, setAttendanceStatus] = useState<'checked_out' | 'checked_in'>('checked_out');
	const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
	const [currentTime, setCurrentTime] = useState(new Date());

	const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
	const [leaveStart, setLeaveStart] = useState('');
	const [leaveEnd, setLeaveEnd] = useState('');
	const [leaveType, setLeaveType] = useState('Annual Leave');
	const [leaveReason, setLeaveReason] = useState('');
	const [leaveMsg, setLeaveMsg] = useState<string | null>(null);
	const [geofenceError, setGeofenceError] = useState<string | null>(null);

	// Events state
	const [eventsList, setEventsList] = useState<any[]>([]);
	const [eventsLoading, setEventsLoading] = useState(false);

	const loadEvents = async () => {
		setEventsLoading(true);
		try {
			const data = await getEvents();
			setEventsList(data);
		} catch (e) {
			console.error('Failed to load events:', e);
		} finally {
			setEventsLoading(false);
		}
	};

	// Work Submission state
	const [mySubmissions, setMySubmissions] = useState<any[]>([]);
	const [subTitle, setSubTitle] = useState('');
	const [subDescription, setSubDescription] = useState('');
	const [subTaskId, setSubTaskId] = useState('');
	const [subHours, setSubHours] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [subMessage, setSubMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

	const loadMySubmissions = async () => {
		try {
			const data = await getEmployeeWorkSubmissions(employee.id);
			setMySubmissions(data);
		} catch (e) {
			console.error('Failed to load submissions:', e);
		}
	};

	const handleWorkSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSubmitting(true);
		setSubMessage(null);
		const linkedTask = empTasks.find(t => t.id === subTaskId);
		const result = await createWorkSubmission({
			employeeId: employee.id,
			employeeName: `${employee.firstName} ${employee.lastName}`,
			title: subTitle,
			description: subDescription,
			taskId: linkedTask?.id || undefined,
			taskTitle: linkedTask?.title || undefined,
			hoursSpent: parseFloat(subHours) || 0,
		});
		if (result.success) {
			setSubMessage({ type: 'success', text: 'Work submitted successfully! The admin will review it shortly.' });
			setSubTitle('');
			setSubDescription('');
			setSubTaskId('');
			setSubHours('');
			await loadMySubmissions();
		} else {
			setSubMessage({ type: 'error', text: result.error || 'Failed to submit work.' });
		}
		setIsSubmitting(false);
	};

	// Leads state
	const [leadsList, setLeadsList] = useState<any[]>([]);
	const [leadsFilter, setLeadsFilter] = useState('All');
	const [leadsSourceFilter, setLeadsSourceFilter] = useState('All');
	const [leadsSearch, setLeadsSearch] = useState('');
	const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
	const [importLoading, setImportLoading] = useState(false);
	const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);

	// Manual Leads sub-tab & form states
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
				assignedTo: employee.id, // Manually added leads are assigned to the employee who added them
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
				setShowManualForm(false);
				await loadLeads();
			} else {
				setManualLeadMsg({ type: 'error', text: result.error || 'Failed to create lead.' });
			}
		} catch (err: any) {
			setManualLeadMsg({ type: 'error', text: err.message || 'Error occurred.' });
		} finally {
			setIsSavingManualLead(false);
		}
	};

	const loadLeads = async () => {
		try {
			const data = await getLeads({ allowed: true });
			setLeadsList(data);
		} catch (e) {
			console.error('Failed to load leads:', e);
		}
	};

	const handleLeadStatusUpdate = async (id: string, status: string) => {
		setUpdatingLeadId(id);
		await updateLeadStatus(id, status);
		await loadLeads();
		setUpdatingLeadId(null);
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
				await loadLeads();
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

	const OFFICE_LAT = 17.5383;
	const OFFICE_LON = 78.4809;
	const ALLOWED_RADIUS_METERS = 250;

	const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
		const R = 6371e3; // Earth's radius in meters
		const phi1 = (lat1 * Math.PI) / 180;
		const phi2 = (lat2 * Math.PI) / 180;
		const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
		const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

		const a =
			Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
			Math.cos(phi1) *
				Math.cos(phi2) *
				Math.sin(deltaLambda / 2) *
				Math.sin(deltaLambda / 2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

		return R * c; // Distance in meters
	};

	useEffect(() => {
		const timer = setInterval(() => {
			setCurrentTime(new Date());
		}, 1000);
		return () => clearInterval(timer);
	}, []);

	useEffect(() => {
		if (employee?.id) {
			loadEmployeeTasks(employee.id);
			loadEmployeeLeaves(employee.id);
			loadEmployeeAttendance(employee.id);
			loadEmployeeAttendanceStatus(employee.id);
		}
	}, [employee?.id]);

	const loadEmployeeTasks = async (empId: string) => {
		setIsTasksLoading(true);
		try {
			const tasks = await getEmployeeTasks(empId);
			setEmpTasks(tasks);
		} catch (error) {
			console.error('Failed to load employee tasks:', error);
		} finally {
			setIsTasksLoading(false);
		}
	};

	const loadEmployeeLeaves = async (empId: string) => {
		try {
			const leaves = await getEmployeeLeaves(empId);
			setLeaveRequests(leaves);
		} catch (error) {
			console.error('Failed to load employee leaves:', error);
		}
	};

	const loadEmployeeAttendance = async (empId: string) => {
		try {
			const logs = await getEmployeeAttendance(empId);
			setAttendanceLogs(logs);
		} catch (error) {
			console.error('Failed to load employee attendance:', error);
		}
	};

	const loadEmployeeAttendanceStatus = async (empId: string) => {
		try {
			const res = await getCurrentAttendanceStatus(empId);
			setAttendanceStatus(res.status as 'checked_in' | 'checked_out');
		} catch (error) {
			console.error('Failed to load attendance status:', error);
		}
	};

	const handleCheckIn = async () => {
		if (!employee) return;
		setGeofenceError(null);

		if (!navigator.geolocation) {
			setGeofenceError("Geolocation is not supported by your browser.");
			return;
		}

		navigator.geolocation.getCurrentPosition(
			async (position) => {
				const { latitude, longitude } = position.coords;
				const distance = calculateDistance(latitude, longitude, OFFICE_LAT, OFFICE_LON);
				if (distance > ALLOWED_RADIUS_METERS) {
					setGeofenceError(`Access Denied: You are outside the corporate geofence perimeter of STUDENT FORGE Hyderabad Office. You are currently ~${Math.round(distance)}m away.`);
					return;
				}

				try {
					const res = await clockIn(employee.id, `${employee.firstName} ${employee.lastName}`);
					if (res.success) {
						setAttendanceStatus('checked_in');
						loadEmployeeAttendance(employee.id);
					} else {
						setGeofenceError(res.error || 'Failed to clock in');
					}
				} catch (error) {
					console.error("Failed to clock in:", error);
					setGeofenceError("A server error occurred during Clock In.");
				}
			},
			(error) => {
				setGeofenceError("Location Access Required: Please enable location permissions in your browser to check in.");
			}
		);
	};

	const handleCheckOut = async () => {
		if (!employee) return;
		setGeofenceError(null);

		if (!navigator.geolocation) {
			setGeofenceError("Geolocation is not supported by your browser.");
			return;
		}

		navigator.geolocation.getCurrentPosition(
			async (position) => {
				const { latitude, longitude } = position.coords;
				const distance = calculateDistance(latitude, longitude, OFFICE_LAT, OFFICE_LON);
				if (distance > ALLOWED_RADIUS_METERS) {
					setGeofenceError(`Access Denied: You are outside the corporate geofence perimeter of STUDENT FORGE Hyderabad Office. You are currently ~${Math.round(distance)}m away.`);
					return;
				}

				try {
					const res = await clockOut(employee.id);
					if (res.success) {
						setAttendanceStatus('checked_out');
						loadEmployeeAttendance(employee.id);
					} else {
						setGeofenceError(res.error || 'Failed to clock out');
					}
				} catch (error) {
					console.error("Failed to clock out:", error);
					setGeofenceError("A server error occurred during Clock Out.");
				}
			},
			(error) => {
				setGeofenceError("Location Access Required: Please enable location permissions in your browser to check out.");
			}
		);
	};

	const handleRequestLeave = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!leaveStart || !leaveEnd || !leaveReason) {
			setLeaveMsg('Please fill out all request fields.');
			return;
		}
		
		try {
			const res = await requestLeave({
				employeeId: employee.id,
				employeeName: `${employee.firstName} ${employee.lastName}`,
				startDate: leaveStart,
				endDate: leaveEnd,
				type: leaveType,
				reason: leaveReason
			});
			
			if (res.success) {
				setLeaveStart('');
				setLeaveEnd('');
				setLeaveReason('');
				setLeaveMsg('Leave request submitted successfully!');
				loadEmployeeLeaves(employee.id);
				setTimeout(() => setLeaveMsg(null), 3000);
			} else {
				setLeaveMsg(res.error || 'Failed to submit leave request.');
			}
		} catch (err: any) {
			setLeaveMsg('An unexpected error occurred while submitting.');
		}
	};

	return (
		<main className={cn(
			"bg-zinc-950 text-white relative flex flex-col font-sans",
			activeTab === 'messages' ? "h-screen overflow-hidden" : "min-h-screen overflow-y-auto"
		)}>
			{/* Premium background radial glow */}
			<div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.03),transparent_70%)] z-0 pointer-events-none" />

			{/* Full Width Top Navbar */}
			<header className="w-full border-b border-zinc-900 bg-zinc-950 sticky top-0 z-50 shadow-md shadow-black/40">
				<div className="w-full px-6 md:px-10 h-20 flex items-center justify-between">
					<div className="flex items-center gap-4">
						<img src="https://ik.imagekit.io/dypkhqxip/logogog" alt="WrkSpace Logo" className="h-8 w-auto object-contain" />
						<div className="w-px h-7 bg-zinc-800" />
						<div className="flex flex-col justify-center">
							<p className="text-xs text-zinc-500 font-medium">Logged in as</p>
							<p className="text-sm text-white font-semibold leading-tight">{employee.firstName} {employee.lastName} <span className="text-zinc-500 font-normal text-xs">· {employee.id}</span></p>
						</div>
					</div>
					<div className="flex items-center gap-3">
						<Button 
							variant="outline" 
							className="border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:bg-zinc-800 hover:text-white hover:border-zinc-700 cursor-pointer rounded-none transition-all duration-200 text-xs py-2.5 px-4 h-auto font-medium"
							onClick={onLogout}
						>
							<LogOutIcon className="size-3.5 me-2 text-red-400" />
							Logout
						</Button>
					</div>
				</div>
			</header>

			{/* Subnavbar */}
			<div className="w-full border-b-2 border-brand-700 bg-brand-950 z-40 sticky top-20 shadow-lg shadow-brand-950/60" style={{backgroundImage: 'linear-gradient(180deg, #1a1040 0%, #0f0824 100%)'}}>
				<div className="w-full px-6 md:px-10 flex gap-6 text-xs md:text-sm font-medium tracking-wide overflow-x-auto">
					<button 
						onClick={() => setActiveTab('overview')}
						className={cn(
							"py-3.5 border-b-2 transition-all cursor-pointer",
							activeTab === 'overview' ? 'border-brand-400 text-white font-semibold' : 'border-transparent text-brand-300/50 hover:text-white'
						)}
					>
						Overview
					</button>
					<button 
						onClick={() => {
							setActiveTab('tasks');
							loadEmployeeTasks(employee.id);
						}}
						className={cn(
							"py-3.5 border-b-2 transition-all cursor-pointer",
							activeTab === 'tasks' ? 'border-brand-400 text-white font-semibold' : 'border-transparent text-brand-300/50 hover:text-white'
						)}
					>
						My Allocated Tasks ({empTasks.length})
					</button>
					<button 
						onClick={() => {
							setActiveTab('attendance');
							loadEmployeeAttendance(employee.id);
							loadEmployeeAttendanceStatus(employee.id);
						}}
						className={cn(
							"py-3.5 border-b-2 transition-all cursor-pointer",
							activeTab === 'attendance' ? 'border-brand-400 text-white font-semibold' : 'border-transparent text-brand-300/50 hover:text-white'
						)}
					>
						Attendance logs
					</button>
					<button 
						onClick={() => {
							setActiveTab('leaves');
							loadEmployeeLeaves(employee.id);
						}}
						className={cn(
							"py-3.5 border-b-2 transition-all cursor-pointer",
							activeTab === 'leaves' ? 'border-brand-400 text-white font-semibold' : 'border-transparent text-brand-300/50 hover:text-white'
						)}
					>
						Apply Leaves
					</button>
					<button 
						onClick={() => {
							setActiveTab('messages');
						}}
						className={cn(
							"py-3.5 border-b-2 transition-all cursor-pointer",
							activeTab === 'messages' ? 'border-brand-400 text-white font-semibold' : 'border-transparent text-brand-300/50 hover:text-white'
						)}
					>
						Messages
					</button>
						<button 
						onClick={() => {
							setActiveTab('events');
							loadEvents();
						}}
						className={cn(
							"py-3.5 border-b-2 transition-all cursor-pointer",
							activeTab === 'events' ? 'border-brand-400 text-white font-semibold' : 'border-transparent text-brand-300/50 hover:text-white'
						)}
					>
						Events
					</button>
					<button 
						onClick={() => {
							setActiveTab('work_submission');
							loadMySubmissions();
						}}
						className={cn(
							"py-3.5 border-b-2 transition-all cursor-pointer",
							activeTab === 'work_submission' ? 'border-brand-400 text-white font-semibold' : 'border-transparent text-brand-300/50 hover:text-white'
						)}
					>
							Work Submission
					</button>
					<button
						onClick={() => {
							setActiveTab('leads');
							loadLeads();
						}}
						className={cn(
							"py-3.5 border-b-2 transition-all cursor-pointer whitespace-nowrap",
							activeTab === 'leads' ? 'border-brand-400 text-white font-semibold' : 'border-transparent text-brand-300/50 hover:text-white'
						)}
					>
						Leads
					</button>
					<button
						onClick={() => {
							setActiveTab('profile');
						}}
						className={cn(
							"py-3.5 border-b-2 transition-all cursor-pointer whitespace-nowrap",
							activeTab === 'profile' ? 'border-brand-400 text-white font-semibold' : 'border-transparent text-brand-300/50 hover:text-white'
						)}
					>
						Profile
					</button>
				</div>
			</div>

			{/* Main dashboard content container */}
			<div className={cn(
				"flex-1 w-full relative z-10",
				activeTab === 'messages' ? "h-[calc(100vh-128px)] flex flex-col" : "max-w-[90rem] mx-auto px-6 md:px-10 py-8 space-y-6"
			)}>

				{/* TAB: OVERVIEW */}
				{activeTab === 'overview' && (
					<div className="space-y-6">
						{/* Welcome banner */}
						<div className="bg-zinc-900/30 border border-zinc-800/80 p-8 rounded-none space-y-4">
							<h2 className="text-xl md:text-2xl font-bold text-white">Welcome back, <span className="text-brand-400 font-extrabold">{employee.firstName}</span>!</h2>
							<p className="text-zinc-400 text-xs md:text-sm max-w-2xl leading-relaxed">
								Access your personal workspace telemetry dashboard console. Below is your directory profile classification registry and active lead status assignment.
							</p>
							<div className="border border-zinc-800 bg-zinc-950/40 grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-zinc-800 rounded-none">
								<div className="p-4 space-y-1">
									<span className="text-[10px] text-zinc-550 uppercase font-mono tracking-wider font-bold">Registered ID</span>
									<p className="font-mono text-brand-400 text-sm font-bold">{employee.id}</p>
								</div>
								<div className="p-4 space-y-1">
									<span className="text-[10px] text-zinc-550 uppercase font-mono tracking-wider font-bold">Allocated Wing</span>
									<p className="text-white text-sm font-semibold">{employee.wingName}</p>
								</div>
								<div className="p-4 space-y-1">
									<span className="text-[10px] text-zinc-550 uppercase font-mono tracking-wider font-bold">Wing Lead</span>
									<p className="text-white text-sm font-medium">{employee.wingLeadName}</p>
								</div>
								<div className="p-4 space-y-1">
									<span className="text-[10px] text-zinc-550 uppercase font-mono tracking-wider font-bold">Registry Date</span>
									<p className="text-white font-mono text-sm">{new Date(employee.createdAt).toLocaleDateString()}</p>
								</div>
							</div>
						</div>

						{/* Stats grids */}
						<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
							<div className="bg-zinc-900/30 border border-zinc-800 p-6 space-y-2">
								<BriefcaseIcon className="size-5 text-indigo-400" />
								<p className="text-zinc-400 text-xs font-medium">My Tasks Assigned</p>
								<p className="text-3xl font-bold text-white">{empTasks.length}</p>
							</div>
							<div className="bg-zinc-900/30 border border-zinc-800 p-6 space-y-2">
								<ClockIcon className="size-5 text-emerald-400" />
								<p className="text-zinc-400 text-xs font-medium">Attendance Status</p>
								<p className={cn(
									"text-3xl font-bold",
									attendanceStatus === 'checked_in' ? 'text-emerald-400' : 'text-zinc-400'
								)}>
									{attendanceStatus === 'checked_in' ? 'Clocked In' : 'Clocked Out'}
								</p>
							</div>
							<div className="bg-zinc-900/30 border border-zinc-800 p-6 space-y-2">
								<CalendarIcon className="size-5 text-amber-400" />
								<p className="text-zinc-400 text-xs font-medium">Pending Leave Requests</p>
								<p className="text-3xl font-bold text-white">
									{leaveRequests.filter(req => req.status === 'Pending').length}
								</p>
							</div>
						</div>
					</div>
				)}

				{/* TAB: TASKS */}
				{activeTab === 'tasks' && (
					<div className="bg-zinc-900/30 border border-zinc-800/80 p-6 space-y-4 rounded-none">
						<div className="flex justify-between items-center border-b border-zinc-800 pb-3">
							<h3 className="text-sm font-semibold text-white uppercase tracking-wider">
								My Tasks Directory
							</h3>
							<button 
								onClick={() => loadEmployeeTasks(employee.id)}
								className="p-1 border border-zinc-800 bg-zinc-900/20 hover:bg-zinc-850 hover:border-zinc-700 text-zinc-400 hover:text-white transition-all rounded-none cursor-pointer"
							>
								<RefreshCwIcon className={cn("size-3.5", isTasksLoading && "animate-spin")} />
							</button>
						</div>

						{empTasks.length === 0 ? (
							<p className="text-zinc-500 text-xs italic py-6 text-center">No tasks are currently allocated to you.</p>
						) : (
							<div className="overflow-x-auto">
								<table className="w-full text-left text-xs border-collapse">
									<thead>
										<tr className="border-b border-zinc-800 text-zinc-400 uppercase font-mono text-[10px] bg-zinc-950/40">
											<th className="p-3">Task Details</th>
											<th className="p-3">Reporting Manager</th>
											<th className="p-3">Deadline</th>
											<th className="p-3">Mode</th>
											<th className="p-3">Status</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-zinc-800/50">
										{empTasks.map((task: any) => (
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
													<div className="text-[10px] text-zinc-550 mt-1 max-w-lg leading-relaxed">{task.description}</div>
												</td>
												<td className="p-3 whitespace-nowrap text-zinc-300 font-medium">{task.reportingTo}</td>
												<td className="p-3 whitespace-nowrap font-mono text-zinc-450">{new Date(task.deadline).toLocaleDateString()}</td>
												<td className="p-3 whitespace-nowrap">
													<span className={cn(
														"px-2 py-0.5 text-[10px] uppercase font-bold border",
														task.mode === 'Remote' && "bg-cyan-950/20 text-cyan-400 border-cyan-900/50",
														task.mode === 'Onsite' && "bg-amber-950/20 text-amber-400 border-amber-900/50",
														task.mode === 'Hybrid' && "bg-purple-950/20 text-purple-400 border-purple-900/50"
													)}>
														{task.mode}
													</span>
												</td>
												<td className="p-3 whitespace-nowrap">
													<select
														value={task.status}
														onChange={async (e) => {
															const newStatus = e.target.value;
															try {
																await updateTaskStatus(task.id, newStatus);
																loadEmployeeTasks(employee.id);
															} catch (err) {
																console.error("Failed to update status", err);
															}
														}}
														className={cn(
															"px-2 py-1 text-[10px] uppercase font-mono font-bold border bg-zinc-950 text-white outline-none cursor-pointer focus:border-zinc-700 transition-colors rounded-none",
															task.status === 'Completed' && "text-emerald-400 border-emerald-900/50",
															task.status === 'In Progress' && "text-blue-400 border-blue-900/50",
															task.status === 'Pending' && "text-yellow-400 border-yellow-900/50"
														)}
													>
														<option value="Pending" className="bg-zinc-950 text-yellow-400 font-bold">Pending</option>
														<option value="In Progress" className="bg-zinc-950 text-blue-400 font-bold">In Progress</option>
														<option value="Completed" className="bg-zinc-950 text-emerald-400 font-bold">Completed</option>
													</select>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</div>
				)}

				{/* TAB: ATTENDANCE */}
				{activeTab === 'attendance' && (
					<div className="space-y-6">
						{geofenceError && (
							<div className="bg-red-600/10 border border-red-600/25 p-4 rounded-none text-xs text-red-400 font-mono flex items-start gap-2.5 transition-all">
								<span className="font-bold uppercase bg-red-600 text-white px-1.5 py-0.5 text-[9px] tracking-wider shrink-0">Geofence Alert</span>
								<span>{geofenceError}</span>
							</div>
						)}

						{/* Top Timer & Action Container */}
						<div className="bg-zinc-900/30 border border-zinc-800 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-none">
							<div className="flex items-center gap-4 text-start">
								<div className="bg-brand-950/40 border border-brand-900/50 p-3 flex items-center justify-center">
									<ClockIcon className="size-6 text-brand-400" />
								</div>
								<div>
									<p className="text-[10px] text-zinc-550 uppercase font-mono tracking-wider font-bold">Workspace Standard Clock</p>
									<p className="text-xl md:text-2xl font-bold font-mono text-white tracking-wider">
										{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
									</p>
									<p className="text-[10px] text-zinc-400 mt-0.5">
										{currentTime.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
									</p>
									<div className="flex items-center gap-1 text-[9px] text-indigo-400 mt-1 uppercase font-mono tracking-wider font-semibold">
										<MapPinIcon className="size-3 text-indigo-400" />
										<span>Geofence Perim: STUDENT FORGE Kompally Office (Hyderabad)</span>
									</div>
								</div>
							</div>
							
							<div className="w-full sm:w-auto">
								{attendanceStatus === 'checked_out' ? (
									<Button 
										onClick={handleCheckIn}
										className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2.5 px-6 rounded-none cursor-pointer h-12 w-full sm:w-auto transition-colors"
									>
										Clock In Shift
									</Button>
								) : (
									<Button 
										onClick={handleCheckOut}
										className="bg-red-600 hover:bg-red-500 text-white text-xs font-semibold py-2.5 px-6 rounded-none cursor-pointer h-12 w-full sm:w-auto transition-colors"
									>
										Clock Out Shift
									</Button>
								)}
							</div>
						</div>

						{/* Attendance Logs Table */}
						<div className="bg-zinc-900/30 border border-zinc-800 p-6 space-y-4 rounded-none">
							<h3 className="text-sm font-semibold text-white uppercase tracking-wider border-b border-zinc-800 pb-2">
								Attendance Shift Registry
							</h3>
							{attendanceLogs.length === 0 ? (
								<div className="text-zinc-500 text-xs italic py-6 text-center">
									No attendance logs have been recorded in the database.
								</div>
							) : (
								<div className="overflow-x-auto">
									<table className="w-full text-left text-xs border-collapse">
										<thead>
											<tr className="border-b border-zinc-800 text-zinc-400 uppercase font-mono text-[10px] bg-zinc-950/40">
												<th className="p-3">Date</th>
												<th className="p-3">Check-In Time</th>
												<th className="p-3">Check-Out Time</th>
												<th className="p-3">Status</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-zinc-800/50 font-mono text-zinc-300">
											{attendanceLogs.map((log) => (
												<tr key={log.id} className="hover:bg-zinc-900/20 transition-colors">
													<td className="p-3 font-semibold text-white">{log.date}</td>
													<td className="p-3 text-zinc-400">{log.checkIn}</td>
													<td className="p-3 text-zinc-400">{log.checkOut || '--'}</td>
													<td className="p-3">
														<span className={cn(
															"px-2 py-0.5 text-[10px] font-bold border uppercase whitespace-nowrap",
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
					</div>
				)}

				{/* TAB: LEAVES */}
				{activeTab === 'leaves' && (
					<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
						{/* Form Request block */}
						<form onSubmit={handleRequestLeave} className="bg-zinc-900/30 border border-zinc-800 p-6 space-y-4 rounded-none h-fit">
							<h3 className="text-sm font-semibold text-white uppercase tracking-wider border-b border-zinc-800 pb-2">
								Request Leave Time
							</h3>
							
							{leaveMsg && (
								<div className="p-2 border border-indigo-900 bg-indigo-950/20 text-indigo-300 text-xs font-mono">
									{leaveMsg}
								</div>
							)}

							<div className="space-y-1">
								<label className="text-[10px] uppercase font-mono tracking-wider font-semibold text-zinc-555">Start Date</label>
								<input 
									type="date" 
									required
									value={leaveStart}
									onChange={(e) => setLeaveStart(e.target.value)}
									className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-none p-2.5 text-xs outline-none focus:border-zinc-700 transition-colors"
								/>
							</div>

							<div className="space-y-1">
								<label className="text-[10px] uppercase font-mono tracking-wider font-semibold text-zinc-555">End Date</label>
								<input 
									type="date" 
									required
									value={leaveEnd}
									onChange={(e) => setLeaveEnd(e.target.value)}
									className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-none p-2.5 text-xs outline-none focus:border-zinc-700 transition-colors"
								/>
							</div>

							<div className="space-y-1">
								<label className="text-[10px] uppercase font-mono tracking-wider font-semibold text-zinc-555">Leave Category</label>
								<select 
									value={leaveType}
									onChange={(e) => setLeaveType(e.target.value)}
									className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-none p-2.5 text-xs outline-none focus:border-zinc-700 transition-colors"
								>
									<option value="Annual Leave">Annual Leave</option>
									<option value="Sick Leave">Sick Leave</option>
									<option value="Maternity/Paternity">Maternity/Paternity</option>
									<option value="Casual Leave">Casual Leave</option>
								</select>
							</div>

							<div className="space-y-1">
								<label className="text-[10px] uppercase font-mono tracking-wider font-semibold text-zinc-555">Reason / Justification</label>
								<textarea 
									rows={4}
									required
									value={leaveReason}
									onChange={(e) => setLeaveReason(e.target.value)}
									placeholder="Provide shift coverage justification..."
									className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-none p-2.5 text-xs outline-none focus:border-zinc-700 transition-colors resize-none placeholder-zinc-700"
								/>
							</div>

							<Button 
								type="submit"
								className="w-full bg-indigo-650 hover:bg-indigo-600 text-white text-xs font-semibold py-2.5 rounded-none cursor-pointer transition-colors"
							>
								Submit Leave Request
							</Button>
						</form>

						{/* Requested Leaves Registry List */}
						<div className="bg-zinc-900/30 border border-zinc-800 p-6 space-y-4 rounded-none lg:col-span-2">
							<h3 className="text-sm font-semibold text-white uppercase tracking-wider border-b border-zinc-800 pb-2">
								Requested Leaves Registry
							</h3>

							{leaveRequests.length === 0 ? (
								<p className="text-zinc-500 text-xs italic py-6 text-center">No leave requests have been logged.</p>
							) : (
								<div className="overflow-x-auto">
									<table className="w-full text-left text-xs border-collapse">
										<thead>
											<tr className="border-b border-zinc-800 text-zinc-400 uppercase font-mono text-[10px] bg-zinc-950/40">
												<th className="p-3">Category</th>
												<th className="p-3">Period</th>
												<th className="p-3">Reason</th>
												<th className="p-3 text-right">Status</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-zinc-800/50">
											{leaveRequests.map((req: any) => (
												<tr key={req.id} className="hover:bg-zinc-900/20 transition-colors">
													<td className="p-3 font-semibold text-white font-mono">{req.type}</td>
													<td className="p-3 text-zinc-400 whitespace-nowrap font-mono">
														{new Date(req.startDate).toLocaleDateString()} - {new Date(req.endDate).toLocaleDateString()}
													</td>
													<td className="p-3 text-zinc-550 max-w-xs truncate">{req.reason}</td>
													<td className="p-3 text-right">
														<span className={cn(
															"px-2 py-0.5 text-[10px] font-bold border uppercase whitespace-nowrap font-mono",
															req.status === 'Approved' && "bg-emerald-950/30 text-emerald-450 border-emerald-900/30",
															req.status === 'Pending' && "bg-yellow-950/30 text-yellow-450 border-yellow-900/30",
															req.status === 'Ignored' && "bg-zinc-900 text-zinc-400 border-zinc-800",
															req.status === 'Cancelled' && "bg-red-950/30 text-red-450 border-red-900/30"
														)}>
															{req.status}
														</span>
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

				{/* TAB: MESSAGES */}
				{activeTab === 'messages' && (
					<MessagesView 
						currentUser={{
							id: employee.id,
							name: `${employee.firstName} ${employee.lastName}`,
							email: employee.email,
							role: 'Employee'
						}}
					/>
				)}

				{/* TAB: EVENTS */}
				{activeTab === 'events' && (
					<div className="space-y-6">
						<div>
							<h2 className="text-xl font-bold text-white flex items-center gap-2">
								<CalendarIcon className="size-5 text-brand-400" />
								Company Events
							</h2>
							<p className="text-zinc-400 text-sm mt-0.5">Upcoming and ongoing events you may be participating in</p>
						</div>

						{eventsLoading ? (
							<div className="text-center py-16 text-zinc-600">
								<p className="text-sm">Loading events...</p>
							</div>
						) : eventsList.length === 0 ? (
							<div className="text-center py-16 text-zinc-600 border border-zinc-900">
								<CalendarIcon className="size-10 mx-auto mb-3 opacity-40" />
								<p className="text-sm font-medium">No events scheduled yet</p>
								<p className="text-xs mt-1">Check back later for upcoming company events</p>
							</div>
						) : (
							<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
								{eventsList.map((event: any) => {
									const reps: { id: string; name: string }[] = JSON.parse(event.representatives || '[]');
									const startD = new Date(event.startDate);
									const endD = new Date(event.endDate);
									const fmt = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
									const now = new Date();
									const isUpcoming = startD > now;
									const isOngoing = startD <= now && endD >= now;

									return (
										<div key={event.id} className="bg-zinc-900/30 border border-zinc-800/80 p-5 space-y-4 hover:border-brand-900/60 transition-colors">
											<div className="flex items-start justify-between gap-3">
												<div>
													<h3 className="text-base font-bold text-white">{event.title}</h3>
													<p className="text-xs text-brand-400 font-medium mt-0.5">{event.organisingCollege}</p>
												</div>
												<span className={`text-[10px] px-2 py-1 font-mono uppercase tracking-wider whitespace-nowrap border ${
													isOngoing
														? 'bg-emerald-950/40 border-emerald-900/40 text-emerald-300'
														: isUpcoming
														? 'bg-brand-950/40 border-brand-900/40 text-brand-300'
														: 'bg-zinc-800/40 border-zinc-700/40 text-zinc-500'
												}`}>
													{isOngoing ? 'Ongoing' : isUpcoming ? 'Upcoming' : 'Past'}
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
															<span key={i} className={`text-xs px-2 py-0.5 border ${
																reps.some(rep => rep.name === `${employee.firstName} ${employee.lastName}`)
																	? 'bg-brand-950/40 border-brand-900/40 text-brand-300'
																	: 'bg-zinc-800/60 border-zinc-700/60 text-zinc-300'
															}`}>
																{r.name}
																{r.name === `${employee.firstName} ${employee.lastName}` && (
																	<span className="ml-1 text-brand-400 font-bold">· You</span>
																)}
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

			{/* TAB: WORK SUBMISSION */}
				{activeTab === 'work_submission' && (
					<div className="space-y-8">
						{/* Submit Work Form */}
						<div className="space-y-4">
							<div>
								<h2 className="text-xl font-bold text-white flex items-center gap-2">
									<BriefcaseIcon className="size-5 text-brand-400" />
									Submit Your Work
								</h2>
								<p className="text-zinc-400 text-sm mt-0.5">Report completed work for admin review and approval</p>
							</div>

							{subMessage && (
								<div className={cn(
									"p-3 text-xs border font-mono",
									subMessage.type === 'success' ? "bg-emerald-950/30 border-emerald-800 text-emerald-400" : "bg-red-950/30 border-red-800 text-red-400"
								)}>
									{subMessage.text}
								</div>
							)}

							<form onSubmit={handleWorkSubmit} className="bg-zinc-900/30 border border-zinc-800/80 p-6 space-y-5">
								<h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider border-b border-zinc-800 pb-3">Work Details</h3>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div className="space-y-1.5">
										<label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Work Title *</label>
										<input
											type="text"
											value={subTitle}
											onChange={e => setSubTitle(e.target.value)}
											required
											placeholder="e.g. Completed landing page redesign"
											className="w-full bg-zinc-950 border border-zinc-800 text-white placeholder:text-zinc-600 rounded-none text-sm p-3 focus:outline-none focus:ring-1 focus:ring-brand-600"
										/>
									</div>
									<div className="space-y-1.5">
										<label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Hours Spent *</label>
										<input
											type="number"
											value={subHours}
											onChange={e => setSubHours(e.target.value)}
											required
											min="0.5"
											step="0.5"
											placeholder="e.g. 3.5"
											className="w-full bg-zinc-950 border border-zinc-800 text-white placeholder:text-zinc-600 rounded-none text-sm p-3 focus:outline-none focus:ring-1 focus:ring-brand-600"
										/>
									</div>
								</div>

								<div className="space-y-1.5">
									<label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Description of Work Done *</label>
									<textarea
										value={subDescription}
										onChange={e => setSubDescription(e.target.value)}
										required
										rows={4}
										placeholder="Describe what you accomplished, challenges overcome, and deliverables produced..."
										className="w-full bg-zinc-950 border border-zinc-800 text-white placeholder:text-zinc-600 rounded-none text-sm p-3 resize-none focus:outline-none focus:ring-1 focus:ring-brand-600"
									/>
								</div>

								{empTasks.length > 0 && (
									<div className="space-y-1.5">
										<label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Link to Task (Optional)</label>
										<select
											value={subTaskId}
											onChange={e => setSubTaskId(e.target.value)}
											className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-none text-sm p-3 focus:outline-none focus:ring-1 focus:ring-brand-600 cursor-pointer"
										>
											<option value="">— No linked task —</option>
											{empTasks.map((task: any) => (
												<option key={task.id} value={task.id}>
													{task.title} ({task.status})
												</option>
											))}
										</select>
									</div>
								)}

								<div className="flex justify-end pt-2 border-t border-zinc-800">
									<button
										type="submit"
										disabled={isSubmitting}
										className="bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold px-6 py-2.5 rounded-none cursor-pointer transition-colors disabled:opacity-50"
									>
										{isSubmitting ? 'Submitting...' : 'Submit Work'}
									</button>
								</div>
							</form>
						</div>

						{/* My Submission History */}
						<div className="space-y-4">
							<h3 className="text-sm font-bold text-zinc-300 flex items-center gap-2 border-b border-zinc-800 pb-3">
								<ClockIcon className="size-4 text-zinc-500" />
								My Submission History
							</h3>
							{mySubmissions.length === 0 ? (
								<div className="text-center py-12 text-zinc-600 border border-zinc-900">
									<p className="text-sm">No submissions yet. Submit your first work above.</p>
								</div>
							) : (
								<div className="space-y-3">
									{mySubmissions.map((sub: any) => {
										const statusColors: Record<string, string> = {
											'Submitted': 'bg-amber-950/30 border-amber-900/40 text-amber-300',
											'Reviewed': 'bg-blue-950/30 border-blue-900/40 text-blue-300',
											'Approved': 'bg-emerald-950/30 border-emerald-900/40 text-emerald-300',
											'Needs Revision': 'bg-red-950/30 border-red-900/40 text-red-300',
										};
										return (
											<div key={sub.id} className="bg-zinc-900/30 border border-zinc-800/80 p-4 space-y-2">
												<div className="flex items-start justify-between gap-3 flex-wrap">
													<div>
														<h4 className="text-sm font-semibold text-white">{sub.title}</h4>
														<p className="text-xs text-zinc-500 mt-0.5">
															{new Date(sub.submittedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
															{' · '}
															<span className="text-brand-400 font-medium">{sub.hoursSpent}h</span>
															{sub.taskTitle && <span> · Task: <span className="text-zinc-300">{sub.taskTitle}</span></span>}
														</p>
													</div>
													<span className={cn("text-[10px] px-2 py-1 font-mono uppercase tracking-wider border", statusColors[sub.status] || 'bg-zinc-800/40 border-zinc-700/40 text-zinc-400')}>
														{sub.status}
													</span>
												</div>
												<p className="text-xs text-zinc-500 leading-relaxed">{sub.description}</p>
												{sub.adminNote && (
													<div className="bg-zinc-900/60 border border-zinc-800 px-3 py-2 text-xs text-zinc-400 italic mt-1">
														<span className="text-zinc-500 not-italic font-semibold">Admin: </span>{sub.adminNote}
													</div>
												)}
											</div>
										);
									})}
								</div>
							)}
							</div>
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
										Leads Pipeline
									</h2>
									<p className="text-zinc-400 text-sm mt-0.5">{leadsList.filter(l => leadsSubTab === 'pipeline' ? l.source !== 'Manual' : l.source === 'Manual').length} total leads · {filtered.length} shown</p>
								</div>
								
								<div className="flex items-center gap-2 flex-wrap">
									{/* Sub-tab selection */}
									<div className="bg-zinc-950 border border-zinc-800 p-0.5 flex gap-0.5">
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

									{/* Action button conditional on subtab */}
									{leadsSubTab === 'pipeline' ? (
										<label className={cn(
											"flex items-center gap-2 text-[10px] font-semibold px-3 py-2.5 cursor-pointer transition-colors border",
											importLoading ? "bg-zinc-800 border-zinc-700 text-zinc-500 cursor-wait" : "bg-brand-700 hover:bg-brand-600 border-brand-600 text-white"
										)}>
											<UploadIcon className="size-3.5" />
											{importLoading ? 'Importing…' : 'Import leads_latest.json'}
											<input type="file" accept=".json" className="hidden" onChange={handleImportJson} disabled={importLoading} />
										</label>
									) : (
										<button
											onClick={() => setShowManualForm(!showManualForm)}
											className="bg-brand-600 hover:bg-brand-500 border border-brand-500 text-white text-[10px] font-semibold px-3 py-2.5 cursor-pointer transition-colors"
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

							{/* Feed Manual Lead Form */}
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

									<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

									<div className="flex justify-end pt-2 border-t border-zinc-800">
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
							<div className="flex gap-3 flex-wrap items-center">
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

							{/* Leads table */}
							{filtered.length === 0 ? (
								<div className="text-center py-16 border border-zinc-900 text-zinc-600">
									<BarChart2Icon className="size-10 mx-auto mb-3 opacity-30" />
									<p className="text-sm font-medium">No leads found</p>
									<p className="text-xs mt-1">
										{leadsSubTab === 'pipeline' 
											? 'Run the Python crawler and import the JSON file above' 
											: 'Add your first manual lead using the "Add Lead Manually" button above'}
									</p>
								</div>
							) : leadsSubTab === 'manual' ? (
								<div className="overflow-x-auto border border-zinc-800 bg-zinc-950/20">
									<table className="w-full text-left border-collapse text-xs">
										<thead>
											<tr className="bg-zinc-900/60 border-b border-zinc-800 text-zinc-400 font-mono uppercase tracking-wider text-[10px]">
												<th className="p-3 font-semibold">Business Name</th>
												<th className="p-3 font-semibold">Contact Person</th>
												<th className="p-3 font-semibold">Category / Location</th>
												<th className="p-3 font-semibold">Phone / Website</th>
												<th className="p-3 font-semibold">Notes / Description</th>
												<th className="p-3 font-semibold">Priority</th>
												<th className="p-3 font-semibold text-right">Status</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-zinc-900">
											{filtered.map((lead: any) => (
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
													<td className="p-3 text-right">
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
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							) : (
								<div className="space-y-2">
									{filtered.map((lead: any) => (
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
														{lead.website && <><span>·</span><a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:underline truncate max-w-[160px]">{lead.website.replace(/^https?:\/\//, '')}</a></>}
													</div>
													{lead.description && <p className="text-[11px] text-zinc-500 mt-1 line-clamp-2">{lead.description}</p>}
												</div>
												<div className="flex items-center gap-2 flex-shrink-0">
													<span className={cn("text-[9px] px-1.5 py-0.5 font-semibold uppercase tracking-wider", SOURCE_COLOURS[lead.source] || 'text-zinc-400')}>
														{lead.source}
													</span>
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
									))}
								</div>
							)}
						</div>
					);
				})()}

				{/* TAB: PROFILE */}
				{activeTab === 'profile' && (
					<div className="space-y-6">
						{/* Header */}
						<div>
							<h2 className="text-xl font-bold text-white flex items-center gap-2">
								<BriefcaseIcon className="size-5 text-brand-400" />
								Employee Profile
							</h2>
							<p className="text-zinc-400 text-sm mt-0.5">Your official corporate profile and organization details</p>
						</div>

						{/* Main Info Card */}
						<div className="bg-zinc-900/30 border border-zinc-800 p-8 rounded-none space-y-8">
							<div className="flex flex-col sm:flex-row items-center gap-6 pb-8 border-b border-zinc-850">
								<div className="size-20 bg-brand-900/60 border border-brand-700/50 flex items-center justify-center text-white text-3xl font-black rounded-none tracking-wider shadow-lg shadow-brand-950/40">
									{(employee.firstName?.[0] || '').toUpperCase()}{(employee.lastName?.[0] || '').toUpperCase()}
								</div>
								<div className="text-center sm:text-left space-y-1">
									<h3 className="text-xl font-bold text-white leading-tight">
										{employee.firstName} {employee.middleName ? `${employee.middleName} ` : ''}{employee.lastName}
									</h3>
									<p className="text-brand-400 font-mono text-xs uppercase tracking-wider font-semibold">
										{employee.role || 'Employee'}
									</p>
									<p className="text-zinc-500 text-xs font-mono">
										Member Since: {new Date(employee.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
									</p>
								</div>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
								{/* Column 1: Personal Details */}
								<div className="space-y-6">
									<h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-800/80 pb-2">
										Personal Details
									</h4>
									
									<div className="grid grid-cols-1 gap-4">
										<div className="space-y-1">
											<span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Full Name</span>
											<div className="bg-zinc-950/50 border border-zinc-850 p-3 text-zinc-200 text-sm">
												{employee.firstName} {employee.middleName ? `${employee.middleName} ` : ''}{employee.lastName}
											</div>
										</div>
										<div className="space-y-1">
											<span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Email Address</span>
											<div className="bg-zinc-950/50 border border-zinc-850 p-3 text-zinc-200 text-sm font-mono select-all">
												{employee.email}
											</div>
										</div>
										<div className="space-y-1">
											<span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Phone Number</span>
											<div className="bg-zinc-950/50 border border-zinc-850 p-3 text-zinc-200 text-sm font-mono">
												{employee.phone}
											</div>
										</div>
									</div>
								</div>

								{/* Column 2: Organization Details */}
								<div className="space-y-6">
									<h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-800/80 pb-2">
										Organization Details
									</h4>
									
									<div className="grid grid-cols-1 gap-4">
										<div className="space-y-1">
											<span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Employee ID</span>
											<div className="bg-zinc-950/50 border border-zinc-850 p-3 text-brand-400 text-sm font-mono font-bold select-all">
												{employee.id}
											</div>
										</div>
										<div className="space-y-1">
											<span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Wing Name</span>
											<div className="bg-zinc-950/50 border border-zinc-850 p-3 text-zinc-200 text-sm font-medium">
												{employee.wingName}
											</div>
										</div>
										<div className="space-y-1">
											<span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Reporting Lead</span>
											<div className="bg-zinc-950/50 border border-zinc-850 p-3 text-zinc-200 text-sm font-medium">
												{employee.wingLeadName}
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				)}

			</div>
		</main>
	);
}
