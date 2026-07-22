'use client';

import { useEffect, useMemo, useState } from 'react';
import { PlusIcon, Trash2Icon, SaveIcon, UploadIcon, XIcon } from 'lucide-react';
import { updateEmployeeProfessionalProfile } from '@/app/admin/actions';
import { apiGet, apiPatch, employeeToken } from '@/lib/mobile-api';
import {
	EMPLOYMENT_TYPES,
	SKILL_CATEGORIES,
	newId,
	profileFromEmployee,
	type ProfessionalProfile,
	type ProfileAchievement,
	type ProfileCertification,
	type ProfileCustomSection,
	type ProfileEducation,
	type ProfileExperience,
	type ProfileInternship,
	type ProfileProject,
	type ProfilePublication,
	type SkillCategoryKey,
} from '@/lib/employee-professional-profile';

type Props = {
	employee: any;
	onEmployeeUpdate?: (next: any) => void;
	/** Lighter styling for mobile panel / light theme */
	compact?: boolean;
	/**
	 * When provided, used instead of the built-in self-service save path.
	 * Used by admins (e.g. verification-portal SUPER users) editing another
	 * employee's profile — bypasses `employeeToken()` / server-action fallback.
	 */
	saveOverride?: (profile: ProfessionalProfile) => Promise<{ employee?: any; profile?: ProfessionalProfile }>;
	/**
	 * Only wrkspace admins may write/edit "Remarks". Employees (self-service) only ever
	 * see remarks read-only — they cannot edit their own remarks.
	 */
	canEditRemarks?: boolean;
};

type Sx = {
	box: string;
	label: string;
	input: string;
	title: string;
	muted: string;
	btnGhost: string;
	btnDanger: string;
	tab: string;
	tabActive: string;
	chip: string;
};

const TABS: { key: string; label: string; hint: string }[] = [
	{ key: 'personal', label: 'Personal Info', hint: 'Contact, links & coding profiles' },
	{ key: 'summary', label: 'Summary', hint: 'Resume summary & objective' },
	{ key: 'experience', label: 'Work Experience', hint: 'Jobs you have held' },
	{ key: 'education', label: 'Education', hint: 'Degrees & institutions' },
	{ key: 'skills', label: 'Skills', hint: 'Tech & soft skills' },
	{ key: 'projects', label: 'Projects', hint: 'Things you built' },
	{ key: 'certifications', label: 'Certifications', hint: 'Courses & credentials' },
	{ key: 'achievements', label: 'Achievements', hint: 'Awards & recognitions' },
	{ key: 'internships', label: 'Internships', hint: 'Optional — internship roles' },
	{ key: 'publications', label: 'Publications', hint: 'Optional — papers & research' },
	{ key: 'custom', label: 'Custom Sections', hint: 'Anything else' },
];

async function fileToDataUrl(file: File, maxBytes = 350_000): Promise<string> {
	if (file.size > maxBytes * 1.5) {
		throw new Error('File too large — use a smaller image/PDF (under ~300KB)');
	}
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const result = String(reader.result || '');
			if (result.length > maxBytes * 1.4) {
				reject(new Error('File too large after encoding'));
				return;
			}
			resolve(result);
		};
		reader.onerror = () => reject(new Error('Failed to read file'));
		reader.readAsDataURL(file);
	});
}

