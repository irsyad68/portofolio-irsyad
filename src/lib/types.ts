/* Tipe data portofolio — sama dengan struktur di mockup/js/data.js dan tabel Supabase */

export interface Photo { src: string; caption?: string }

export interface Education {
  school: string; faculty: string; degree: string; years: string; gpa: string;
  focus: string; courses: string; thesis: string;
  logo: string;                  // URL logo universitas (kosong = ikon toga)
}

/** terjemahan Bahasa Indonesia (opsional) — kosong = teks bahasa Inggris dipakai di kedua mode bahasa */
export type Tr<K extends string> = Partial<Record<K, string>>;

export interface Profile {
  name: string; first: string; last: string;
  title: string;                 // "Metallurgical Engineer" focused on …
  roles: string[];               // role bergilir di hero
  headline: string;              // sampul PDF
  openToWork: boolean; status: string; location: string;
  highlight: string;             // label kecil di foto hero
  photo: string;                 // URL foto profil
  logo: string;                  // URL logo/ikon website (favicon & navbar); kosong = inisial
  email: string; linkedin: string; github: string;
  cv: { src: string; name: string };
  lead: string; about: string;
  education: Education;
  tr: Tr<"title" | "status" | "lead" | "about" | "focus" | "courses" | "thesis">;
}

/** logo: "si:<slug>" (Simple Icons) | "ic:<nama ikon>" | URL gambar */
export interface Skill { id?: string; name: string; logo: string }
export interface SkillCategory { id: string; cat: string; ic: string; wide: boolean; items: Skill[] }

export interface Experience {
  id: string; type: "Work" | "Organization"; role: string; org: string; date: string; desc: string; photos: Photo[];
  tr: Tr<"role" | "desc">;
}

export interface Project {
  id: string; t: string; s: string; c: string; y: number | string; ic: string; pub: boolean;
  tags: string[]; d: string; demo: string; repo: string; photos: Photo[];
  tr: Tr<"s" | "d">;
}

/** studi kasus: satu masalah teknis dari awal sampai hasil */
export interface CaseStudy {
  id: string; t: string; ctx: string; y: number | string; ic: string; tags: string[];
  problem: string; approach: string; result: string; photos: Photo[];
  tr: Tr<"t" | "ctx" | "problem" | "approach" | "result">;
}

/** publikasi: jurnal, prosiding, artikel, atau tulisan */
export interface Publication { id: string; t: string; authors: string; venue: string; y: string; kind: string; link: string; abs: string }

export interface Certificate { id: string; t: string; o: string; y: string; img: string; link: string }

export interface PortfolioData {
  version: number;
  profile: Profile;
  skills: SkillCategory[];
  experience: Experience[];
  projects: Project[];
  cases: CaseStudy[];
  pubs: Publication[];
  certs: Certificate[];
}
