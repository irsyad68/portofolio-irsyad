/* Konversi baris tabel Supabase ⇄ format data website (lihat supabase/schema.sql) */
import type { CaseStudy, Certificate, Experience, PortfolioData, Profile, Project, Publication, SkillCategory } from "./types";

export interface Rows {
  profile: { data: Profile } | null;
  cats: any[]; skills: any[]; exp: any[]; proj: any[]; certs: any[];
  /* opsional: snapshot lama belum punya tabel ini */
  cases?: any[]; pubs?: any[];
}

export function rowsToData(r: Rows): Omit<PortfolioData, "version" | "profile"> & { profile: Profile | null } {
  return {
    profile: r.profile?.data ?? null,
    skills: r.cats.map(c => ({
      id: c.id, cat: c.cat, ic: c.ic, wide: c.wide,
      items: r.skills.filter(s => s.category_id === c.id).map(s => ({ id: s.id, name: s.name, logo: s.logo ?? "" })),
    })),
    experience: r.exp.map(x => ({ id: x.id, type: x.type, role: x.role, org: x.org, date: x.period, desc: x.description, photos: x.photos ?? [], tr: x.tr ?? {} })),
    projects: r.proj.map(p => ({
      id: p.id, t: p.title, s: p.subtitle, c: p.category, y: p.year ?? "", ic: p.icon, pub: p.published,
      tags: p.tags ?? [], d: p.description, demo: p.demo_url, repo: p.repo_url, photos: p.photos ?? [], tr: p.tr ?? {},
    })),
    cases: (r.cases ?? []).map(c => ({
      id: c.id, t: c.title, ctx: c.context, y: c.year ?? "", ic: c.icon, tags: c.tags ?? [],
      problem: c.problem, approach: c.approach, result: c.result, photos: c.photos ?? [], tr: c.tr ?? {},
    })),
    pubs: (r.pubs ?? []).map(p => ({ id: p.id, t: p.title, authors: p.authors, venue: p.venue, y: p.year, kind: p.kind, link: p.link, abs: p.abstract })),
    certs: r.certs.map(c => ({ id: c.id, t: c.title, o: c.issuer, y: c.year, img: c.image_url, link: c.link })),
  };
}

export const projectRow = (p: Project, sort: number) => ({
  id: p.id, title: p.t, subtitle: p.s, category: p.c, year: Number(p.y) || null, icon: p.ic, published: p.pub !== false,
  tags: p.tags, description: p.d, demo_url: p.demo, repo_url: p.repo, photos: p.photos, tr: p.tr ?? {}, sort,
});
export const experienceRow = (x: Experience, sort: number) => ({
  id: x.id, type: x.type, role: x.role, org: x.org, period: x.date, description: x.desc, photos: x.photos, tr: x.tr ?? {}, sort,
});
export const caseRow = (c: CaseStudy, sort: number) => ({
  id: c.id, title: c.t, context: c.ctx, year: Number(c.y) || null, icon: c.ic, tags: c.tags,
  problem: c.problem, approach: c.approach, result: c.result, photos: c.photos, tr: c.tr ?? {}, sort,
});
export const pubRow = (p: Publication, sort: number) => ({
  id: p.id, title: p.t, authors: p.authors, venue: p.venue, year: p.y, kind: p.kind, link: p.link, abstract: p.abs, sort,
});
export const certRow = (c: Certificate, sort: number) => ({
  id: c.id, title: c.t, issuer: c.o, year: c.y, image_url: c.img, link: c.link, sort,
});
export const categoryRow = (c: SkillCategory, sort: number) => ({ id: c.id, cat: c.cat, ic: c.ic, wide: c.wide, sort });
