/** Shared shapes for employee professional profile (company-facing). */

export type ProfileQualification = {
	id: string;
	degree: string;
	institution: string;
	year?: string;
	details?: string;
};

export type ProfileCertification = {
	id: string;
	name: string;
	issuer?: string;
	year?: string;
	credentialUrl?: string;
	/** Optional certificate image / PDF as data URL or https */
	fileUrl?: string;
};

export type ProfileExperience = {
	id: string;
	title: string;
	company: string;
	from?: string;
	to?: string;
	current?: boolean;
	description?: string;
};

export type ProfileProject = {
	id: string;
	name: string;
	role?: string;
	year?: string;
	url?: string;
	tech?: string;
	description?: string;
};

export type ProfessionalProfile = {
	about: string;
	remarks: string;
	qualifications: ProfileQualification[];
	certifications: ProfileCertification[];
	experience: ProfileExperience[];
	projects: ProfileProject[];
	emergencyContactName: string;
	emergencyContactPhone: string;
	emergencyContactRelation: string;
};

export function newId() {
	return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function parseJsonArray<T>(raw: unknown): T[] {
	if (Array.isArray(raw)) return raw as T[];
	if (typeof raw !== 'string' || !raw.trim()) return [];
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? (parsed as T[]) : [];
	} catch {
		return [];
	}
}

export function profileFromEmployee(emp: Record<string, unknown> | null | undefined): ProfessionalProfile {
	const e = emp || {};
	return {
		about: String(e.about || ''),
		remarks: String(e.remarks || ''),
		qualifications: parseJsonArray<ProfileQualification>(e.qualifications),
		certifications: parseJsonArray<ProfileCertification>(e.certifications),
		experience: parseJsonArray<ProfileExperience>(e.experience),
		projects: parseJsonArray<ProfileProject>(e.projects),
		emergencyContactName: String(e.emergencyContactName || ''),
		emergencyContactPhone: String(e.emergencyContactPhone || ''),
		emergencyContactRelation: String(e.emergencyContactRelation || ''),
	};
}

function clip(s: unknown, max: number) {
	return String(s ?? '').trim().slice(0, max);
}

/** Sanitize payload before DB write (JSON columns stay compact). */
export function sanitizeProfessionalProfile(input: Partial<ProfessionalProfile>) {
	const quals = (input.qualifications || [])
		.slice(0, 20)
		.map((q) => ({
			id: clip(q.id, 40) || newId(),
			degree: clip(q.degree, 120),
			institution: clip(q.institution, 160),
			year: clip(q.year, 20) || undefined,
			details: clip(q.details, 400) || undefined,
		}))
		.filter((q) => q.degree || q.institution);

	const certs = (input.certifications || [])
		.slice(0, 20)
		.map((c) => ({
			id: clip(c.id, 40) || newId(),
			name: clip(c.name, 160),
			issuer: clip(c.issuer, 120) || undefined,
			year: clip(c.year, 20) || undefined,
			credentialUrl: clip(c.credentialUrl, 500) || undefined,
			fileUrl: clip(c.fileUrl, 900_000) || undefined,
		}))
		.filter((c) => c.name);

	const experience = (input.experience || [])
		.slice(0, 25)
		.map((x) => ({
			id: clip(x.id, 40) || newId(),
			title: clip(x.title, 120),
			company: clip(x.company, 120),
			from: clip(x.from, 40) || undefined,
			to: clip(x.to, 40) || undefined,
			current: Boolean(x.current),
			description: clip(x.description, 800) || undefined,
		}))
		.filter((x) => x.title || x.company);

	const projects = (input.projects || [])
		.slice(0, 25)
		.map((p) => ({
			id: clip(p.id, 40) || newId(),
			name: clip(p.name, 160),
			role: clip(p.role, 80) || undefined,
			year: clip(p.year, 20) || undefined,
			url: clip(p.url, 500) || undefined,
			tech: clip(p.tech, 200) || undefined,
			description: clip(p.description, 800) || undefined,
		}))
		.filter((p) => p.name);

	return {
		about: clip(input.about, 4000) || null,
		remarks: clip(input.remarks, 2000) || null,
		qualifications: quals.length ? JSON.stringify(quals) : null,
		certifications: certs.length ? JSON.stringify(certs) : null,
		experience: experience.length ? JSON.stringify(experience) : null,
		projects: projects.length ? JSON.stringify(projects) : null,
		emergencyContactName: clip(input.emergencyContactName, 80) || null,
		emergencyContactPhone: clip(input.emergencyContactPhone, 40) || null,
		emergencyContactRelation: clip(input.emergencyContactRelation, 60) || null,
	};
}