export function EmployeeProfessionalProfileEditor({
	employee,
	onEmployeeUpdate,
	compact,
	saveOverride,
	canEditRemarks,
}: Props) {
	const initial = useMemo(() => profileFromEmployee(employee), [employee]);
	const [profile, setProfile] = useState<ProfessionalProfile>(initial);
	const [activeTab, setActiveTab] = useState('personal');
	const [saving, setSaving] = useState(false);
	const [loading, setLoading] = useState(Boolean(compact) && !saveOverride);
	const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

	// Mobile / embedded panels: pull latest profile from API (session employee is often stale).
	// Skipped entirely in admin-edit mode (`saveOverride`) — the `employee` prop already
	// carries the full raw record for the *target* employee; fetching `/api/auth/me/profile`
	// here would wrongly pull the *admin's own* employee token/profile if one happens to be
	// cached in this browser.
	useEffect(() => {
		if (saveOverride) {
			setLoading(false);
			return;
		}
		let cancelled = false;
		const load = async () => {
			if (!employeeToken()) {
				if (!cancelled) setLoading(false);
				return;
			}
			try {
				const data = await apiGet<{ profile?: ProfessionalProfile; employee?: any }>('/api/auth/me/profile');
				if (cancelled) return;
				if (data.profile) setProfile(data.profile);
				if (data.employee) onEmployeeUpdate?.({ ...employee, ...data.employee });
			} catch {
				/* keep initial from props */
			} finally {
				if (!cancelled) setLoading(false);
			}
		};
		void load();
		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [employee?.id, saveOverride]);

	const sx: Sx = compact
		? {
				box: 'rounded-xl border border-[#E2E8F0] bg-white p-4 space-y-3',
				label: 'text-[10px] font-bold uppercase tracking-wider text-[#64748B]',
				input:
					'w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#0047FF]',
				title: 'text-sm font-bold text-[#0F172A]',
				muted: 'text-xs text-[#64748B]',
				btnGhost: 'inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs font-semibold text-[#0047FF]',
				btnDanger: 'rounded-lg p-1.5 text-[#B42318]',
				tab: 'shrink-0 rounded-full border border-[#E2E8F0] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#475569] whitespace-nowrap',
				tabActive: 'shrink-0 rounded-full border border-[#0047FF] bg-[#0047FF] px-3.5 py-1.5 text-xs font-semibold text-white whitespace-nowrap',
				chip: 'inline-flex items-center gap-1 rounded-full bg-[#EFF4FF] border border-[#D7E3FF] px-2.5 py-1 text-xs font-medium text-[#0047FF]',
			}
		: {
				box: 'rounded-none border border-zinc-800 bg-zinc-900/30 p-5 space-y-3',
				label: 'text-[10px] font-bold uppercase tracking-wider text-zinc-500',
				input:
					'w-full border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-brand-500 rounded-none',
				title: 'text-sm font-bold text-white',
				muted: 'text-xs text-zinc-500',
				btnGhost: 'inline-flex items-center gap-1 border border-zinc-700 px-2.5 py-1.5 text-[11px] font-semibold text-brand-300',
				btnDanger: 'p-1.5 text-rose-400',
				tab: 'shrink-0 border border-zinc-800 bg-zinc-900/40 px-3.5 py-1.5 text-[11px] font-semibold text-zinc-400 whitespace-nowrap',
				tabActive: 'shrink-0 border border-brand-500 bg-brand-600 px-3.5 py-1.5 text-[11px] font-semibold text-white whitespace-nowrap',
				chip: 'inline-flex items-center gap-1 border border-brand-700/50 bg-brand-500/10 px-2.5 py-1 text-[11px] font-medium text-brand-300',
			};

	function setField<K extends keyof ProfessionalProfile>(key: K, value: ProfessionalProfile[K]) {
		setProfile((p) => ({ ...p, [key]: value }));
	}

	function addItem<K extends 'experience' | 'education' | 'projects' | 'certifications' | 'achievements' | 'internships' | 'publications' | 'customSections'>(
		key: K,
		factory: () => ProfessionalProfile[K][number],
	) {
		setProfile((p) => ({ ...p, [key]: [...(p[key] as any[]), factory()] }));
	}
	function updateItem<K extends 'experience' | 'education' | 'projects' | 'certifications' | 'achievements' | 'internships' | 'publications' | 'customSections'>(
		key: K,
		id: string,
		patch: Partial<ProfessionalProfile[K][number]>,
	) {
		setProfile((p) => ({
			...p,
			[key]: (p[key] as any[]).map((row) => (row.id === id ? { ...row, ...patch } : row)),
		}));
	}
	function removeItem<K extends 'experience' | 'education' | 'projects' | 'certifications' | 'achievements' | 'internships' | 'publications' | 'customSections'>(
		key: K,
		id: string,
	) {
		setProfile((p) => ({ ...p, [key]: (p[key] as any[]).filter((row) => row.id !== id) }));
	}

	function addTag(cat: SkillCategoryKey, raw: string) {
		const v = raw.trim();
		if (!v) return;
		setProfile((p) => {
			const cur = p.skills[cat] || [];
			if (cur.includes(v)) return p;
			return { ...p, skills: { ...p.skills, [cat]: [...cur, v] } };
		});
	}
	function removeTag(cat: SkillCategoryKey, v: string) {
		setProfile((p) => ({ ...p, skills: { ...p.skills, [cat]: (p.skills[cat] || []).filter((t) => t !== v) } }));
	}

	const save = async () => {
		setSaving(true);
		setMsg(null);
		try {
			if (saveOverride) {
				const data = await saveOverride(profile);
				if (data.employee) onEmployeeUpdate?.({ ...employee, ...data.employee });
				if (data.profile) setProfile(data.profile);
				setMsg({ type: 'ok', text: 'Profile saved.' });
				return;
			}
			// Prefer authenticated employee API (mobile web JWT); fall back to server action.
			if (employeeToken()) {
				const data = await apiPatch<{ employee?: any; profile?: ProfessionalProfile }>(
					'/api/auth/me/profile',
					profile as any,
				);
				onEmployeeUpdate?.({ ...employee, ...(data.employee || {}) });
				if (data.profile) setProfile(data.profile);
				setMsg({ type: 'ok', text: 'Profile saved — visible to verification companies.' });
				return;
			}
			const res = await updateEmployeeProfessionalProfile(employee.id, profile as any);
			if (!res.success) {
				setMsg({ type: 'err', text: res.error || 'Save failed' });
				return;
			}
			onEmployeeUpdate?.({ ...employee, ...(res.employee || {}) });
			if (res.profile) setProfile(res.profile as ProfessionalProfile);
			setMsg({ type: 'ok', text: 'Profile saved — visible to verification companies.' });
		} catch (e: any) {
			setMsg({ type: 'err', text: e?.message || 'Save failed' });
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<div className="flex justify-center py-12">
				<div className="size-6 animate-spin rounded-full border-2 border-[#0047FF] border-t-transparent" />
			</div>
		);
	}

	return (
		<div className="space-y-5">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h3 className={sx.title}>Professional details</h3>
					<p className={sx.muted}>
						Fill each section like a resume — this is what verification companies see about you.
					</p>
				</div>
				<button
					type="button"
					disabled={saving}
					onClick={() => void save()}
					className={
						compact
							? 'inline-flex items-center gap-2 rounded-xl bg-[#0047FF] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60'
							: 'inline-flex items-center gap-2 bg-brand-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60'
					}
				>
					<SaveIcon className="size-4" />
					{saving ? 'Saving…' : 'Save profile'}
				</button>
			</div>

			{msg ? (
				<p
					className={
						msg.type === 'ok'
							? compact
								? 'text-xs font-medium text-[#067647]'
								: 'text-xs text-emerald-400'
							: compact
								? 'text-xs font-medium text-[#B42318]'
								: 'text-xs text-rose-400'
					}
				>
					{msg.text}
				</p>
			) : null}

			<div className="flex gap-2 overflow-x-auto pb-1">
				{TABS.map((t) => (
					<button
						key={t.key}
						type="button"
						onClick={() => setActiveTab(t.key)}
						className={activeTab === t.key ? sx.tabActive : sx.tab}
						title={t.hint}
					>
						{t.label}
					</button>
				))}
			</div>

			{activeTab === 'personal' && (
				<PersonalTab employee={employee} profile={profile} setField={setField} sx={sx} />
			)}
			{activeTab === 'summary' && (
				<SummaryTab profile={profile} setField={setField} sx={sx} canEditRemarks={Boolean(canEditRemarks)} />
			)}
			{activeTab === 'experience' && (
				<ExperienceTab profile={profile} addItem={addItem} updateItem={updateItem} removeItem={removeItem} sx={sx} />
			)}
			{activeTab === 'education' && (
				<EducationTab profile={profile} addItem={addItem} updateItem={updateItem} removeItem={removeItem} sx={sx} />
			)}
			{activeTab === 'skills' && <SkillsTab profile={profile} addTag={addTag} removeTag={removeTag} sx={sx} />}
			{activeTab === 'projects' && (
				<ProjectsTab profile={profile} addItem={addItem} updateItem={updateItem} removeItem={removeItem} sx={sx} />
			)}
			{activeTab === 'certifications' && (
				<CertificationsTab
					profile={profile}
					addItem={addItem}
					updateItem={updateItem}
					removeItem={removeItem}
					sx={sx}
					setMsg={setMsg}
				/>
			)}
			{activeTab === 'achievements' && (
				<AchievementsTab profile={profile} addItem={addItem} updateItem={updateItem} removeItem={removeItem} sx={sx} setMsg={setMsg} />
			)}
			{activeTab === 'internships' && (
				<InternshipsTab profile={profile} addItem={addItem} updateItem={updateItem} removeItem={removeItem} sx={sx} />
			)}
			{activeTab === 'publications' && (
				<PublicationsTab profile={profile} addItem={addItem} updateItem={updateItem} removeItem={removeItem} sx={sx} />
			)}
			{activeTab === 'custom' && (
				<CustomSectionsTab profile={profile} addItem={addItem} updateItem={updateItem} removeItem={removeItem} sx={sx} />
			)}

			<div className="flex justify-end">
				<button
					type="button"
					disabled={saving}
					onClick={() => void save()}
					className={
						compact
							? 'inline-flex items-center gap-2 rounded-xl bg-[#0047FF] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60'
							: 'inline-flex items-center gap-2 bg-brand-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60'
					}
				>
					<SaveIcon className="size-4" />
					{saving ? 'Saving…' : 'Save profile'}
				</button>
			</div>
		</div>
	);
}

/* ---------- Shared small pieces ---------- */

function Field({
	sx,
	label,
	value,
	onChange,
	placeholder,
	readOnly,
	required,
}: {
	sx: Sx;
	label: string;
	value: string;
	onChange?: (v: string) => void;
	placeholder?: string;
	readOnly?: boolean;
	required?: boolean;
}) {
	return (
		<div className="space-y-1">
			<p className={sx.label}>
				{label}
				{required ? <span className="text-rose-500"> *</span> : null}
			</p>
			<input
				className={sx.input + (readOnly ? ' opacity-70 cursor-not-allowed' : '')}
				value={value}
				readOnly={readOnly}
				placeholder={placeholder}
				onChange={(e) => onChange?.(e.target.value)}
			/>
		</div>
	);
}

function TextArea({
	sx,
	label,
	value,
	onChange,
	placeholder,
	rows = 3,
}: {
	sx: Sx;
	label: string;
	value: string;
	onChange: (v: string) => void;
	placeholder?: string;
	rows?: number;
}) {
	return (
		<div className="space-y-1">
			<p className={sx.label}>{label}</p>
			<textarea
				className={sx.input}
				rows={rows}
				value={value}
				placeholder={placeholder}
				onChange={(e) => onChange(e.target.value)}
			/>
		</div>
	);
}

function Select({
	sx,
	label,
	value,
	onChange,
	options,
}: {
	sx: Sx;
	label: string;
	value: string;
	onChange: (v: string) => void;
	options: readonly string[];
}) {
	return (
		<div className="space-y-1">
			<p className={sx.label}>{label}</p>
			<select className={sx.input} value={value} onChange={(e) => onChange(e.target.value)}>
				<option value="">Select…</option>
				{options.map((o) => (
					<option key={o} value={o}>
						{o}
					</option>
				))}
			</select>
		</div>
	);
}

function EmptyHint({ sx, text }: { sx: Sx; text: string }) {
	return <p className={sx.muted}>{text}</p>;
}

function AddButton({ sx, onClick, label = 'Add' }: { sx: Sx; onClick: () => void; label?: string }) {
	return (
		<button type="button" className={sx.btnGhost} onClick={onClick}>
			<PlusIcon className="size-3.5" /> {label}
		</button>
	);
}

function RemoveButton({ sx, onClick, label }: { sx: Sx; onClick: () => void; label?: string }) {
	return (
		<button type="button" className={sx.btnDanger + ' inline-flex items-center gap-1'} onClick={onClick}>
			<Trash2Icon className="size-4" /> {label ? <span className="text-[11px] font-semibold">{label}</span> : null}
		</button>
	);
}

function ItemCard({ children }: { children: React.ReactNode }) {
	return <div className="space-y-2 border-t border-dashed border-zinc-800/40 pt-3 first:border-t-0 first:pt-0">{children}</div>;
}

/* ---------- Tab 1: Personal Info ---------- */

function PersonalTab({
	employee,
	profile,
	setField,
	sx,
}: {
	employee: any;
	profile: ProfessionalProfile;
	setField: <K extends keyof ProfessionalProfile>(key: K, value: ProfessionalProfile[K]) => void;
	sx: Sx;
}) {
	const fullName = `${employee.firstName || ''} ${employee.middleName ? employee.middleName + ' ' : ''}${employee.lastName || ''}`.trim();
	return (
		<div className="space-y-4">
			<section className={sx.box}>
				<p className={sx.label}>Account details (managed by admin)</p>
				<div className="grid gap-3 sm:grid-cols-2">
					<Field sx={sx} label="Full name" value={fullName} readOnly required />
					<Field sx={sx} label="Email" value={employee.email || ''} readOnly required />
					<Field sx={sx} label="Phone" value={employee.phone || ''} readOnly required />
					<Field sx={sx} label="Professional title" value={profile.professionalTitle} onChange={(v) => setField('professionalTitle', v)} placeholder="e.g. Full Stack Developer" />
				</div>
			</section>

			<section className={sx.box}>
				<p className={sx.label}>Location</p>
				<div className="grid gap-3 sm:grid-cols-3">
					<Field sx={sx} label="City" value={profile.city} onChange={(v) => setField('city', v)} />
					<Field sx={sx} label="State" value={profile.state} onChange={(v) => setField('state', v)} />
					<Field sx={sx} label="Country" value={profile.country} onChange={(v) => setField('country', v)} />
				</div>
			</section>

			<section className={sx.box}>
				<p className={sx.label}>Links</p>
				<div className="grid gap-3 sm:grid-cols-2">
					<Field sx={sx} label="LinkedIn URL" value={profile.linkedinUrl} onChange={(v) => setField('linkedinUrl', v)} placeholder="https://linkedin.com/in/…" />
					<Field sx={sx} label="GitHub URL" value={profile.githubUrl} onChange={(v) => setField('githubUrl', v)} placeholder="https://github.com/…" />
					<Field sx={sx} label="Portfolio website" value={profile.portfolioUrl} onChange={(v) => setField('portfolioUrl', v)} placeholder="https://…" />
				</div>
			</section>

			<section className={sx.box}>
				<p className={sx.label}>Competitive coding profiles</p>
				<div className="grid gap-3 sm:grid-cols-2">
					<Field sx={sx} label="LeetCode" value={profile.leetcodeUrl} onChange={(v) => setField('leetcodeUrl', v)} placeholder="https://leetcode.com/…" />
					<Field sx={sx} label="Codeforces" value={profile.codeforcesUrl} onChange={(v) => setField('codeforcesUrl', v)} placeholder="https://codeforces.com/profile/…" />
					<Field sx={sx} label="CodeChef" value={profile.codechefUrl} onChange={(v) => setField('codechefUrl', v)} placeholder="https://codechef.com/users/…" />
					<Field sx={sx} label="HackerRank" value={profile.hackerrankUrl} onChange={(v) => setField('hackerrankUrl', v)} placeholder="https://hackerrank.com/…" />
				</div>
			</section>

			<section className={sx.box}>
				<p className={sx.label}>Emergency contact (EC)</p>
				<div className="grid gap-2 sm:grid-cols-3">
					<Field sx={sx} label="Name" value={profile.emergencyContactName} onChange={(v) => setField('emergencyContactName', v)} />
					<Field sx={sx} label="Phone" value={profile.emergencyContactPhone} onChange={(v) => setField('emergencyContactPhone', v)} />
					<Field sx={sx} label="Relation" value={profile.emergencyContactRelation} onChange={(v) => setField('emergencyContactRelation', v)} />
				</div>
			</section>
		</div>
	);
}

/* ---------- Tab 2: Summary ---------- */

function SummaryTab({
	profile,
	setField,
	sx,
	canEditRemarks,
}: {
	profile: ProfessionalProfile;
	setField: <K extends keyof ProfessionalProfile>(key: K, value: ProfessionalProfile[K]) => void;
	sx: Sx;
	canEditRemarks: boolean;
}) {
	return (
		<section className={sx.box}>
			<TextArea sx={sx} label="Resume summary" rows={4} value={profile.about} onChange={(v) => setField('about', v)} placeholder="Short professional summary for companies reviewing your profile…" />
			<TextArea sx={sx} label="Career objective" rows={3} value={profile.careerObjective} onChange={(v) => setField('careerObjective', v)} placeholder="What you're looking for next…" />
			<div className="grid gap-3 sm:grid-cols-2">
				<Field sx={sx} label="Years of experience" value={profile.yearsOfExperience} onChange={(v) => setField('yearsOfExperience', v)} placeholder="e.g. Fresher, 1, 2.5" />
				<Field sx={sx} label="Industry" value={profile.industry} onChange={(v) => setField('industry', v)} placeholder="e.g. Software / EdTech" />
			</div>
			{canEditRemarks ? (
				<TextArea
					sx={sx}
					label="Admin remarks"
					rows={3}
					value={profile.remarks}
					onChange={(v) => setField('remarks', v)}
					placeholder="Internal notes visible only to wrkspace admins (strengths, risk flags, etc.)…"
				/>
			) : null}
		</section>
	);
}

/* ---------- Tab 3: Experience ---------- */

function ExperienceTab({ profile, addItem, updateItem, removeItem, sx }: ListTabProps) {
	const list = profile.experience;
	return (
		<section className={sx.box}>
			<div className="flex items-center justify-between">
				<p className={sx.label}>Work experience</p>
				<AddButton
					sx={sx}
					label="Add experience"
					onClick={() =>
						addItem('experience', () => ({
							id: newId(),
							title: '',
							employmentType: '',
							company: '',
							location: '',
							from: '',
							to: '',
							current: false,
							description: '',
							technologiesUsed: '',
						}))
					}
				/>
			</div>
			{list.length === 0 ? <EmptyHint sx={sx} text="No work experience yet." /> : null}
			{list.map((x: ProfileExperience) => (
				<ItemCard key={x.id}>
					<div className="grid gap-2 sm:grid-cols-2">
						<Field sx={sx} label="Job title" value={x.title} onChange={(v) => updateItem('experience', x.id, { title: v })} />
						<Select sx={sx} label="Employment type" value={x.employmentType || ''} onChange={(v) => updateItem('experience', x.id, { employmentType: v as any })} options={EMPLOYMENT_TYPES} />
						<Field sx={sx} label="Company" value={x.company} onChange={(v) => updateItem('experience', x.id, { company: v })} />
						<Field sx={sx} label="Location" value={x.location || ''} onChange={(v) => updateItem('experience', x.id, { location: v })} />
						<Field sx={sx} label="Start year" value={x.from || ''} onChange={(v) => updateItem('experience', x.id, { from: v })} />
						<Field sx={sx} label="End year" value={x.current ? 'Present' : x.to || ''} onChange={(v) => updateItem('experience', x.id, { to: v })} readOnly={x.current} />
					</div>
					<label className={`flex items-center gap-2 ${sx.muted}`}>
						<input type="checkbox" checked={Boolean(x.current)} onChange={(e) => updateItem('experience', x.id, { current: e.target.checked })} />
						Currently working here
					</label>
					<TextArea sx={sx} label="Responsibilities" rows={3} value={x.description || ''} onChange={(v) => updateItem('experience', x.id, { description: v })} placeholder="What you did…" />
					<Field sx={sx} label="Technologies used" value={x.technologiesUsed || ''} onChange={(v) => updateItem('experience', x.id, { technologiesUsed: v })} placeholder="e.g. React, Node.js, PostgreSQL" />
					<RemoveButton sx={sx} label="Remove" onClick={() => removeItem('experience', x.id)} />
				</ItemCard>
			))}
		</section>
	);
}

/* ---------- Tab 4: Education ---------- */

function EducationTab({ profile, addItem, updateItem, removeItem, sx }: ListTabProps) {
	const list = profile.education;
	return (
		<section className={sx.box}>
			<div className="flex items-center justify-between">
				<p className={sx.label}>Education</p>
				<AddButton
					sx={sx}
					label="Add education"
					onClick={() => addItem('education', () => ({ id: newId(), institution: '', degree: '', specialization: '', cgpa: '', from: '', to: '' }))}
				/>
			</div>
			{list.length === 0 ? <EmptyHint sx={sx} text="No education entries yet." /> : null}
			{list.map((q: ProfileEducation) => (
				<ItemCard key={q.id}>
					<div className="grid gap-2 sm:grid-cols-2">
						<Field sx={sx} label="College / University" value={q.institution} onChange={(v) => updateItem('education', q.id, { institution: v })} />
						<Field sx={sx} label="Degree" value={q.degree} onChange={(v) => updateItem('education', q.id, { degree: v })} />
						<Field sx={sx} label="Specialization" value={q.specialization || ''} onChange={(v) => updateItem('education', q.id, { specialization: v })} />
						<Field sx={sx} label="CGPA" value={q.cgpa || ''} onChange={(v) => updateItem('education', q.id, { cgpa: v })} />
						<Field sx={sx} label="Start year" value={q.from || ''} onChange={(v) => updateItem('education', q.id, { from: v })} />
						<Field sx={sx} label="End year" value={q.to || ''} onChange={(v) => updateItem('education', q.id, { to: v })} />
					</div>
					<RemoveButton sx={sx} label="Remove" onClick={() => removeItem('education', q.id)} />
				</ItemCard>
			))}
		</section>
	);
}

/* ---------- Tab 5: Skills ---------- */

function SkillsTab({
	profile,
	addTag,
	removeTag,
	sx,
}: {
	profile: ProfessionalProfile;
	addTag: (cat: SkillCategoryKey, raw: string) => void;
	removeTag: (cat: SkillCategoryKey, v: string) => void;
	sx: Sx;
}) {
	const [drafts, setDrafts] = useState<Record<string, string>>({});
	return (
		<div className="space-y-4">
			{SKILL_CATEGORIES.map(({ key, label }) => {
				const tags = profile.skills[key] || [];
				const draft = drafts[key] || '';
				const commit = () => {
					if (draft.trim()) {
						addTag(key, draft);
						setDrafts((d) => ({ ...d, [key]: '' }));
					}
				};
				return (
					<section key={key} className={sx.box}>
						<p className={sx.label}>{label}</p>
						<div className="flex flex-wrap gap-2">
							{tags.length === 0 ? <EmptyHint sx={sx} text="None added yet." /> : null}
							{tags.map((t) => (
								<span key={t} className={sx.chip}>
									{t}
									<button type="button" onClick={() => removeTag(key, t)} aria-label={`Remove ${t}`}>
										<XIcon className="size-3" />
									</button>
								</span>
							))}
						</div>
						<div className="flex gap-2">
							<input
								className={sx.input}
								placeholder={`Add ${label.toLowerCase()} — press Enter`}
								value={draft}
								onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
								onKeyDown={(e) => {
									if (e.key === 'Enter' || e.key === ',') {
										e.preventDefault();
										commit();
									}
								}}
							/>
							<AddButton sx={sx} onClick={commit} />
						</div>
					</section>
				);
			})}
		</div>
	);
}

/* ---------- Tab 6: Projects ---------- */

function ProjectsTab({ profile, addItem, updateItem, removeItem, sx }: ListTabProps) {
	const list = profile.projects;
	return (
		<section className={sx.box}>
			<div className="flex items-center justify-between">
				<p className={sx.label}>Projects</p>
				<AddButton sx={sx} label="Add project" onClick={() => addItem('projects', () => ({ id: newId(), name: '', role: '', githubUrl: '', liveUrl: '', tech: '', description: '' }))} />
			</div>
			{list.length === 0 ? <EmptyHint sx={sx} text="No projects yet." /> : null}
			{list.map((p: ProfileProject) => (
				<ItemCard key={p.id}>
					<div className="grid gap-2 sm:grid-cols-2">
						<Field sx={sx} label="Project name" value={p.name} onChange={(v) => updateItem('projects', p.id, { name: v })} />
						<Field sx={sx} label="Your role" value={p.role || ''} onChange={(v) => updateItem('projects', p.id, { role: v })} />
						<Field sx={sx} label="GitHub link" value={p.githubUrl || ''} onChange={(v) => updateItem('projects', p.id, { githubUrl: v })} placeholder="https://github.com/…" />
						<Field sx={sx} label="Live demo" value={p.liveUrl || ''} onChange={(v) => updateItem('projects', p.id, { liveUrl: v })} placeholder="https://…" />
					</div>
					<Field sx={sx} label="Tech stack" value={p.tech || ''} onChange={(v) => updateItem('projects', p.id, { tech: v })} placeholder="e.g. React, Express, MongoDB" />
					<TextArea sx={sx} label="Description" rows={3} value={p.description || ''} onChange={(v) => updateItem('projects', p.id, { description: v })} />
					<RemoveButton sx={sx} label="Remove" onClick={() => removeItem('projects', p.id)} />
				</ItemCard>
			))}
		</section>
	);
}

/* ---------- Tab 7: Certifications ---------- */

function CertificationsTab({
	profile,
	addItem,
	updateItem,
	removeItem,
	sx,
	setMsg,
}: ListTabProps & { setMsg: (m: { type: 'ok' | 'err'; text: string } | null) => void }) {
	const list = profile.certifications;
	return (
		<section className={sx.box}>
			<div className="flex items-center justify-between">
				<p className={sx.label}>Certifications</p>
				<AddButton sx={sx} label="Add certification" onClick={() => addItem('certifications', () => ({ id: newId(), name: '', issuer: '', credentialId: '', credentialUrl: '', issueDate: '', fileUrl: '' }))} />
			</div>
			{list.length === 0 ? <EmptyHint sx={sx} text="No certifications yet." /> : null}
			{list.map((c: ProfileCertification) => (
				<ItemCard key={c.id}>
					<div className="grid gap-2 sm:grid-cols-2">
						<Field sx={sx} label="Certification name" value={c.name} onChange={(v) => updateItem('certifications', c.id, { name: v })} />
						<Field sx={sx} label="Organization" value={c.issuer || ''} onChange={(v) => updateItem('certifications', c.id, { issuer: v })} />
						<Field sx={sx} label="Credential ID" value={c.credentialId || ''} onChange={(v) => updateItem('certifications', c.id, { credentialId: v })} />
						<Field sx={sx} label="Credential URL" value={c.credentialUrl || ''} onChange={(v) => updateItem('certifications', c.id, { credentialUrl: v })} />
						<Field sx={sx} label="Issue date" value={c.issueDate || ''} onChange={(v) => updateItem('certifications', c.id, { issueDate: v })} placeholder="e.g. Jan 2024" />
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<label className={`${sx.btnGhost} cursor-pointer`}>
							<UploadIcon className="size-3.5" />
							{c.fileUrl ? 'Replace file' : 'Upload certificate'}
							<input
								type="file"
								accept="image/*,application/pdf"
								className="hidden"
								onChange={(e) => {
									const f = e.target.files?.[0];
									e.target.value = '';
									if (!f) return;
									void fileToDataUrl(f)
										.then((url) => updateItem('certifications', c.id, { fileUrl: url }))
										.catch((err) => setMsg({ type: 'err', text: err.message || 'Upload failed' }));
								}}
							/>
						</label>
						{c.fileUrl ? <span className={sx.muted}>File attached</span> : null}
					</div>
					<RemoveButton sx={sx} label="Remove" onClick={() => removeItem('certifications', c.id)} />
				</ItemCard>
			))}
		</section>
	);
}

/* ---------- Tab 8: Achievements ---------- */

function AchievementsTab({
	profile,
	addItem,
	updateItem,
	removeItem,
	sx,
	setMsg,
}: ListTabProps & { setMsg: (m: { type: 'ok' | 'err'; text: string } | null) => void }) {
	const list = profile.achievements;
	return (
		<section className={sx.box}>
			<div className="flex items-center justify-between">
				<p className={sx.label}>Achievements &amp; awards</p>
				<AddButton sx={sx} label="Add achievement" onClick={() => addItem('achievements', () => ({ id: newId(), title: '', organization: '', date: '', description: '', fileUrl: '' }))} />
			</div>
			{list.length === 0 ? <EmptyHint sx={sx} text="No achievements yet." /> : null}
			{list.map((a: ProfileAchievement) => (
				<ItemCard key={a.id}>
					<div className="grid gap-2 sm:grid-cols-2">
						<Field sx={sx} label="Title" value={a.title} onChange={(v) => updateItem('achievements', a.id, { title: v })} />
						<Field sx={sx} label="Organization" value={a.organization || ''} onChange={(v) => updateItem('achievements', a.id, { organization: v })} />
						<Field sx={sx} label="Date" value={a.date || ''} onChange={(v) => updateItem('achievements', a.id, { date: v })} />
					</div>
					<TextArea sx={sx} label="Description" rows={2} value={a.description || ''} onChange={(v) => updateItem('achievements', a.id, { description: v })} />
					<div className="flex flex-wrap items-center gap-2">
						<label className={`${sx.btnGhost} cursor-pointer`}>
							<UploadIcon className="size-3.5" />
							{a.fileUrl ? 'Replace file' : 'Upload certificate (optional)'}
							<input
								type="file"
								accept="image/*,application/pdf"
								className="hidden"
								onChange={(e) => {
									const f = e.target.files?.[0];
									e.target.value = '';
									if (!f) return;
									void fileToDataUrl(f)
										.then((url) => updateItem('achievements', a.id, { fileUrl: url }))
										.catch((err) => setMsg({ type: 'err', text: err.message || 'Upload failed' }));
								}}
							/>
						</label>
						{a.fileUrl ? <span className={sx.muted}>File attached</span> : null}
					</div>
					<RemoveButton sx={sx} label="Remove" onClick={() => removeItem('achievements', a.id)} />
				</ItemCard>
			))}
		</section>
	);
}

/* ---------- Tab 9: Internships ---------- */

function InternshipsTab({ profile, addItem, updateItem, removeItem, sx }: ListTabProps) {
	const list = profile.internships;
	return (
		<section className={sx.box}>
			<div className="flex items-center justify-between">
				<div>
					<p className={sx.label}>Internships</p>
					<p className={sx.muted}>Optional — same as work experience, no employment type.</p>
				</div>
				<AddButton sx={sx} label="Add internship" onClick={() => addItem('internships', () => ({ id: newId(), title: '', company: '', location: '', from: '', to: '', current: false, description: '', technologiesUsed: '' }))} />
			</div>
			{list.length === 0 ? <EmptyHint sx={sx} text="No internships yet." /> : null}
			{list.map((x: ProfileInternship) => (
				<ItemCard key={x.id}>
					<div className="grid gap-2 sm:grid-cols-2">
						<Field sx={sx} label="Job title" value={x.title} onChange={(v) => updateItem('internships', x.id, { title: v })} />
						<Field sx={sx} label="Company" value={x.company} onChange={(v) => updateItem('internships', x.id, { company: v })} />
						<Field sx={sx} label="Location" value={x.location || ''} onChange={(v) => updateItem('internships', x.id, { location: v })} />
						<Field sx={sx} label="Start year" value={x.from || ''} onChange={(v) => updateItem('internships', x.id, { from: v })} />
						<Field sx={sx} label="End year" value={x.current ? 'Present' : x.to || ''} onChange={(v) => updateItem('internships', x.id, { to: v })} readOnly={x.current} />
					</div>
					<label className={`flex items-center gap-2 ${sx.muted}`}>
						<input type="checkbox" checked={Boolean(x.current)} onChange={(e) => updateItem('internships', x.id, { current: e.target.checked })} />
						Currently working here
					</label>
					<TextArea sx={sx} label="Responsibilities" rows={3} value={x.description || ''} onChange={(v) => updateItem('internships', x.id, { description: v })} />
					<Field sx={sx} label="Technologies used" value={x.technologiesUsed || ''} onChange={(v) => updateItem('internships', x.id, { technologiesUsed: v })} />
					<RemoveButton sx={sx} label="Remove" onClick={() => removeItem('internships', x.id)} />
				</ItemCard>
			))}
		</section>
	);
}

/* ---------- Tab 10: Publications ---------- */

function PublicationsTab({ profile, addItem, updateItem, removeItem, sx }: ListTabProps) {
	const list = profile.publications;
	return (
		<section className={sx.box}>
			<div className="flex items-center justify-between">
				<div>
					<p className={sx.label}>Publications &amp; research</p>
					<p className={sx.muted}>Optional</p>
				</div>
				<AddButton sx={sx} label="Add publication" onClick={() => addItem('publications', () => ({ id: newId(), title: '', authors: '', journal: '', conference: '', year: '', url: '', abstract: '' }))} />
			</div>
			{list.length === 0 ? <EmptyHint sx={sx} text="No publications yet." /> : null}
			{list.map((p: ProfilePublication) => (
				<ItemCard key={p.id}>
					<Field sx={sx} label="Paper title" value={p.title} onChange={(v) => updateItem('publications', p.id, { title: v })} required />
					<div className="grid gap-2 sm:grid-cols-2">
						<Field sx={sx} label="Authors" value={p.authors || ''} onChange={(v) => updateItem('publications', p.id, { authors: v })} />
						<Field sx={sx} label="Journal" value={p.journal || ''} onChange={(v) => updateItem('publications', p.id, { journal: v })} />
						<Field sx={sx} label="Conference" value={p.conference || ''} onChange={(v) => updateItem('publications', p.id, { conference: v })} />
						<Field sx={sx} label="Year" value={p.year || ''} onChange={(v) => updateItem('publications', p.id, { year: v })} />
						<Field sx={sx} label="DOI / URL" value={p.url || ''} onChange={(v) => updateItem('publications', p.id, { url: v })} />
					</div>
					<TextArea sx={sx} label="Abstract / summary" rows={3} value={p.abstract || ''} onChange={(v) => updateItem('publications', p.id, { abstract: v })} />
					<RemoveButton sx={sx} label="Remove" onClick={() => removeItem('publications', p.id)} />
				</ItemCard>
			))}
		</section>
	);
}

/* ---------- Tab 11: Custom Sections ---------- */

function CustomSectionsTab({ profile, addItem, updateItem, removeItem, sx }: ListTabProps) {
	const list = profile.customSections;
	return (
		<section className={sx.box}>
			<div className="flex items-center justify-between">
				<div>
					<p className={sx.label}>Custom sections</p>
					<p className={sx.muted}>Optional — anything not covered above</p>
				</div>
				<AddButton sx={sx} label="Add section" onClick={() => addItem('customSections', () => ({ id: newId(), title: '', content: '' }))} />
			</div>
			{list.length === 0 ? <EmptyHint sx={sx} text="No custom sections yet." /> : null}
			{list.map((c: ProfileCustomSection) => (
				<ItemCard key={c.id}>
					<Field sx={sx} label="Section title" value={c.title} onChange={(v) => updateItem('customSections', c.id, { title: v })} />
					<TextArea sx={sx} label="Content" rows={4} value={c.content} onChange={(v) => updateItem('customSections', c.id, { content: v })} />
					<RemoveButton sx={sx} label="Remove" onClick={() => removeItem('customSections', c.id)} />
				</ItemCard>
			))}
		</section>
	);
}

type ListTabProps = {
	profile: ProfessionalProfile;
	addItem: <K extends 'experience' | 'education' | 'projects' | 'certifications' | 'achievements' | 'internships' | 'publications' | 'customSections'>(
		key: K,
		factory: () => ProfessionalProfile[K][number],
	) => void;
	updateItem: <K extends 'experience' | 'education' | 'projects' | 'certifications' | 'achievements' | 'internships' | 'publications' | 'customSections'>(
		key: K,
		id: string,
		patch: Partial<ProfessionalProfile[K][number]>,
	) => void;
	removeItem: <K extends 'experience' | 'education' | 'projects' | 'certifications' | 'achievements' | 'internships' | 'publications' | 'customSections'>(
		key: K,
		id: string,
	) => void;
	sx: Sx;
};
