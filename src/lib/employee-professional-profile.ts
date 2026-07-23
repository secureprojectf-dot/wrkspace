/** Shared shapes for employee professional profile (company-facing, resume-style). */

export const EMPLOYMENT_TYPES = [
	'Full Time',
	'Internship',
	'Part Time',
	'Contract',
	'Freelance',
	'Apprenticeship',
] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export type ProfileExperience = {
	id: string;
	title: string;
	employmentType?: EmploymentType | '';
	company: string;
	location?: string;
	from?: string;
	to?: string;
	current?: boolean;
	description?: string;
	technologiesUsed?: string;
};

export type ProfileInternship = {
	id: string;
	title: string;
	company: string;
	location?: string;
	from?: string;
	to?: string;
	current?: boolean;
	description?: string;
	technologiesUsed?: string;
};

export type ProfileEducation = {
	id: string;
	institution: string;
	degree: string;
	specialization?: string;
	cgpa?: string;
	from?: string;
	to?: string;
};

export type SkillCategoryKey =
	| 'programmingLanguages'
	| 'frontend'
	| 'backend'
	| 'database'
	| 'cloud'
	| 'devops'
	| 'tools'
	| 'softSkills';

export const SKILL_CATEGORIES: { key: SkillCategoryKey; label: string }[] = [
	{ key: 'programmingLanguages', label: 'Programming Languages' },
	{ key: 'frontend', label: 'Frontend' },
	{ key: 'backend', label: 'Backend' },
	{ key: 'database', label: 'Database' },
	{ key: 'cloud', label: 'Cloud' },
	{ key: 'devops', label: 'DevOps' },
	{ key: 'tools', label: 'Tools' },
	{ key: 'softSkills', label: 'Soft Skills' },
];

export type ProfileSkills = Record<SkillCategoryKey, string[]>;

export type ProfileProject = {
	id: string;
	name: string;
	role?: string;
	githubUrl?: string;
	liveUrl?: string;
	tech?: string;
	description?: string;
};

export type ProfileCertification = {
	id: string;
	name: string;
	issuer?: string;
	credentialId?: string;
	credentialUrl?: string;
	issueDate?: string;
	/** Optional certificate image / PDF as data URL or https */
	fileUrl?: string;
};

export type ProfileAchievement = {
	id: string;
	title: string;
	organization?: string;
	date?: string;
	description?: string;
	/** Optional proof image / PDF as data URL or https */
	fileUrl?: string;
};

export type ProfilePublication = {
	id: string;
	title: string;
	authors?: string;
	journal?: string;
	conference?: string;
	year?: string;
	url?: string;
	abstract?: string;
};

export type ProfileCustomSection = {
	id: string;
	title: string;
	content: string;
};

export type ProfessionalProfile = {
	// Personal information
	professionalTitle: string;
	city: string;
	state: string;
	country: string;
	linkedinUrl: string;
	githubUrl: string;
	portfolioUrl: string;
	leetcodeUrl: string;
	codeforcesUrl: string;
	codechefUrl: string;
	hackerrankUrl: string;

	// Professional summary
	about: string; // Resume summary
	careerObjective: string;
	yearsOfExperience: string;
	industry: string;
	remarks: string;

	// Emergency contact
	emergencyContactName: string;
	emergencyContactPhone: string;
	emergencyContactRelation: string;

	// Repeatable / structured sections
	experience: ProfileExperience[];
	education: ProfileEducation[];
	skills: ProfileSkills;
	projects: ProfileProject[];
	certifications: ProfileCertification[];
	achievements: ProfileAchievement[];
	internships: ProfileInternship[];
	publications: ProfilePublication[];
	customSections: ProfileCustomSection[];
};

