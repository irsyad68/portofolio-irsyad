/* Lengkapi data (dari Supabase, backup JSON, atau versi lama) tanpa menimpa isian.
   File terpisah agar bisa dipakai di browser (admin) tanpa ikut membuat klien Supabase server. */
import { DEFAULT_DATA, ITEM_DEFAULTS, DATA_VERSION } from "../data/default";
import type { PortfolioData } from "./types";

export const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o));
const isObj = (o: unknown): o is Record<string, any> => !!o && typeof o === "object" && !Array.isArray(o);

function fill<T extends Record<string, any>>(target: T, defaults: Record<string, any>): T {
  for (const k in defaults) {
    if (target[k] === undefined || target[k] === null) (target as any)[k] = clone(defaults[k]);
    else if (isObj(defaults[k]) && isObj(target[k])) fill(target[k], defaults[k]);
  }
  return target;
}

/** lengkapi data (dari Supabase, backup JSON, atau versi lama) tanpa menimpa isian */
export function normalize(d: any): PortfolioData {
  if (!isObj(d)) return clone(DEFAULT_DATA);
  /* terjemahan yang belum ada = kosong (jangan disalin dari data contoh) */
  if (isObj(d.profile) && !isObj(d.profile.tr)) d.profile.tr = {};
  fill(d, { profile: DEFAULT_DATA.profile, skills: [], experience: [], projects: [], cases: [], pubs: [], certs: [] });
  if (!Array.isArray(d.profile.roles) || !d.profile.roles.length) d.profile.roles = clone(DEFAULT_DATA.profile.roles);
  d.projects.forEach((p: any) => fill(p, ITEM_DEFAULTS.project));
  d.experience.forEach((x: any) => fill(x, ITEM_DEFAULTS.experience));
  d.cases.forEach((c: any) => fill(c, ITEM_DEFAULTS.caseStudy));
  d.pubs.forEach((p: any) => fill(p, ITEM_DEFAULTS.pub));
  d.certs.forEach((c: any) => fill(c, ITEM_DEFAULTS.cert));
  d.skills.forEach((s: any) => fill(s, ITEM_DEFAULTS.skillCat));
  d.version = DATA_VERSION;
  return d as PortfolioData;
}
