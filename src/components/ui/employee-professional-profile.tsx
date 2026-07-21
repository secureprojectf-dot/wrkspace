'use client';

import { useMemo, useState } from 'react';
import { PlusIcon, Trash2Icon, SaveIcon, UploadIcon } from 'lucide-react';
import { updateEmployeeProfessionalProfile } from '@/app/admin/actions';
import {
	newId,
	profileFromEmployee,
	type ProfileCertification,
	type ProfileExperience,
	type ProfileProject,
	type ProfileQualification,
	type ProfessionalProfile,
} from '@/lib/employee-professional-profile';

type Props = {
	employee: any;
	onEmployeeUpdate?: (next: any) => void;
	/** Lighter styling for mobile panel */
	compact?: boolean;
};

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

export function EmployeeProfessionalProfileEditor({ employee, onEmployeeUpdate, compact }: Props) {
	const initial = useMemo(() => profileFromEmployee(employee), [employee]);
	const [about, setAbout] = useState(initial.about);
	const [remarks, setRemarks] = useState(initial.remarks);
	const [qualifications, setQualifications] = useState<ProfileQualification[]>(initial.qualifications);
	const [certifications, setCertifications] = useState<ProfileCertification[]>(initial.certifications);
	const [experience, setExperience] = useState<ProfileExperience[]>(initial.experience);
	const [projects, setProjects] = useState<ProfileProject[]>(initial.projects);
	const [ecName, setEcName] = useState(initial.emergencyContactName);
	const [ecPhone, setEcPhone] = useState(initial.emergencyContactPhone);
	const [ecRelation, setEcRelation] = useState(initial.emergencyContactRelation);
	const [saving, setSaving] = useState(false);
	const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

	const save = async () => {
		setSaving(true);
		setMsg(null);
		const payload: ProfessionalProfile = {
			about,
			remarks,
			qualifications,
			certifications,
			experience,
			projects,
			emergencyContactName: ecName,
			emergencyContactPhone: ecPhone,
			emergencyContactRelation: ecRelation,
		};
		try {
			const res = await updateEmployeeProfessionalProfile(employee.id, payload as any);
			if (!res.success) {
				setMsg({ type: 'err', text: res.error || 'Save failed' });
				return;
			}
			onEmployeeUpdate?.({ ...employee, ...(res.employee || {}) });
			setMsg({ type: 'ok', text: 'Profile saved — visible to verification companies.' });
		} catch (e: any) {
			setMsg({ type: 'err', text: e?.message || 'Save failed' });
		} finally {
			setSaving(false);
		}
	};

	const box = compact
		? 'rounded-xl border border-[#E2E8F0] bg-white p-4 space-y-3'
		: 'rounded-none border border-zinc-800 bg-zinc-900/30 p-5 space-y-3';
	const label = compact
		? 'text-[10px] font-bold uppercase tracking-wider text-[#64748B]'
		: 'text-[10px] font-bold uppercase tracking-wider text-zinc-500';
	const input = compact
		? 'w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#0047FF]'
		: 'w-full border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-brand-500 rounded-none';
	const title = compact ? 'text-sm font-bold text-[#0F172A]' : 'text-sm font-bold text-white';
	const muted = compact ? 'text-xs text-[#64748B]' : 'text-xs text-zinc-500';
	const btnGhost = compact
		? 'inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs font-semibold text-[#0047FF]'
		: 'inline-flex items-center gap-1 border border-zinc-700 px-2.5 py-1.5 text-[11px] font-semibold text-brand-300';
	const btnDanger = compact
		? 'rounded-lg p-1.5 text-[#B42318]'
		: 'p-1.5 text-rose-400';

	return (
		<div className="space-y-5">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h3 className={title}>Professional profile</h3>
					<p className={muted}>
						About, qualifications, certifications, experience &amp; projects — shown to verification
						companies.
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

			<section className={box}>
				<p className={label}>About</p>
				<textarea
					rows={4}
					value={about}
					onChange={(e) => setAbout(e.target.value)}
					placeholder="Short professional summary for companies reviewing your profile…"
					className={input}
				/>
				<p className={label}>Remarks</p>
				<textarea
					rows={3}
					value={remarks}
					onChange={(e) => setRemarks(e.target.value)}
					placeholder="Anything else companies should know (career goals, availability, notes)…"
					className={input}
				/>
			</section>

			<section className={box}>
				<div className="flex items-center justify-between gap-2">
					<p className={label}>Emergency contact (EC)</p>
				</div>
				<div className="grid gap-2 sm:grid-cols-3">
					<input className={input} placeholder="Name" value={ecName} onChange={(e) => setEcName(e.target.value)} />
					<input className={input} placeholder="Phone" value={ecPhone} onChange={(e) => setEcPhone(e.target.value)} />
					<input
						className={input}
						placeholder="Relation"
						value={ecRelation}
						onChange={(e) => setEcRelation(e.target.value)}
					/>
				</div>
			</section>

			<section className={box}>
				<div className="flex items-center justify-between">
					<p className={label}>Qualifications</p>
					<button
						type="button"
						className={btnGhost}
						onClick={() =>
							setQualifications((list) => [
								...list,
								{ id: newId(), degree: '', institution: '', year: '' },
							])
						}
					>
						<PlusIcon className="size-3.5" /> Add
					</button>
				</div>
				{qualifications.length === 0 ? <p className={muted}>No qualifications yet.</p> : null}
				{qualifications.map((q, i) => (
					<div key={q.id} className="grid gap-2 border-t border-dashed border-zinc-800/40 pt-3 sm:grid-cols-2">
						<input
							className={input}
							placeholder="Degree / course"
							value={q.degree}
							onChange={(e) =>
								setQualifications((list) => list.map((x, idx) => (idx === i ? { ...x, degree: e.target.value } : x)))
							}
						/>
						<input
							className={input}
							placeholder="Institution"
							value={q.institution}
							onChange={(e) =>
								setQualifications((list) =>
									list.map((x, idx) => (idx === i ? { ...x, institution: e.target.value } : x)),
								)
							}
						/>
						<input
							className={input}
							placeholder="Year"
							value={q.year || ''}
							onChange={(e) =>
								setQualifications((list) => list.map((x, idx) => (idx === i ? { ...x, year: e.target.value } : x)))
							}
						/>
						<div className="flex gap-2">
							<input
								className={`${input} flex-1`}
								placeholder="Details (optional)"
								value={q.details || ''}
								onChange={(e) =>
									setQualifications((list) =>
										list.map((x, idx) => (idx === i ? { ...x, details: e.target.value } : x)),
									)
								}
							/>
							<button type="button" className={btnDanger} onClick={() => setQualifications((list) => list.filter((_, idx) => idx !== i))}>
								<Trash2Icon className="size-4" />
							</button>
						</div>
					</div>
				))}
			</section>

			<section className={box}>
				<div className="flex items-center justify-between">
					<p className={label}>Certifications</p>
					<button
						type="button"
						className={btnGhost}
						onClick={() =>
							setCertifications((list) => [...list, { id: newId(), name: '', issuer: '', year: '' }])
						}
					>
						<PlusIcon className="size-3.5" /> Add
					</button>
				</div>
				{certifications.length === 0 ? <p className={muted}>No certifications yet.</p> : null}
				{certifications.map((c, i) => (
					<div key={c.id} className="space-y-2 border-t border-dashed border-zinc-800/40 pt-3">
						<div className="grid gap-2 sm:grid-cols-2">
							<input
								className={input}
								placeholder="Certificate name"
								value={c.name}
								onChange={(e) =>
									setCertifications((list) => list.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)))
								}
							/>
							<input
								className={input}
								placeholder="Issuer"
								value={c.issuer || ''}
								onChange={(e) =>
									setCertifications((list) =>
										list.map((x, idx) => (idx === i ? { ...x, issuer: e.target.value } : x)),
									)
								}
							/>
							<input
								className={input}
								placeholder="Year"
								value={c.year || ''}
								onChange={(e) =>
									setCertifications((list) => list.map((x, idx) => (idx === i ? { ...x, year: e.target.value } : x)))
								}
							/>
							<input
								className={input}
								placeholder="Credential URL (optional)"
								value={c.credentialUrl || ''}
								onChange={(e) =>
									setCertifications((list) =>
										list.map((x, idx) => (idx === i ? { ...x, credentialUrl: e.target.value } : x)),
									)
								}
							/>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<label className={`${btnGhost} cursor-pointer`}>
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
											.then((url) =>
												setCertifications((list) =>
													list.map((x, idx) => (idx === i ? { ...x, fileUrl: url } : x)),
												),
											)
											.catch((err) => setMsg({ type: 'err', text: err.message || 'Upload failed' }));
									}}
								/>
							</label>
							{c.fileUrl ? <span className={muted}>File attached</span> : null}
							<button type="button" className={btnDanger} onClick={() => setCertifications((list) => list.filter((_, idx) => idx !== i))}>
								<Trash2Icon className="size-4" />
							</button>
						</div>
					</div>
				))}
			</section>

			<section className={box}>
				<div className="flex items-center justify-between">
					<p className={label}>Experience</p>
					<button
						type="button"
						className={btnGhost}
						onClick={() =>
							setExperience((list) => [
								...list,
								{ id: newId(), title: '', company: '', from: '', to: '', current: false },
							])
						}
					>
						<PlusIcon className="size-3.5" /> Add
					</button>
				</div>
				{experience.length === 0 ? <p className={muted}>No experience entries yet.</p> : null}
				{experience.map((x, i) => (
					<div key={x.id} className="space-y-2 border-t border-dashed border-zinc-800/40 pt-3">
						<div className="grid gap-2 sm:grid-cols-2">
							<input
								className={input}
								placeholder="Title / role"
								value={x.title}
								onChange={(e) =>
									setExperience((list) => list.map((row, idx) => (idx === i ? { ...row, title: e.target.value } : row)))
								}
							/>
							<input
								className={input}
								placeholder="Company"
								value={x.company}
								onChange={(e) =>
									setExperience((list) =>
										list.map((row, idx) => (idx === i ? { ...row, company: e.target.value } : row)),
									)
								}
							/>
							<input
								className={input}
								placeholder="From (e.g. 2022)"
								value={x.from || ''}
								onChange={(e) =>
									setExperience((list) => list.map((row, idx) => (idx === i ? { ...row, from: e.target.value } : row)))
								}
							/>
							<input
								className={input}
								placeholder="To"
								disabled={x.current}
								value={x.current ? 'Present' : x.to || ''}
								onChange={(e) =>
									setExperience((list) => list.map((row, idx) => (idx === i ? { ...row, to: e.target.value } : row)))
								}
							/>
						</div>
						<label className={`flex items-center gap-2 ${muted}`}>
							<input
								type="checkbox"
								checked={Boolean(x.current)}
								onChange={(e) =>
									setExperience((list) =>
										list.map((row, idx) => (idx === i ? { ...row, current: e.target.checked } : row)),
									)
								}
							/>
							Currently working here
						</label>
						<textarea
							className={input}
							rows={2}
							placeholder="What you did…"
							value={x.description || ''}
							onChange={(e) =>
								setExperience((list) =>
									list.map((row, idx) => (idx === i ? { ...row, description: e.target.value } : row)),
								)
							}
						/>
						<button type="button" className={btnDanger} onClick={() => setExperience((list) => list.filter((_, idx) => idx !== i))}>
							<Trash2Icon className="size-4" /> Remove
						</button>
					</div>
				))}
			</section>

			<section className={box}>
				<div className="flex items-center justify-between">
					<p className={label}>Projects</p>
					<button
						type="button"
						className={btnGhost}
						onClick={() => setProjects((list) => [...list, { id: newId(), name: '', role: '', year: '' }])}
					>
						<PlusIcon className="size-3.5" /> Add
					</button>
				</div>
				{projects.length === 0 ? <p className={muted}>No projects yet.</p> : null}
				{projects.map((p, i) => (
					<div key={p.id} className="space-y-2 border-t border-dashed border-zinc-800/40 pt-3">
						<div className="grid gap-2 sm:grid-cols-2">
							<input
								className={input}
								placeholder="Project name"
								value={p.name}
								onChange={(e) =>
									setProjects((list) => list.map((row, idx) => (idx === i ? { ...row, name: e.target.value } : row)))
								}
							/>
							<input
								className={input}
								placeholder="Your role"
								value={p.role || ''}
								onChange={(e) =>
									setProjects((list) => list.map((row, idx) => (idx === i ? { ...row, role: e.target.value } : row)))
								}
							/>
							<input
								className={input}
								placeholder="Year"
								value={p.year || ''}
								onChange={(e) =>
									setProjects((list) => list.map((row, idx) => (idx === i ? { ...row, year: e.target.value } : row)))
								}
							/>
							<input
								className={input}
								placeholder="Link (optional)"
								value={p.url || ''}
								onChange={(e) =>
									setProjects((list) => list.map((row, idx) => (idx === i ? { ...row, url: e.target.value } : row)))
								}
							/>
						</div>
						<input
							className={input}
							placeholder="Tech stack"
							value={p.tech || ''}
							onChange={(e) =>
								setProjects((list) => list.map((row, idx) => (idx === i ? { ...row, tech: e.target.value } : row)))
							}
						/>
						<textarea
							className={input}
							rows={2}
							placeholder="Description…"
							value={p.description || ''}
							onChange={(e) =>
								setProjects((list) =>
									list.map((row, idx) => (idx === i ? { ...row, description: e.target.value } : row)),
								)
							}
						/>
						<button type="button" className={btnDanger} onClick={() => setProjects((list) => list.filter((_, idx) => idx !== i))}>
							<Trash2Icon className="size-4" /> Remove
						</button>
					</div>
				))}
			</section>
		</div>
	);
}
