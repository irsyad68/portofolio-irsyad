/* MemoryBackend — HANYA untuk pengembangan (/admin?mock saat `npm run dev`).
   Meniru SupabaseBackend memakai sessionStorage, agar tampilan & alur admin bisa diuji tanpa login/database. */
import { normalize } from "../normalize";
import { DEFAULT_DATA } from "../../data/default";
import type { Backend, OrderTable, SessionAction, ActivityRow, MessageRow, AnalyticsSummary } from "./backend";
import type { PortfolioData, Profile, Project, Experience, SkillCategory, Skill, Certificate, CaseStudy, Publication } from "../types";

const KEY = "pf-admin-mock";
const wait = (ms = 120) => new Promise(r => setTimeout(r, ms));

export class MemoryBackend implements Backend {
  mode = "memory" as const;
  private d: PortfolioData;
  private email: string | null = sessionStorage.getItem(KEY + "-email");
  constructor() {
    const raw = sessionStorage.getItem(KEY);
    this.d = normalize(raw ? JSON.parse(raw) : structuredClone(DEFAULT_DATA));
    /* seperti di Supabase, setiap skill punya id */
    this.d.skills.forEach(c => c.items.forEach(i => { i.id ??= crypto.randomUUID(); }));
    this.persist();
  }
  private persist() { sessionStorage.setItem(KEY, JSON.stringify(this.d)); }
  private upsert<T extends { id: string }>(arr: T[], item: T, sort: number) {
    const i = arr.findIndex(x => x.id === item.id); const copy = structuredClone(item);
    if (i >= 0) arr.splice(i, 1);
    arr.splice(Math.min(sort, arr.length), 0, copy); this.persist();
  }
  async currentEmail() { return this.email; }
  async signIn(email: string) { await wait(); this.email = email; sessionStorage.setItem(KEY + "-email", email); }
  async signOut() { if (this.email) this.addLog("logout", "auth"); this.email = null; sessionStorage.removeItem(KEY + "-email"); }
  async isAdmin() { return true; }
  async loadAll() { await wait(); return structuredClone(this.d); }
  async saveProfile(p: Profile) { await wait(); this.d.profile = structuredClone(p); this.persist(); this.addLog("update", "profile", "Profil & kontak"); }
  async saveProject(p: Project, sort: number) { await wait(); const isNew = !this.d.projects.some(x => x.id === p.id); this.upsert(this.d.projects, p, sort); this.addLog(isNew ? "insert" : "update", "projects", p.t); }
  async deleteProject(id: string) { const t = this.d.projects.find(x => x.id === id)?.t ?? null; this.d.projects = this.d.projects.filter(x => x.id !== id); this.persist(); this.addLog("delete", "projects", t); }
  async saveExperience(x: Experience, sort: number) { await wait(); this.upsert(this.d.experience, x, sort); }
  async deleteExperience(id: string) { this.d.experience = this.d.experience.filter(x => x.id !== id); this.persist(); }
  async saveCategory(c: SkillCategory, sort: number) {
    const old = this.d.skills.find(x => x.id === c.id);
    this.upsert(this.d.skills, { ...c, items: old?.items ?? [] }, sort);
  }
  async deleteCategory(id: string) { this.d.skills = this.d.skills.filter(x => x.id !== id); this.persist(); }
  async saveSkill(categoryId: string, s: Skill, sort: number) {
    const id = s.id ?? crypto.randomUUID();
    this.d.skills.forEach(c => c.items = c.items.filter(i => i.id !== id));
    const cat = this.d.skills.find(c => c.id === categoryId)!;
    cat.items.splice(Math.min(sort, cat.items.length), 0, { ...s, id }); this.persist(); return id;
  }
  async deleteSkill(id: string) { this.d.skills.forEach(c => c.items = c.items.filter(i => i.id !== id)); this.persist(); }
  async saveCase(c: CaseStudy, sort: number) { await wait(); const isNew = !this.d.cases.some(x => x.id === c.id); this.upsert(this.d.cases, c, sort); this.addLog(isNew ? "insert" : "update", "case_studies", c.t); }
  async deleteCase(id: string) { const t = this.d.cases.find(x => x.id === id)?.t ?? null; this.d.cases = this.d.cases.filter(x => x.id !== id); this.persist(); this.addLog("delete", "case_studies", t); }
  async savePub(p: Publication, sort: number) { await wait(); const isNew = !this.d.pubs.some(x => x.id === p.id); this.upsert(this.d.pubs, p, sort); this.addLog(isNew ? "insert" : "update", "publications", p.t); }
  async deletePub(id: string) { const t = this.d.pubs.find(x => x.id === id)?.t ?? null; this.d.pubs = this.d.pubs.filter(x => x.id !== id); this.persist(); this.addLog("delete", "publications", t); }
  async saveCert(c: Certificate, sort: number) { await wait(); this.upsert(this.d.certs, c, sort); }
  async deleteCert(id: string) { this.d.certs = this.d.certs.filter(x => x.id !== id); this.persist(); }
  async reorder(table: OrderTable, ids: string[]) {
    const key = { projects: "projects", experiences: "experience", case_studies: "cases", publications: "pubs", certificates: "certs", skill_categories: "skills" }[table] as "projects";
    const arr = this.d[key] as { id: string }[];
    (this.d as any)[key] = ids.map(id => arr.find(x => x.id === id)).filter(Boolean); this.persist();
  }
  async upload(file: Blob) {
    await wait(200);
    return await new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = rej; fr.readAsDataURL(file); });
  }
  async remove() {}
  /* log aktivitas tiruan (meniru trigger database: setiap simpan/hapus juga tercatat) */
  private log: ActivityRow[] = JSON.parse(sessionStorage.getItem(KEY + "-log") || "[]");
  private addLog(action: string, entity: string, label: string | null = null) {
    this.log.unshift({ id: (this.log[0]?.id ?? 0) + 1, created_at: new Date().toISOString(), actor: this.email ?? "admin", action, entity, entity_id: null, label });
    sessionStorage.setItem(KEY + "-log", JSON.stringify(this.log.slice(0, 500)));
  }
  async logEvent(action: SessionAction, entity = "auth", label?: string) { this.addLog(action, entity, label ?? null); }
  async listActivity(limit: number, before?: number) { await wait(); return this.log.filter(r => !before || r.id < before).slice(0, limit); }
  async changePassword(current: string, next: string) {
    await wait(300);
    if (current !== "uji-lokal") throw new Error("Password lama salah.");
    if (next === current) throw new Error("Password baru harus berbeda dari password lama.");
    this.addLog("password", "auth");
  }
  async signOutAll() { this.addLog("logout_all", "auth"); await this.signOut(); }
  async storageUsage() { return (sessionStorage.getItem(KEY) || "").length; }
  /* pesan contoh agar tampilan kotak masuk bisa diuji */
  private msgs: MessageRow[] = JSON.parse(sessionStorage.getItem(KEY + "-msg") || "null") ?? [
    { id: 3, created_at: new Date(Date.now() - 36e5).toISOString(), name: "Rina Wijaya", email: "rina@contoh.id", message: "Halo Irsyad, kami dari tim HR PT Contoh Mineral tertarik dengan pengalaman Anda di bidang extractive metallurgy. Apakah Anda terbuka untuk interview minggu depan?", read: false },
    { id: 2, created_at: new Date(Date.now() - 864e5).toISOString(), name: "Budi Santoso", email: "budi@contoh.id", message: "Studi kasus leaching-nya menarik. Boleh minta info lebih lanjut soal metode analisisnya?", read: false },
    { id: 1, created_at: new Date(Date.now() - 5 * 864e5).toISOString(), name: "Recruiter", email: "hr@contoh.id", message: "Thanks for applying — we'll be in touch.", read: true },
  ];
  private saveMsgs() { sessionStorage.setItem(KEY + "-msg", JSON.stringify(this.msgs)); }
  async listMessages() { await wait(); return structuredClone(this.msgs); }
  async unreadMessages() { return this.msgs.filter(m => !m.read).length; }
  async setMessageRead(ids: number[], read: boolean) { this.msgs.forEach(m => { if (ids.includes(m.id)) m.read = read; }); this.saveMsgs(); }
  /* statistik tiruan (acak tapi stabil per jumlah hari) agar grafik & daftar bisa diuji */
  async analytics(days: number): Promise<AnalyticsSummary> {
    await wait(250);
    let seed = days; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const daily = Array.from({ length: days }, (_, i) => {
      const d = new Date(Date.now() - (days - 1 - i) * 864e5), visitors = Math.round(3 + rnd() * 14 + (d.getDay() % 6 ? 4 : 0));
      return { d: d.toISOString().slice(0, 10), visitors, views: visitors + Math.round(rnd() * visitors * .6) };
    });
    const visitors = daily.reduce((n, x) => n + x.visitors, 0), views = daily.reduce((n, x) => n + x.views, 0);
    const pct = (f: number) => Math.round(visitors * f);
    return {
      since: daily[0].d, daily,
      totals: { views, visitors, cv: pct(.12), pdf: pct(.07), contact: pct(.02), project: pct(.4) },
      prev: { views: Math.round(views * .8), visitors: Math.round(visitors * .85) },
      sources: [["Langsung", .38], ["LinkedIn", .27], ["Google", .16], ["WhatsApp", .1], ["Email", .06], ["instagram.com", .03]].map(([k, f]) => ({ k: k as string, n: pct(f as number) })),
      devices: [{ k: "mobile", n: pct(.62) }, { k: "desktop", n: pct(.35) }, { k: "tablet", n: pct(.03) }],
      countries: [{ k: "ID", n: pct(.86) }, { k: "SG", n: pct(.06) }, { k: "MY", n: pct(.04) }, { k: "US", n: pct(.04) }],
      sections: [["hero", 1], ["about", .82], ["skills", .7], ["experience", .61], ["projects", .55], ["certificates", .38], ["contact", .31]].map(([k, f]) => ({ k: k as string, n: pct(f as number) })),
      projects: this.d.projects.slice(0, 5).map((p, i) => ({ k: p.t, n: Math.max(1, pct(.12 / (i + 1))) })),
      actions: [{ k: "cv", n: pct(.12) }, { k: "linkedin", n: pct(.09) }, { k: "pdf", n: pct(.07) }, { k: "github", n: pct(.05) }, { k: "email", n: pct(.03) }, { k: "contact", n: pct(.02) }],
    };
  }
  async deleteMessage(id: number) {
    const m = this.msgs.find(x => x.id === id); this.msgs = this.msgs.filter(x => x.id !== id); this.saveMsgs();
    if (m) this.addLog("delete", "messages", m.name);
  }
}