export function newId() {
	return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function emptySkills(): ProfileSkills {
	return {
		programmingLanguages: [],
		frontend: [],
		backend: [],
		database: [],
		cloud: [],
		devops: [],
		tools: [],
		softSkills: [],
	};
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

export function parseJsonObject<T extends Record<string, unknown>>(raw: unknown, fallback: T): T {
	if (raw && typeof raw === 'object' && !Array.isArray(raw)) return { ...fallback, ...(raw as T) };
	if (typeof raw !== 'string' || !raw.trim()) return fallback;
	try {
		const parsed = JSON.parse(raw);
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return { ...fallback, ...parsed };
		return fallback;
	} catch {
		return fallback;
	}
}

/** Legacy qualification shape (pre-Education tab). */
type LegacyQualification = { id?: string; degree?: string; institution?: string; year?: string; details?: string };

function migrateLegacyEducation(emp: Record<string, unknown>): ProfileEducation[] {
	const legacy = parseJsonArray<LegacyQualification>(emp.qualifications);
	return legacy
		.map((q) => ({
			id: q.id || newId(),
			institution: q.institution || '',
			degree: q.degree || '',
			specialization: q.details || '',
			cgpa: '',
			from: '',
			to: q.year || '',
		}))
		.filter((q) => q.institution || q.degree);
}

export function profileFromEmployee(emp: Record<string, unknown> | null | undefined): ProfessionalProfile {
	const e = emp || {};

	const educationRaw = parseJsonArray<ProfileEducation>(e.education);
	const education = educationRaw.length > 0 ? educationRaw : migrateLegacyEducation(e);

	const projects = parseJsonArray<ProfileProject & { url?: string; year?: string }>(e.projects).map((p) => ({
		id: p.id || newId(),
		name: p.name || '',
		role: p.role || '',
		githubUrl: p.githubUrl || (p.url && /github\.com/i.test(p.url) ? p.url : '') || '',
		liveUrl: p.liveUrl || (p.url && !/github\.com/i.test(p.url) ? p.url : '') || '',
		tech: p.tech || '',
		description: p.description || '',
	}));

	const certifications = parseJsonArray<ProfileCertification & { year?: string }>(e.certifications).map((c) => ({
		id: c.id || newId(),
		name: c.name || '',
		issuer: c.issuer || '',
		credentialId: c.credentialId || '',
		credentialUrl: c.credentialUrl || '',
		issueDate: c.issueDate || c.year || '',
		fileUrl: c.fileUrl || '',
	}));

	const experience = parseJsonArray<ProfileExperience>(e.experience).map((x) => ({
		id: x.id || newId(),
		title: x.title || '',
		employmentType: (x.employmentType || '') as ProfileExperience['employmentType'],
		company: x.company || '',
		location: x.location || '',
		from: x.from || '',
		to: x.to || '',
		current: Boolean(x.current),
		description: x.description || '',
		technologiesUsed: x.technologiesUsed || '',
	}));

	const internships = parseJsonArray<ProfileInternship>(e.internships).map((x) => ({
		id: x.id || newId(),
		title: x.title || '',
		company: x.company || '',
		location: x.location || '',
		from: x.from || '',
		to: x.to || '',
		current: Boolean(x.current),
		description: x.description || '',
		technologiesUsed: x.technologiesUsed || '',
	}));

	return {
		professionalTitle: String(e.professionalTitle || ''),
		city: String(e.city || ''),
		state: String(e.state || ''),
		country: String(e.country || ''),
		linkedinUrl: String(e.linkedinUrl || ''),
		githubUrl: String(e.githubUrl || ''),
		portfolioUrl: String(e.portfolioUrl || ''),
		leetcodeUrl: String(e.leetcodeUrl || ''),
		codeforcesUrl: String(e.codeforcesUrl || ''),
		codechefUrl: String(e.codechefUrl || ''),
		hackerrankUrl: String(e.hackerrankUrl || ''),

		about: String(e.about || ''),
		careerObjective: String(e.careerObjective || ''),
		yearsOfExperience: String(e.yearsOfExperience || ''),
		industry: String(e.industry || ''),
		remarks: String(e.remarks || ''),

		emergencyContactName: String(e.emergencyContactName || ''),
		emergencyContactPhone: String(e.emergencyContactPhone || ''),
		emergencyContactRelation: String(e.emergencyContactRelation || ''),

		experience,
		education,
		skills: parseJsonObject<ProfileSkills>(e.skills, emptySkills()),
		projects,
		certifications,
		achievements: parseJsonArray<ProfileAchievement>(e.achievements).map((a) => ({
			id: a.id || newId(),
			title: a.title || '',
			organization: a.organization || '',
			date: a.date || '',
			description: a.description || '',
			fileUrl: a.fileUrl || '',
		})),
		internships,
		publications: parseJsonArray<ProfilePublication>(e.publications).map((p) => ({
			id: p.id || newId(),
			title: p.title || '',
			authors: p.authors || '',
			journal: p.journal || '',
			conference: p.conference || '',
			year: p.year || '',
			url: p.url || '',
			abstract: p.abstract || '',
		})),
		customSections: parseJsonArray<ProfileCustomSection>(e.customSections).map((c) => ({
			id: c.id || newId(),
			title: c.title || '',
			content: c.content || '',
		})),
	};
}

function clip(s: unknown, max: number) {
	return String(s ?? '').trim().slice(0, max);
}

function clipTags(list: unknown, maxTags: number, maxLen: number): string[] {
	if (!Array.isArray(list)) return [];
	const out: string[] = [];
	for (const t of list) {
		const v = clip(t, maxLen);
		if (v && !out.includes(v)) out.push(v);
		if (out.length >= maxTags) break;
	}
	return out;
}

/** Sanitize payload before DB write (JSON columns stay compact strings, empties become null). */
export function sanitizeProfessionalProfile(input: Partial<ProfessionalProfile>) {
	const experience = (input.experience || [])
		.slice(0, 30)
		.map((x) => ({
			id: clip(x.id, 40) || newId(),
			title: clip(x.title, 120),
			employmentType: (clip(x.employmentType, 40) || undefined) as EmploymentType | undefined,
			company: clip(x.company, 120),
			location: clip(x.location, 120) || undefined,
			from: clip(x.from, 40) || undefined,
			to: clip(x.to, 40) || undefined,
			current: Boolean(x.current),
			description: clip(x.description, 1000) || undefined,
			technologiesUsed: clip(x.technologiesUsed, 300) || undefined,
		}))
		.filter((x) => x.title || x.company);

	const internships = (input.internships || [])
		.slice(0, 20)
		.map((x) => ({
			id: clip(x.id, 40) || newId(),
			title: clip(x.title, 120),
			company: clip(x.company, 120),
			location: clip(x.location, 120) || undefined,
			from: clip(x.from, 40) || undefined,
			to: clip(x.to, 40) || undefined,
			current: Boolean(x.current),
			description: clip(x.description, 1000) || undefined,
			technologiesUsed: clip(x.technologiesUsed, 300) || undefined,
		}))
		.filter((x) => x.title || x.company);

	const education = (input.education || [])
		.slice(0, 20)
		.map((q) => ({
			id: clip(q.id, 40) || newId(),
			institution: clip(q.institution, 160),
			degree: clip(q.degree, 120),
			specialization: clip(q.specialization, 160) || undefined,
			cgpa: clip(q.cgpa, 20) || undefined,
			from: clip(q.from, 20) || undefined,
			to: clip(q.to, 20) || undefined,
		}))
		.filter((q) => q.institution || q.degree);

	const skillsInput = input.skills || emptySkills();
	const skills: ProfileSkills = {
		programmingLanguages: clipTags(skillsInput.programmingLanguages, 40, 40),
		frontend: clipTags(skillsInput.frontend, 40, 40),
		backend: clipTags(skillsInput.backend, 40, 40),
		database: clipTags(skillsInput.database, 40, 40),
		cloud: clipTags(skillsInput.cloud, 40, 40),
		devops: clipTags(skillsInput.devops, 40, 40),
		tools: clipTags(skillsInput.tools, 40, 40),
		softSkills: clipTags(skillsInput.softSkills, 40, 40),
	};
	const hasAnySkill = Object.values(skills).some((arr) => arr.length > 0);

	const projects = (input.projects || [])
		.slice(0, 30)
		.map((p) => ({
			id: clip(p.id, 40) || newId(),
			name: clip(p.name, 160),
			role: clip(p.role, 80) || undefined,
			githubUrl: clip(p.githubUrl, 500) || undefined,
			liveUrl: clip(p.liveUrl, 500) || undefined,
			tech: clip(p.tech, 300) || undefined,
			description: clip(p.description, 1000) || undefined,
		}))
		.filter((p) => p.name);

	const certifications = (input.certifications || [])
		.slice(0, 30)
		.map((c) => ({
			id: clip(c.id, 40) || newId(),
			name: clip(c.name, 160),
			issuer: clip(c.issuer, 160) || undefined,
			credentialId: clip(c.credentialId, 120) || undefined,
			credentialUrl: clip(c.credentialUrl, 500) || undefined,
			issueDate: clip(c.issueDate, 20) || undefined,
			fileUrl: clip(c.fileUrl, 900_000) || undefined,
		}))
		.filter((c) => c.name);

	const achievements = (input.achievements || [])
		.slice(0, 30)
		.map((a) => ({
			id: clip(a.id, 40) || newId(),
			title: clip(a.title, 160),
			organization: clip(a.organization, 160) || undefined,
			date: clip(a.date, 40) || undefined,
			description: clip(a.description, 800) || undefined,
			fileUrl: clip(a.fileUrl, 900_000) || undefined,
		}))
		.filter((a) => a.title);

	const publications = (input.publications || [])
		.slice(0, 30)
		.map((p) => ({
			id: clip(p.id, 40) || newId(),
			title: clip(p.title, 200),
			authors: clip(p.authors, 300) || undefined,
			journal: clip(p.journal, 200) || undefined,
			conference: clip(p.conference, 200) || undefined,
			year: clip(p.year, 20) || undefined,
			url: clip(p.url, 500) || undefined,
			abstract: clip(p.abstract, 1200) || undefined,
		}))
		.filter((p) => p.title);

	const customSections = (input.customSections || [])
		.slice(0, 15)
		.map((c) => ({
			id: clip(c.id, 40) || newId(),
			title: clip(c.title, 160),
			content: clip(c.content, 3000),
		}))
		.filter((c) => c.title || c.content);

	return {
		professionalTitle: clip(input.professionalTitle, 160) || null,
		city: clip(input.city, 100) || null,
		state: clip(input.state, 100) || null,
		country: clip(input.country, 100) || null,
		linkedinUrl: clip(input.linkedinUrl, 500) || null,
		githubUrl: clip(input.githubUrl, 500) || null,
		portfolioUrl: clip(input.portfolioUrl, 500) || null,
		leetcodeUrl: clip(input.leetcodeUrl, 500) || null,
		codeforcesUrl: clip(input.codeforcesUrl, 500) || null,
		codechefUrl: clip(input.codechefUrl, 500) || null,
		hackerrankUrl: clip(input.hackerrankUrl, 500) || null,

		about: clip(input.about, 4000) || null,
		careerObjective: clip(input.careerObjective, 2000) || null,
		yearsOfExperience: clip(input.yearsOfExperience, 20) || null,
		industry: clip(input.industry, 100) || null,
		remarks: clip(input.remarks, 2000) || null,

		emergencyContactName: clip(input.emergencyContactName, 80) || null,
		emergencyContactPhone: clip(input.emergencyContactPhone, 40) || null,
		emergencyContactRelation: clip(input.emergencyContactRelation, 60) || null,

		experience: experience.length ? JSON.stringify(experience) : null,
		education: education.length ? JSON.stringify(education) : null,
		skills: hasAnySkill ? JSON.stringify(skills) : null,
		projects: projects.length ? JSON.stringify(projects) : null,
		certifications: certifications.length ? JSON.stringify(certifications) : null,
		achievements: achievements.length ? JSON.stringify(achievements) : null,
		internships: internships.length ? JSON.stringify(internships) : null,
		publications: publications.length ? JSON.stringify(publications) : null,
		customSections: customSections.length ? JSON.stringify(customSections) : null,
		// qualifications column intentionally left untouched (legacy fallback only, no longer written)
	};
}
