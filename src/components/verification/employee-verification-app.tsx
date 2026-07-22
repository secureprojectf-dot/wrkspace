'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { GoogleSignInButton } from '@/components/ui/google-sign-in-button';
import { firebaseAuth, googleProvider } from '@/lib/firebase-client';
import { signInWithPopup } from 'firebase/auth';
import { EmployeeProfessionalProfileEditor } from '@/components/ui/employee-professional-profile';
import './verification.css';

const SESSION_KEY = 'wrkspace_verification_session';
const EMP_TOKEN_KEY = 'wrkspace_employee_token';

type PortalUser = {
	id: string;
	email: string;
	role: 'SUPER' | 'COMPANY' | 'EMPLOYEE';
	companyId?: string | null;
	companyName?: string | null;
	source: string;
};

type Session = { token: string; user: PortalUser };

type EmpRow = {
	id: string;
	name: string;
	email: string;
	phone: string;
	wingName: string;
	wingLeadName: string;
	role: string;
	photoUrl?: string | null;
	joinedAt?: string;
	employmentStatus?: string;
};

type DossierTab = 'overview' | 'attendance' | 'tasks' | 'submissions' | 'leaves' | 'events' | 'edit_profile';

function loadSession(): Session | null {
	try {
		const raw = localStorage.getItem(SESSION_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Session;
		if (!parsed?.token || !parsed?.user?.email) return null;
		return parsed;
	} catch {
		return null;
	}
}

function saveSession(s: Session | null) {
	try {
		if (!s) localStorage.removeItem(SESSION_KEY);
		else localStorage.setItem(SESSION_KEY, JSON.stringify(s));
	} catch {
		/* ignore */
	}
}

function initials(name: string) {
	const p = name.trim().split(/\s+/).filter(Boolean);
	if (!p.length) return '?';
	if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
	return `${p[0][0]}${p[p.length - 1][0]}`.toUpperCase();
}

export function EmployeeVerificationApp() {
	const [session, setSession] = useState<Session | null>(null);
	const [ready, setReady] = useState(false);
	const [loginMode, setLoginMode] = useState<'org' | 'employee'>('org');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [showPass, setShowPass] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');

	// Employee self-service login (fill / view own professional profile only).
	const [empEmail, setEmpEmail] = useState('');
	const [empPassword, setEmpPassword] = useState('');
	const [empShowPass, setEmpShowPass] = useState(false);
	const [empRecord, setEmpRecord] = useState<any | null>(null);
	const [statusSaving, setStatusSaving] = useState(false);
	const [q, setQ] = useState('');
	const [wingFilter, setWingFilter] = useState('all');
	const [employees, setEmployees] = useState<EmpRow[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [dossier, setDossier] = useState<any | null>(null);
	const [dossierLoading, setDossierLoading] = useState(false);
	const [tab, setTab] = useState<'directory' | 'access'>('directory');
	const [dossierTab, setDossierTab] = useState<DossierTab>('overview');
	const [copied, setCopied] = useState('');

	const [companies, setCompanies] = useState<any[]>([]);
	const [portalUsers, setPortalUsers] = useState<any[]>([]);
	const [companyName, setCompanyName] = useState('');
	const [companyEmail, setCompanyEmail] = useState('');
	const [newUserEmail, setNewUserEmail] = useState('');
	const [newUserPassword, setNewUserPassword] = useState('');
	const [newUserCompanyId, setNewUserCompanyId] = useState('');
	const [accessMsg, setAccessMsg] = useState('');

	useEffect(() => {
		setSession(loadSession());
		setReady(true);
	}, []);

	const authHeaders = useMemo(() => {
		if (!session?.token) return {};
		return { Authorization: `Bearer ${session.token}` };
	}, [session?.token]);

	const wings = useMemo(() => {
		const set = new Set(employees.map((e) => e.wingName).filter(Boolean));
		return Array.from(set).sort();
	}, [employees]);

	const filteredEmployees = useMemo(() => {
		return employees.filter((e) => (wingFilter === 'all' ? true : e.wingName === wingFilter));
	}, [employees, wingFilter]);

	const logout = () => {
		saveSession(null);
		setSession(null);
		setEmployees([]);
		setDossier(null);
		setSelectedId(null);
		setEmpRecord(null);
		try {
			localStorage.removeItem(EMP_TOKEN_KEY);
		} catch {
			/* ignore */
		}
	};

	const applyLogin = (data: any) => {
		const next = { token: data.token, user: data.user } as Session;
		saveSession(next);
		setSession(next);
		setError('');
	};

	/** Employees log in with their normal wrkspace credentials to fill/view ONLY their own profile. */
	const loginEmployee = async (e: React.FormEvent) => {
		e.preventDefault();
		setBusy(true);
		setError('');
		try {
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: empEmail, password: empPassword }),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data?.error || 'Login failed');
			const emp = data.employee || {};
			// Reuse the shared professional-profile editor's own auth lookup.
			try {
				localStorage.setItem(EMP_TOKEN_KEY, data.token);
			} catch {
				/* ignore */
			}
			setEmpRecord(emp);
			const next: Session = {
				token: data.token,
				user: {
					id: emp.id,
					email: emp.email,
					role: 'EMPLOYEE',
					companyId: null,
					companyName: null,
					source: 'employee',
				},
			};
			saveSession(next);
			setSession(next);
		} catch (err: any) {
			setError(String(err?.message || err));
		} finally {
			setBusy(false);
		}
	};

	/** SUPER-only: toggle an employee's Active/Inactive status (shown to public/company viewers). */
	const setEmploymentStatus = async (employeeId: string, status: 'Active' | 'Inactive') => {
		setStatusSaving(true);
		try {
			const res = await fetch(`/api/verification/employees/${encodeURIComponent(employeeId)}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json', ...authHeaders },
				body: JSON.stringify({ employmentStatus: status }),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data?.error || 'Failed to update status');
			setDossier((d: any) => (d ? { ...d, employee: { ...d.employee, employmentStatus: status } } : d));
			setEmployees((rows) => rows.map((r) => (r.id === employeeId ? { ...r, employmentStatus: status } : r)));
		} catch (err: any) {
			setError(String(err?.message || err));
		} finally {
			setStatusSaving(false);
		}
	};

	const flashCopy = (label: string) => {
		setCopied(label);
		window.setTimeout(() => setCopied(''), 1600);
	};

	const copyText = async (text: string, label: string) => {
		try {
			await navigator.clipboard.writeText(text);
			flashCopy(label);
		} catch {
			/* ignore */
		}
	};

	const loginEmail = async (e: React.FormEvent) => {
		e.preventDefault();
		setBusy(true);
		setError('');
		try {
			const res = await fetch('/api/verification/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password }),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data?.error || 'Login failed');
			applyLogin(data);
		} catch (err: any) {
			setError(String(err?.message || err));
		} finally {
			setBusy(false);
		}
	};

	const loginGoogle = async () => {
		if (!firebaseAuth) {
			setError('Google sign-in is not configured on this deployment.');
			return;
		}
		setBusy(true);
		setError('');
		try {
			const cred = await signInWithPopup(firebaseAuth, googleProvider);
			const gEmail = cred.user?.email;
			if (!gEmail) throw new Error('Google did not return an email');
			const res = await fetch('/api/verification/google', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: gEmail }),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data?.error || 'Google login failed');
			applyLogin(data);
		} catch (err: any) {
			const code = String(err?.code || '');
			if (code.includes('popup-closed') || code.includes('cancelled')) setError('');
			else setError(String(err?.message || err));
		} finally {
			setBusy(false);
		}
	};

	const loadEmployees = useCallback(async () => {
		if (!session?.token || session.user.role === 'EMPLOYEE') return;
		try {
			const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
			const res = await fetch(`/api/verification/employees${qs}`, {
				headers: { ...authHeaders },
				cache: 'no-store',
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data?.error || 'Failed to load employees');
			setEmployees(Array.isArray(data.employees) ? data.employees : []);
			setError('');
		} catch (err: any) {
			setError(String(err?.message || err));
		}
	}, [session?.token, q, authHeaders]);

	const loadDossier = useCallback(
		async (id: string) => {
			if (!session?.token) return;
			setDossierLoading(true);
			setSelectedId(id);
			setDossierTab('overview');
			try {
				const res = await fetch(`/api/verification/employees/${encodeURIComponent(id)}`, {
					headers: { ...authHeaders },
					cache: 'no-store',
				});
				const data = await res.json().catch(() => ({}));
				if (!res.ok) throw new Error(data?.error || 'Failed to load dossier');
				setDossier(data);
				setError('');
			} catch (err: any) {
				setError(String(err?.message || err));
				setDossier(null);
			} finally {
				setDossierLoading(false);
			}
		},
		[session?.token, authHeaders],
	);

	const loadAccess = useCallback(async () => {
		if (!session?.token || session.user.role !== 'SUPER') return;
		try {
			const res = await fetch('/api/verification/companies', {
				headers: { ...authHeaders },
				cache: 'no-store',
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data?.error || 'Failed to load access');
			setCompanies(Array.isArray(data.companies) ? data.companies : []);
			setPortalUsers(Array.isArray(data.users) ? data.users : []);
		} catch (err: any) {
			setAccessMsg(String(err?.message || err));
		}
	}, [session, authHeaders]);

	useEffect(() => {
		if (!session) return;
		void loadEmployees();
	}, [session, loadEmployees]);

	useEffect(() => {
		if (session?.user.role === 'SUPER' && tab === 'access') void loadAccess();
	}, [session, tab, loadAccess]);

	const printReport = () => {
		window.print();
	};

	const copySummary = async () => {
		if (!dossier?.employee) return;
		const e = dossier.employee;
		const p = dossier.profile || {};
		const s = dossier.summary;
		const skillsFlat = Object.values(p.skills || {})
			.flat()
			.filter(Boolean);
		const text = [
			`EMPLOYEE VERIFICATION — wrkspace`,
			`Name: ${e.name}${p.professionalTitle ? ` — ${p.professionalTitle}` : ''}`,
			`ID: ${e.id}`,
			`Role: ${e.role} · Wing: ${e.wingName}`,
			`Email: ${e.email} · Phone: ${e.phone}`,
			`Location: ${[p.city, p.state, p.country].filter(Boolean).join(', ') || '—'}`,
			`Tenure: ${e.tenureDays} days`,
			`Resume summary: ${p.about || '—'}`,
			`Career objective: ${p.careerObjective || '—'}`,
			`Years of experience: ${p.yearsOfExperience || '—'} · Industry: ${p.industry || '—'}`,
			`Remarks: ${p.remarks || '—'}`,
			`EC: ${[p.emergencyContactName, p.emergencyContactPhone, p.emergencyContactRelation].filter(Boolean).join(' · ') || '—'}`,
			`Education: ${(p.education || []).map((q: any) => q.degree).filter(Boolean).join('; ') || '—'}`,
			`Skills: ${skillsFlat.join(', ') || '—'}`,
			`Certifications: ${(p.certifications || []).map((c: any) => c.name).filter(Boolean).join('; ') || '—'}`,
			`Experience: ${(p.experience || []).map((x: any) => `${x.title}@${x.company}`).filter(Boolean).join('; ') || '—'}`,
			`Internships: ${(p.internships || []).map((x: any) => `${x.title}@${x.company}`).filter(Boolean).join('; ') || '—'}`,
			`Projects: ${(p.projects || []).map((pr: any) => pr.name).filter(Boolean).join('; ') || '—'}`,
			`Achievements: ${(p.achievements || []).map((a: any) => a.title).filter(Boolean).join('; ') || '—'}`,
			`Publications: ${(p.publications || []).map((pub: any) => pub.title).filter(Boolean).join('; ') || '—'}`,
			`Attendance days: ${s?.attendanceDays} · Tasks ${s?.tasksCompleted}/${s?.tasksTotal} · Submissions ${s?.submissionsTotal}`,
			`Generated: ${new Date().toLocaleString()}`,
		].join('\n');
		await copyText(text, 'Summary copied');
	};

	if (!ready) {
		return (
			<div className="ev-root ev-loading">
				<div className="ev-spinner" />
				<p>Loading verification portal…</p>
			</div>
		);
	}

	if (!session) {
		return (
			<main className="ev-root ev-login">
				<div className="ev-login-grid">
					<aside className="ev-login-brand">
						<div className="ev-login-brand-inner">
							<img
								src="/branding/wrkspace-logo-on-dark.png"
								alt="wrkspace"
								className="ev-brand-logo"
								onError={(e) => {
									(e.target as HTMLImageElement).style.display = 'none';
								}}
							/>
							<p className="ev-kicker">Employee verification</p>
							<h1>Company-grade employee history</h1>
							<p className="ev-lead">
								One portal, three access levels — companies see general status only, employees
								fill in their own professional profile, and wrkspace admins see and edit
								everything.
							</p>
							<ul className="ev-brand-points">
								<li>Public / company: name, role, wing &amp; active-inactive status</li>
								<li>Employees: fill &amp; view only your own professional profile</li>
								<li>Admins: full dossier, edits &amp; remarks for every employee</li>
							</ul>
						</div>
					</aside>

					<section className="ev-login-panel">
						<div className="ev-login-card">
							<p className="ev-kicker">Sign in</p>
							<h2>Verification access</h2>

							<div className="ev-login-mode-toggle" role="tablist">
								<button
									type="button"
									role="tab"
									aria-selected={loginMode === 'org'}
									className={`ev-mode-tab ${loginMode === 'org' ? 'is-active' : ''}`}
									onClick={() => {
										setLoginMode('org');
										setError('');
									}}
								>
									Company / Admin
								</button>
								<button
									type="button"
									role="tab"
									aria-selected={loginMode === 'employee'}
									className={`ev-mode-tab ${loginMode === 'employee' ? 'is-active' : ''}`}
									onClick={() => {
										setLoginMode('employee');
										setError('');
									}}
								>
									I&apos;m an employee
								</button>
							</div>

							{error ? (
								<div className="ev-alert ev-alert-error" role="alert">
									<strong>{error}</strong>
									{loginMode === 'org' && error.toLowerCase().includes('invalid') ? (
										<span>
											Employee logins go under the &quot;I&apos;m an employee&quot; tab above.
										</span>
									) : null}
								</div>
							) : null}

							{loginMode === 'org' ? (
								<>
									<p className="ev-sub">
										Use your <strong>Admin panel</strong> email &amp; password — or a company
										login shared by wrkspace. General, view-only access to each employee&apos;s
										active/inactive status and basic details. Same credentials as{' '}
										<a href="/admin" style={{ color: '#8eb0ff' }}>
											/admin
										</a>
										.
									</p>
									<form onSubmit={loginEmail} className="ev-form">
										<label className="ev-field">
											<span>Admin / company email</span>
											<input
												type="email"
												required
												autoComplete="username"
												value={email}
												onChange={(e) => setEmail(e.target.value)}
												placeholder="your admin email"
											/>
										</label>
										<label className="ev-field">
											<span>Password (same as Admin panel)</span>
											<div className="ev-pass-row">
												<input
													type={showPass ? 'text' : 'password'}
													required
													autoComplete="current-password"
													value={password}
													onChange={(e) => setPassword(e.target.value)}
													placeholder="Your /admin password"
												/>
												<button
													type="button"
													className="ev-ghost-btn"
													onClick={() => setShowPass((v) => !v)}
												>
													{showPass ? 'Hide' : 'Show'}
												</button>
											</div>
										</label>
										<button type="submit" disabled={busy} className="ev-btn ev-btn-primary">
											{busy ? 'Signing in…' : 'Sign in with email'}
										</button>
									</form>

									<div className="ev-or">
										<span>or</span>
									</div>

									<GoogleSignInButton
										onClick={loginGoogle}
										disabled={busy}
										loading={busy}
										label="Continue with Google (admin Gmail)"
									/>
								</>
							) : (
								<>
									<p className="ev-sub">
										Use your normal wrkspace employee email &amp; password. You&apos;ll be able
										to fill in and view <strong>only your own</strong> professional profile
										(personal info, summary, experience, education, skills, projects,
										certifications, achievements &amp; more).
									</p>
									<form onSubmit={loginEmployee} className="ev-form">
										<label className="ev-field">
											<span>Employee email</span>
											<input
												type="email"
												required
												autoComplete="username"
												value={empEmail}
												onChange={(e) => setEmpEmail(e.target.value)}
												placeholder="your employee email"
											/>
										</label>
										<label className="ev-field">
											<span>Password</span>
											<div className="ev-pass-row">
												<input
													type={empShowPass ? 'text' : 'password'}
													required
													autoComplete="current-password"
													value={empPassword}
													onChange={(e) => setEmpPassword(e.target.value)}
													placeholder="Your wrkspace password"
												/>
												<button
													type="button"
													className="ev-ghost-btn"
													onClick={() => setEmpShowPass((v) => !v)}
												>
													{empShowPass ? 'Hide' : 'Show'}
												</button>
											</div>
										</label>
										<button type="submit" disabled={busy} className="ev-btn ev-btn-primary">
											{busy ? 'Signing in…' : 'Sign in as employee'}
										</button>
									</form>
								</>
							)}

							<nav className="ev-login-links">
								<a href="/admin">Admin panel</a>
								<a href="/">Employee portal</a>
							</nav>
						</div>
					</section>
				</div>
			</main>
		);
	}

	if (session.user.role === 'EMPLOYEE') {
		return (
			<main className="ev-root ev-app">
				<header className="ev-topbar print:hidden">
					<div className="ev-topbar-inner">
						<div className="ev-topbar-brand">
							<img src="/branding/wrkspace-logo-on-dark.png" alt="" className="ev-top-logo" />
							<div>
								<p className="ev-kicker">Employee verification</p>
								<p className="ev-top-user">
									{[empRecord?.firstName, empRecord?.lastName].filter(Boolean).join(' ') ||
										session.user.email}
									<span className="ev-pill">EMPLOYEE</span>
								</p>
							</div>
						</div>
					</div>
					<div className="ev-topbar-actions">
						<button type="button" className="ev-nav-btn ev-nav-muted" onClick={logout}>
							Sign out
						</button>
					</div>
				</header>
				<div className="ev-shell">
					<div className="ev-card" style={{ marginBottom: 16 }}>
						<h2 style={{ margin: 0 }}>My professional profile</h2>
						<p className="ev-muted" style={{ marginTop: 6 }}>
							Fill in your details below. This is what wrkspace admins see when reviewing your
							profile — public / company viewers only ever see your name, role and active status.
						</p>
					</div>
					<EmployeeProfessionalProfileEditor employee={empRecord} onEmployeeUpdate={setEmpRecord} />
				</div>
			</main>
		);
	}

	const emp = dossier?.employee;

	return (
		<main className="ev-root ev-app">
			<header className="ev-topbar print:hidden">
				<div className="ev-topbar-inner">
					<div className="ev-topbar-brand">
						<img src="/branding/wrkspace-logo-on-dark.png" alt="" className="ev-top-logo" />
						<div>
							<p className="ev-kicker">Employee verification</p>
							<p className="ev-top-user">
								{session.user.email}
								{session.user.companyName ? ` · ${session.user.companyName}` : ''}
								<span className="ev-pill">{session.user.role}</span>
							</p>
						</div>
					</div>
					<div className="ev-topbar-actions">
						{copied ? <span className="ev-toast">{copied}</span> : null}
						<button
							type="button"
							className={`ev-nav-btn ${tab === 'directory' ? 'is-active' : ''}`}
							onClick={() => {
								setTab('directory');
							}}
						>
							Directory
						</button>
						{session.user.role === 'SUPER' ? (
							<button
								type="button"
								className={`ev-nav-btn ${tab === 'access' ? 'is-active' : ''}`}
								onClick={() => setTab('access')}
							>
								Company access
							</button>
						) : null}
						<button type="button" className="ev-nav-btn ev-nav-muted" onClick={logout}>
							Sign out
						</button>
					</div>
				</div>
			</header>

			{error ? (
				<div className="ev-shell">
					<div className="ev-alert ev-alert-error print:hidden">{error}</div>
				</div>
			) : null}

			{tab === 'access' && session.user.role === 'SUPER' ? (
				<div className="ev-shell ev-access-grid print:hidden">
					<section className="ev-card">
						<h2>Add verification company</h2>
						<p className="ev-muted">
							Create a company, then create an email/password to share with their HR for this portal
							only.
						</p>
						<div className="ev-form">
							<label className="ev-field">
								<span>Company name</span>
								<input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Pvt Ltd" />
							</label>
							<label className="ev-field">
								<span>Contact email (optional)</span>
								<input value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} placeholder="hr@company.com" />
							</label>
							<button
								type="button"
								className="ev-btn ev-btn-primary"
								onClick={async () => {
									setAccessMsg('');
									const res = await fetch('/api/verification/companies', {
										method: 'POST',
										headers: { 'Content-Type': 'application/json', ...authHeaders },
										body: JSON.stringify({
											action: 'create_company',
											name: companyName,
											contactEmail: companyEmail,
										}),
									});
									const data = await res.json().catch(() => ({}));
									if (!res.ok) setAccessMsg(data?.error || 'Failed');
									else {
										setAccessMsg(`Company created: ${data.company?.name}`);
										setCompanyName('');
										setCompanyEmail('');
										void loadAccess();
									}
								}}
							>
								Create company
							</button>
						</div>

						<hr className="ev-hr" />

						<h3>Create login to share</h3>
						<div className="ev-form">
							<label className="ev-field">
								<span>Login email</span>
								<input value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="partner@company.com" />
							</label>
							<label className="ev-field">
								<span>Temporary password</span>
								<input value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} placeholder="Set a strong temporary password" />
							</label>
							<label className="ev-field">
								<span>Company</span>
								<select value={newUserCompanyId} onChange={(e) => setNewUserCompanyId(e.target.value)}>
									<option value="">Select company…</option>
									{companies.map((c) => (
										<option key={c.id} value={c.id}>
											{c.name}
										</option>
									))}
								</select>
							</label>
							<button
								type="button"
								className="ev-btn ev-btn-success"
								onClick={async () => {
									setAccessMsg('');
									const res = await fetch('/api/verification/companies', {
										method: 'POST',
										headers: { 'Content-Type': 'application/json', ...authHeaders },
										body: JSON.stringify({
											action: 'create_user',
											email: newUserEmail,
											password: newUserPassword,
											companyId: newUserCompanyId,
											role: 'COMPANY',
										}),
									});
									const data = await res.json().catch(() => ({}));
									if (!res.ok) setAccessMsg(data?.error || 'Failed');
									else {
										setAccessMsg(data.shareHint || 'User created');
										setNewUserEmail('');
										setNewUserPassword('');
										void loadAccess();
									}
								}}
							>
								Create &amp; show share credentials
							</button>
						</div>
						{accessMsg ? <p className="ev-access-msg">{accessMsg}</p> : null}
					</section>

					<section className="ev-card">
						<div className="ev-card-head">
							<h2>Existing access</h2>
							<span className="ev-count">{portalUsers.length}</span>
						</div>
						<ul className="ev-access-list">
							{portalUsers.map((u) => (
								<li key={u.id} className="ev-access-item">
									<div>
										<p className="ev-access-email">{u.email}</p>
										<p className="ev-muted">
											{u.role} · {u.companyName || '—'} · {u.active ? 'active' : 'disabled'}
										</p>
										<p className="ev-mono">pass: {u.password}</p>
									</div>
									<button
										type="button"
										className="ev-ghost-btn"
										onClick={() =>
											void copyText(`${u.email} / ${u.password}`, 'Credentials copied')
										}
									>
										Copy
									</button>
								</li>
							))}
							{portalUsers.length === 0 ? (
								<li className="ev-muted">No portal users yet — create one on the left.</li>
							) : null}
						</ul>
					</section>
				</div>
			) : (
				<div className="ev-shell ev-workspace">
					<aside className="ev-sidebar print:hidden">
						<div className="ev-sidebar-tools">
							<div className="ev-stats-row">
								<div className="ev-stat">
									<span>People</span>
									<strong>{filteredEmployees.length}</strong>
								</div>
								<div className="ev-stat">
									<span>Wings</span>
									<strong>{wings.length}</strong>
								</div>
							</div>
							<input
								value={q}
								onChange={(e) => setQ(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === 'Enter') void loadEmployees();
								}}
								placeholder="Search name, phone, wing, ID…"
								className="ev-input"
							/>
							<select
								value={wingFilter}
								onChange={(e) => setWingFilter(e.target.value)}
								className="ev-input"
							>
								<option value="all">All wings</option>
								{wings.map((w) => (
									<option key={w} value={w}>
										{w}
									</option>
								))}
							</select>
							<button type="button" className="ev-btn ev-btn-ghost" onClick={() => void loadEmployees()}>
								Refresh directory
							</button>
						</div>
						<ul className="ev-emp-list">
							{filteredEmployees.map((e) => (
								<li key={e.id}>
									<button
										type="button"
										onClick={() => void loadDossier(e.id)}
										className={`ev-emp-row ${selectedId === e.id ? 'is-active' : ''}`}
									>
										{e.photoUrl ? (
											// eslint-disable-next-line @next/next/no-img-element
											<img src={e.photoUrl} alt="" className="ev-avatar" />
										) : (
											<span className="ev-avatar ev-avatar-fallback">{initials(e.name)}</span>
										)}
										<span className="ev-emp-meta">
											<span className="ev-emp-name">
												{e.name}
												<span
													className={`ev-status-pill ev-status-pill-sm ${
														e.employmentStatus === 'Inactive' ? 'is-inactive' : 'is-active'
													}`}
												>
													{e.employmentStatus === 'Inactive' ? 'Inactive' : 'Active'}
												</span>
											</span>
											<span className="ev-emp-sub">
												{e.role} · {e.wingName}
											</span>
											<span className="ev-emp-sub">{e.phone}</span>
										</span>
									</button>
								</li>
							))}
							{filteredEmployees.length === 0 ? (
								<li className="ev-empty-side">No employees match.</li>
							) : null}
						</ul>
					</aside>

					<section className="ev-main">
						{dossierLoading ? (
							<div className="ev-empty-main">
								<div className="ev-spinner" />
								<p>Loading complete history…</p>
							</div>
						) : !dossier ? (
							<div className="ev-empty-main">
								<div className="ev-empty-art" aria-hidden />
								<h2>Select an employee</h2>
								<p>
									Open a profile to review about, qualifications, certifications, experience, and
									workplace history.
								</p>
							</div>
						) : (
							<div className="ev-dossier" id="ev-print-area">
								<div className="ev-dossier-hero">
									<div className="ev-dossier-identity">
										{emp?.photoUrl ? (
											// eslint-disable-next-line @next/next/no-img-element
											<img src={emp.photoUrl} alt="" className="ev-avatar-lg" />
										) : (
											<span className="ev-avatar-lg ev-avatar-fallback">
												{initials(emp?.name || '?')}
											</span>
										)}
										<div>
											<p className="ev-kicker print:hidden">Employee dossier</p>
											<h1>{emp?.name}</h1>
											<p className="ev-dossier-line">
												{emp?.role} · {emp?.wingName} · Lead: {emp?.wingLeadName}
											</p>
											<p className="ev-dossier-line ev-mono">
												{emp?.email} · {emp?.phone} · ID {emp?.id} · {emp?.tenureDays}d tenure
											</p>
											<div className="ev-inline-actions print:hidden">
												<a className="ev-chip" href={`mailto:${emp?.email}`}>
													Email
												</a>
												<a className="ev-chip" href={`tel:${emp?.phone}`}>
													Call
												</a>
												<button
													type="button"
													className="ev-chip"
													onClick={() => void copyText(emp?.email || '', 'Email copied')}
												>
													Copy email
												</button>
												<button
													type="button"
													className="ev-chip"
													onClick={() => void copyText(emp?.phone || '', 'Phone copied')}
												>
													Copy phone
												</button>
											</div>
										</div>
									</div>
								</div>

								<div className="ev-toolbar print:hidden">
									<div className="ev-tabs">
										{(
											[
												['overview', 'Overview'],
												['attendance', 'Attendance'],
												['tasks', 'Tasks'],
												['submissions', 'Submissions'],
												['leaves', 'Leaves'],
												['events', 'Events'],
												...(session.user.role === 'SUPER'
													? ([['edit_profile', 'Edit profile (admin)']] as [DossierTab, string][])
													: []),
											] as [DossierTab, string][]
										).map(([id, label]) => (
											<button
												key={id}
												type="button"
												className={`ev-tab ${dossierTab === id ? 'is-active' : ''}`}
												onClick={() => setDossierTab(id)}
											>
												{label}
											</button>
										))}
									</div>
									<div className="ev-toolbar-right">
										<button type="button" className="ev-btn ev-btn-ghost" onClick={() => void copySummary()}>
											Copy summary
										</button>
										<button type="button" className="ev-btn ev-btn-primary" onClick={printReport}>
											Print / PDF
										</button>
									</div>
								</div>

								{dossierTab === 'overview' ? (
									<div className="ev-overview">
										{(() => {
											// Public / company viewers only get general info + employment status.
											// The deep company-facing professional profile is admin (SUPER) only.
											if (session.user.role !== 'SUPER') {
												return (
													<div className="ev-card">
														<h3>General information</h3>
														<div className="ev-info-grid">
															<div className="ev-info-item">
																<span>Employment status</span>
																<strong>
																	<span
																		className={`ev-status-pill ${
																			emp?.employmentStatus === 'Inactive' ? 'is-inactive' : 'is-active'
																		}`}
																	>
																		{emp?.employmentStatus === 'Inactive' ? 'Inactive' : 'Active'}
																	</span>
																</strong>
															</div>
															<div className="ev-info-item">
																<span>Role</span>
																<strong>{emp?.role || '—'}</strong>
															</div>
															<div className="ev-info-item">
																<span>Wing</span>
																<strong>{emp?.wingName || '—'}</strong>
															</div>
															<div className="ev-info-item">
																<span>Wing lead</span>
																<strong>{emp?.wingLeadName || '—'}</strong>
															</div>
															<div className="ev-info-item">
																<span>Email</span>
																<strong>{emp?.email || '—'}</strong>
															</div>
															<div className="ev-info-item">
																<span>Phone</span>
																<strong>{emp?.phone || '—'}</strong>
															</div>
															<div className="ev-info-item">
																<span>Tenure</span>
																<strong>{emp?.tenureDays != null ? `${emp.tenureDays} days` : '—'}</strong>
															</div>
															<div className="ev-info-item">
																<span>Joined</span>
																<strong>
																	{emp?.createdAt ? new Date(emp.createdAt).toLocaleDateString() : '—'}
																</strong>
															</div>
														</div>
														<p className="ev-muted" style={{ marginTop: 12 }}>
															The full professional profile (résumé, experience, education, skills,
															projects &amp; more) is only visible to wrkspace admins.
														</p>
													</div>
												);
											}

											const p = dossier.profile || {};
											const education = Array.isArray(p.education) ? p.education : [];
											const certs = Array.isArray(p.certifications) ? p.certifications : [];
											const exp = Array.isArray(p.experience) ? p.experience : [];
											const internships = Array.isArray(p.internships) ? p.internships : [];
											const projs = Array.isArray(p.projects) ? p.projects : [];
											const achievements = Array.isArray(p.achievements) ? p.achievements : [];
											const publications = Array.isArray(p.publications) ? p.publications : [];
											const customSections = Array.isArray(p.customSections) ? p.customSections : [];
											const skills = p.skills || {};
											const skillGroups: [string, string][] = [
												['programmingLanguages', 'Programming Languages'],
												['frontend', 'Frontend'],
												['backend', 'Backend'],
												['database', 'Database'],
												['cloud', 'Cloud'],
												['devops', 'DevOps'],
												['tools', 'Tools'],
												['softSkills', 'Soft Skills'],
											];
											const hasAnySkill = skillGroups.some(([k]) => Array.isArray(skills[k]) && skills[k].length > 0);
											const hasEc =
												p.emergencyContactName || p.emergencyContactPhone || p.emergencyContactRelation;
											const links: [string, string, string][] = [
												['LinkedIn', p.linkedinUrl, '🔗'],
												['GitHub', p.githubUrl, '🔗'],
												['Portfolio', p.portfolioUrl, '🔗'],
												['LeetCode', p.leetcodeUrl, '🔗'],
												['Codeforces', p.codeforcesUrl, '🔗'],
												['CodeChef', p.codechefUrl, '🔗'],
												['HackerRank', p.hackerrankUrl, '🔗'],
											];

											return (
												<>
													<div className="ev-card">
														<h3>Personal information</h3>
														<div className="ev-info-grid">
															<div className="ev-info-item">
																<span>Professional title</span>
																<strong>{p.professionalTitle || '—'}</strong>
															</div>
															<div className="ev-info-item">
																<span>Location</span>
																<strong>{[p.city, p.state, p.country].filter(Boolean).join(', ') || '—'}</strong>
															</div>
															{links.map(([label, url]) =>
																url ? (
																	<div className="ev-info-item" key={label}>
																		<span>{label}</span>
																		<a href={url} target="_blank" rel="noreferrer">
																			{url.replace(/^https?:\/\//, '')}
																		</a>
																	</div>
																) : null,
															)}
														</div>
														{links.every(([, url]) => !url) ? (
															<p className="ev-muted" style={{ marginTop: 10 }}>
																No links or coding profiles added yet.
															</p>
														) : null}
													</div>

													<div className="ev-card">
														<h3>Professional summary</h3>
														<div className="ev-subsection">
															<p className="ev-muted" style={{ marginBottom: 4 }}>Resume summary</p>
															<p className="ev-prose">
																{p.about?.trim() ? p.about : 'No resume summary yet — employee can add this in Profile.'}
															</p>
														</div>
														<div className="ev-subsection">
															<p className="ev-muted" style={{ marginBottom: 4 }}>Career objective</p>
															<p className="ev-prose">{p.careerObjective?.trim() ? p.careerObjective : 'Not provided.'}</p>
														</div>
														<div className="ev-subsection ev-info-grid">
															<div className="ev-info-item">
																<span>Years of experience</span>
																<strong>{p.yearsOfExperience || '—'}</strong>
															</div>
															<div className="ev-info-item">
																<span>Industry</span>
																<strong>{p.industry || '—'}</strong>
															</div>
														</div>
														<div className="ev-subsection">
															<p className="ev-muted" style={{ marginBottom: 4 }}>Remarks</p>
															<p className="ev-prose">{p.remarks?.trim() ? p.remarks : 'No remarks yet.'}</p>
														</div>
													</div>

													<div className="ev-card">
														<h3>Emergency contact (EC)</h3>
														{hasEc ? (
															<ul className="ev-notes">
																<li>
																	<strong>{p.emergencyContactName || '—'}</strong>
																	{p.emergencyContactRelation
																		? ` · ${p.emergencyContactRelation}`
																		: ''}
																</li>
																<li className="ev-mono">{p.emergencyContactPhone || '—'}</li>
															</ul>
														) : (
															<p className="ev-muted">Not provided.</p>
														)}
													</div>

													<div className="ev-card">
														<h3>Education</h3>
														{education.length === 0 ? (
															<p className="ev-muted">None listed.</p>
														) : (
															<ul className="ev-notes">
																{education.map((q: any) => (
																	<li key={q.id || q.degree}>
																		<strong>{q.degree}</strong>
																		{q.institution ? ` — ${q.institution}` : ''}
																		{q.specialization ? ` (${q.specialization})` : ''}
																		{q.from || q.to ? (
																			<span className="ev-muted"> · {q.from || '?'} – {q.to || '?'}</span>
																		) : null}
																		{q.cgpa ? <span className="ev-muted"> · CGPA {q.cgpa}</span> : null}
																	</li>
																))}
															</ul>
														)}
													</div>

													<div className="ev-card">
														<h3>Skills</h3>
														{!hasAnySkill ? (
															<p className="ev-muted">None listed.</p>
														) : (
															skillGroups.map(([key, label]) => {
																const tags = Array.isArray(skills[key]) ? skills[key] : [];
																if (!tags.length) return null;
																return (
																	<div className="ev-skill-group" key={key}>
																		<span>{label}</span>
																		<div className="ev-tag-row">
																			{tags.map((t: string) => (
																				<span className="ev-tag" key={t}>
																					{t}
																				</span>
																			))}
																		</div>
																	</div>
																);
															})
														)}
													</div>

													<div className="ev-card">
														<h3>Work experience</h3>
														{exp.length === 0 ? (
															<p className="ev-muted">None listed.</p>
														) : (
															<ul className="ev-notes">
																{exp.map((x: any) => (
																	<li key={x.id || `${x.title}-${x.company}`}>
																		<strong>{x.title}</strong>
																		{x.company ? ` @ ${x.company}` : ''}
																		{x.employmentType ? <span className="ev-muted"> · {x.employmentType}</span> : null}
																		<span className="ev-muted">
																			{' '}
																			· {x.from || '?'} – {x.current ? 'Present' : x.to || '?'}
																			{x.location ? ` · ${x.location}` : ''}
																		</span>
																		{x.description ? <div className="ev-muted">{x.description}</div> : null}
																		{x.technologiesUsed ? (
																			<div className="ev-muted">Tech: {x.technologiesUsed}</div>
																		) : null}
																	</li>
																))}
															</ul>
														)}
													</div>

													<div className="ev-card">
														<h3>Internships</h3>
														{internships.length === 0 ? (
															<p className="ev-muted">None listed.</p>
														) : (
															<ul className="ev-notes">
																{internships.map((x: any) => (
																	<li key={x.id || `${x.title}-${x.company}`}>
																		<strong>{x.title}</strong>
																		{x.company ? ` @ ${x.company}` : ''}
																		<span className="ev-muted">
																			{' '}
																			· {x.from || '?'} – {x.current ? 'Present' : x.to || '?'}
																			{x.location ? ` · ${x.location}` : ''}
																		</span>
																		{x.description ? <div className="ev-muted">{x.description}</div> : null}
																		{x.technologiesUsed ? (
																			<div className="ev-muted">Tech: {x.technologiesUsed}</div>
																		) : null}
																	</li>
																))}
															</ul>
														)}
													</div>

													<div className="ev-card">
														<h3>Projects</h3>
														{projs.length === 0 ? (
															<p className="ev-muted">None listed.</p>
														) : (
															<ul className="ev-notes">
																{projs.map((pr: any) => (
																	<li key={pr.id || pr.name}>
																		<strong>{pr.name}</strong>
																		{pr.role ? ` · ${pr.role}` : ''}
																		{pr.tech ? <span className="ev-muted"> · {pr.tech}</span> : null}
																		{pr.githubUrl ? (
																			<>
																				{' · '}
																				<a href={pr.githubUrl} target="_blank" rel="noreferrer">
																					GitHub
																				</a>
																			</>
																		) : null}
																		{pr.liveUrl ? (
																			<>
																				{' · '}
																				<a href={pr.liveUrl} target="_blank" rel="noreferrer">
																					Live demo
																				</a>
																			</>
																		) : null}
																		{pr.description ? <div className="ev-muted">{pr.description}</div> : null}
																	</li>
																))}
															</ul>
														)}
													</div>

													<div className="ev-card">
														<h3>Certifications</h3>
														{certs.length === 0 ? (
															<p className="ev-muted">None listed.</p>
														) : (
															<ul className="ev-notes">
																{certs.map((c: any) => (
																	<li key={c.id || c.name}>
																		<strong>{c.name}</strong>
																		{c.issuer ? ` — ${c.issuer}` : ''}
																		{c.issueDate ? ` (${c.issueDate})` : ''}
																		{c.credentialId ? <span className="ev-muted"> · ID: {c.credentialId}</span> : null}
																		{c.credentialUrl ? (
																			<>
																				{' · '}
																				<a href={c.credentialUrl} target="_blank" rel="noreferrer">
																					Credential
																				</a>
																			</>
																		) : null}
																		{c.fileUrl ? (
																			<>
																				{' · '}
																				<a href={c.fileUrl} target="_blank" rel="noreferrer">
																					View file
																				</a>
																			</>
																		) : null}
																	</li>
																))}
															</ul>
														)}
													</div>

													<div className="ev-card">
														<h3>Achievements &amp; awards</h3>
														{achievements.length === 0 ? (
															<p className="ev-muted">None listed.</p>
														) : (
															<ul className="ev-notes">
																{achievements.map((a: any) => (
																	<li key={a.id || a.title}>
																		<strong>{a.title}</strong>
																		{a.organization ? ` — ${a.organization}` : ''}
																		{a.date ? ` (${a.date})` : ''}
																		{a.fileUrl ? (
																			<>
																				{' · '}
																				<a href={a.fileUrl} target="_blank" rel="noreferrer">
																					View file
																				</a>
																			</>
																		) : null}
																		{a.description ? <div className="ev-muted">{a.description}</div> : null}
																	</li>
																))}
															</ul>
														)}
													</div>

													<div className="ev-card">
														<h3>Publications &amp; research</h3>
														{publications.length === 0 ? (
															<p className="ev-muted">None listed.</p>
														) : (
															<ul className="ev-notes">
																{publications.map((pub: any) => (
																	<li key={pub.id || pub.title}>
																		<strong>{pub.title}</strong>
																		{pub.year ? ` (${pub.year})` : ''}
																		{pub.authors ? <div className="ev-muted">{pub.authors}</div> : null}
																		{pub.journal || pub.conference ? (
																			<div className="ev-muted">{[pub.journal, pub.conference].filter(Boolean).join(' · ')}</div>
																		) : null}
																		{pub.url ? (
																			<div>
																				<a href={pub.url} target="_blank" rel="noreferrer">
																					DOI / link
																				</a>
																			</div>
																		) : null}
																		{pub.abstract ? <div className="ev-muted">{pub.abstract}</div> : null}
																	</li>
																))}
															</ul>
														)}
													</div>

													{customSections.length > 0 ? (
														<div className="ev-card">
															<h3>Additional sections</h3>
															{customSections.map((c: any) => (
																<div className="ev-subsection" key={c.id || c.title}>
																	<p className="ev-muted" style={{ marginBottom: 4 }}>{c.title}</p>
																	<p className="ev-prose">{c.content}</p>
																</div>
															))}
														</div>
													) : null}

													<div className="ev-kpi-grid">
														{[
															['Attendance days', dossier.summary?.attendanceDays],
															['Tasks done', `${dossier.summary?.tasksCompleted}/${dossier.summary?.tasksTotal}`],
															['Submissions', dossier.summary?.submissionsTotal],
															['Leaves', dossier.summary?.leavesTotal],
														].map(([label, val]) => (
															<div key={String(label)} className="ev-kpi">
																<span>{label}</span>
																<strong>{val}</strong>
															</div>
														))}
													</div>
												</>
											);
										})()}
									</div>
								) : null}

								{dossierTab === 'attendance' ? (
									<HistoryTable
										title="Attendance"
										rows={dossier.attendance}
										columns={['Date', 'Check-in', 'Check-out', 'Status']}
										cell={(a: any) => [a.date, a.checkIn || '—', a.checkOut || '—', a.status || '—']}
									/>
								) : null}
								{dossierTab === 'tasks' ? (
									<HistoryTable
										title="Tasks"
										rows={dossier.tasks}
										columns={['Title', 'Status', 'Mode', 'Deadline']}
										cell={(t: any) => [t.title, t.status, t.mode || '—', String(t.deadline || '').slice(0, 10) || '—']}
									/>
								) : null}
								{dossierTab === 'submissions' ? (
									<HistoryTable
										title="Work submissions"
										rows={dossier.submissions}
										columns={['Title', 'Status', 'Hours', 'Submitted']}
										cell={(s: any) => [
											s.title,
											s.status,
											String(s.hoursSpent ?? 0),
											String(s.submittedAt || '').slice(0, 10) || '—',
										]}
									/>
								) : null}
								{dossierTab === 'leaves' ? (
									<HistoryTable
										title="Leaves"
										rows={dossier.leaves}
										columns={['Type', 'Status', 'From', 'To']}
										cell={(l: any) => [
											l.type,
											l.status,
											String(l.startDate || '').slice(0, 10),
											String(l.endDate || '').slice(0, 10),
										]}
									/>
								) : null}
								{dossierTab === 'events' ? (
									<HistoryTable
										title="Events (as representative)"
										rows={dossier.events}
										columns={['Title', 'Start', 'Venue']}
										cell={(ev: any) => [
											ev.title,
											String(ev.startDate || '').slice(0, 10),
											ev.venueAddress || '—',
										]}
									/>
								) : null}

								{dossierTab === 'edit_profile' && session.user.role === 'SUPER' && emp ? (
									<div className="ev-admin-edit print:hidden">
										<div className="ev-card" style={{ marginBottom: 16 }}>
											<h3>Employment status</h3>
											<p className="ev-muted" style={{ marginBottom: 10 }}>
												Controls what public / company viewers see for this employee.
											</p>
											<div className="ev-inline-actions">
												{(['Active', 'Inactive'] as const).map((s) => (
													<button
														key={s}
														type="button"
														disabled={statusSaving}
														className={`ev-chip ${
															(emp?.employmentStatus || 'Active') === s ? 'is-active' : ''
														}`}
														onClick={() => void setEmploymentStatus(emp.id, s)}
													>
														{s}
													</button>
												))}
											</div>
										</div>
										<EmployeeProfessionalProfileEditor
											employee={emp}
											canEditRemarks
											onEmployeeUpdate={(next) =>
												setDossier((d: any) => (d ? { ...d, employee: { ...d.employee, ...next } } : d))
											}
											saveOverride={async (profile) => {
												const res = await fetch(
													`/api/verification/employees/${encodeURIComponent(emp.id)}`,
													{
														method: 'PATCH',
														headers: { 'Content-Type': 'application/json', ...authHeaders },
														body: JSON.stringify(profile),
													},
												);
												const data = await res.json().catch(() => ({}));
												if (!res.ok) throw new Error(data?.error || 'Save failed');
												return { employee: data.employee, profile: data.profile };
											}}
										/>
									</div>
								) : null}
							</div>
						)}
					</section>
				</div>
			)}
		</main>
	);
}

function HistoryTable({
	title,
	rows,
	columns,
	cell,
}: {
	title: string;
	rows: any[];
	columns: string[];
	cell: (row: any) => (string | number)[];
}) {
	const list = Array.isArray(rows) ? rows : [];
	return (
		<div className="ev-card ev-table-card">
			<div className="ev-card-head">
				<h3>{title}</h3>
				<span className="ev-count">{list.length}</span>
			</div>
			{list.length === 0 ? (
				<p className="ev-muted">No records.</p>
			) : (
				<div className="ev-table-wrap">
					<table className="ev-table">
						<thead>
							<tr>
								{columns.map((c) => (
									<th key={c}>{c}</th>
								))}
							</tr>
						</thead>
						<tbody>
							{list.slice(0, 80).map((row, i) => (
								<tr key={row.id || i}>
									{cell(row).map((v, j) => (
										<td key={j}>{v}</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
