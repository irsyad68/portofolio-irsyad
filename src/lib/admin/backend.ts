/* =====================================================================
   Backend panel admin.
   - SupabaseBackend : produksi — login Supabase Auth, tulis ke tabel (dilindungi RLS), upload ke Storage.
   - MemoryBackend   : HANYA saat pengembangan (npm run dev + /admin?mock) untuk menguji tampilan
                       tanpa menyentuh database. Tidak ikut ter-build ke produksi.
   ===================================================================== */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalize } from "../normalize";
import { rowsToData, projectRow, experienceRow, certRow, categoryRow, caseRow, pubRow } from "../mappers";
import { DEFAULT_DATA } from "../../data/default";
import type { CaseStudy, Certificate, Experience, PortfolioData, Profile, Project, Publication, Skill, SkillCategory } from "../types";

export type OrderTable = "projects" | "experiences" | "case_studies" | "publications" | "certificates" | "skill_categories";
export type SessionAction = "login" | "logout" | "logout_all" | "password" | "reorder";
export interface Stat { k: string; n: number }
export interface AnalyticsSummary {
  since: string;
  totals: { views: number; visitors: number; cv: number; pdf: number; contact: number; project: number };
  prev: { views: number; visitors: number };
  daily: { d: string; views: number; visitors: number }[];
  sources: Stat[]; devices: Stat[]; countries: Stat[]; sections: Stat[]; projects: Stat[]; actions: Stat[];
}
export interface MessageRow { id: number; created_at: string; name: string; email: string; message: string; read: boolean }
export interface ActivityRow { id: number; created_at: string; actor: string; action: string; entity: string; entity_id: string | null; label: string | null }

export interface Backend {
  mode: "supabase" | "memory";
  currentEmail(): Promise<string | null>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  isAdmin(): Promise<boolean>;
  loadAll(): Promise<PortfolioData>;
  saveProfile(p: Profile): Promise<void>;
  saveProject(p: Project, sort: number): Promise<void>;
  deleteProject(id: string): Promise<void>;
  saveExperience(x: Experience, sort: number): Promise<void>;
  deleteExperience(id: string): Promise<void>;
  saveCategory(c: SkillCategory, sort: number): Promise<void>;
  deleteCategory(id: string): Promise<void>;
  /** simpan skill; mengembalikan id */
  saveSkill(categoryId: string, s: Skill, sort: number): Promise<string>;
  deleteSkill(id: string): Promise<void>;
  saveCase(c: CaseStudy, sort: number): Promise<void>;
  deleteCase(id: string): Promise<void>;
  savePub(p: Publication, sort: number): Promise<void>;
  deletePub(id: string): Promise<void>;
  saveCert(c: Certificate, sort: number): Promise<void>;
  deleteCert(id: string): Promise<void>;
  reorder(table: OrderTable, ids: string[]): Promise<void>;
  /** upload file → URL publik */
  upload(file: Blob, folder: string, ext: string, downloadName?: string): Promise<string>;
  /** hapus file milik bucket ini (URL lain diabaikan) */
  remove(urls: string[]): Promise<void>;
  storageUsage(): Promise<number>;
  /** catat event sesi/akun (perubahan konten dicatat otomatis oleh trigger database) */
  logEvent(action: SessionAction, entity?: string, label?: string): Promise<void>;
  /** log aktivitas terbaru; `before` = id terakhir untuk halaman berikutnya */
  listActivity(limit: number, before?: number): Promise<ActivityRow[]>;
  /** verifikasi password lama, lalu ganti */
  changePassword(current: string, next: string): Promise<void>;
  /** keluar dari semua perangkat (mencabut semua sesi) */
  signOutAll(): Promise<void>;
  /** pesan dari formulir kontak, terbaru dulu */
  listMessages(): Promise<MessageRow[]>;
  unreadMessages(): Promise<number>;
  setMessageRead(ids: number[], read: boolean): Promise<void>;
  deleteMessage(id: number): Promise<void>;
  /** ringkasan statistik pengunjung `days` hari terakhir (dihitung di database) */
  analytics(days: number): Promise<AnalyticsSummary>;
}

const BUCKET = "portfolio";
const fail = (e: { message: string } | null) => { if (e) throw new Error(e.message); };

export class SupabaseBackend implements Backend {
  mode = "supabase" as const;
  sb: SupabaseClient;
  constructor(url: string, key: string) {
    this.sb = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "pf-admin-auth" } });
  }
  async currentEmail() { const { data } = await this.sb.auth.getSession(); return data.session?.user.email ?? null; }
  async signIn(email: string, password: string) {
    const { error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(/invalid login/i.test(error.message) ? "Email atau password salah." : /rate limit|too many/i.test(error.message) ? "Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi." : error.message);
  }
  async signOut() { await this.logEvent("logout").catch(() => {}); await this.sb.auth.signOut(); }
  async signOutAll() { await this.logEvent("logout_all").catch(() => {}); await this.sb.auth.signOut({ scope: "global" }); }
  async logEvent(action: SessionAction, entity = "auth", label?: string) {
    const { data } = await this.sb.auth.getUser(); const u = data.user; if (!u) return;
    fail((await this.sb.from("activity_log").insert({ user_id: u.id, actor: u.email ?? "admin", action, entity, label: label ?? null })).error);
  }
  async listActivity(limit: number, before?: number) {
    let q = this.sb.from("activity_log").select("id,created_at,actor,action,entity,entity_id,label").order("id", { ascending: false }).limit(limit);
    if (before) q = q.lt("id", before);
    const { data, error } = await q; fail(error); return (data ?? []) as ActivityRow[];
  }
  async changePassword(current: string, next: string) {
    const { data } = await this.sb.auth.getUser(); const email = data.user?.email;
    if (!email) throw new Error("Sesi login habis, silakan masuk lagi.");
    /* pastikan yang mengganti benar-benar pemilik akun */
    const check = await this.sb.auth.signInWithPassword({ email, password: current });
    if (check.error) throw new Error("Password lama salah.");
    const { error } = await this.sb.auth.updateUser({ password: next });
    if (error) {
      const m = error.message;
      throw new Error(/different from the old/i.test(m) ? "Password baru harus berbeda dari password lama."
        : /weak|at least|characters/i.test(m) ? "Password baru terlalu lemah — gunakan minimal 8 karakter campuran huruf, angka & simbol."
        : /reauthenticat/i.test(m) ? "Supabase meminta verifikasi ulang. Keluar lalu masuk lagi, kemudian coba kembali." : m);
    }
    await this.logEvent("password").catch(() => {});
  }
  async listMessages() {
    const { data, error } = await this.sb.from("messages").select("id,created_at,name,email,message,read").order("id", { ascending: false }).limit(500);
    fail(error); return (data ?? []) as MessageRow[];
  }
  async unreadMessages() {
    const { count, error } = await this.sb.from("messages").select("id", { count: "exact", head: true }).eq("read", false);
    fail(error); return count ?? 0;
  }
  async setMessageRead(ids: number[], read: boolean) { if (ids.length) fail((await this.sb.from("messages").update({ read }).in("id", ids)).error); }
  async deleteMessage(id: number) { fail((await this.sb.from("messages").delete().eq("id", id)).error); }
  async analytics(days: number) {
    const { data, error } = await this.sb.rpc("analytics_summary", { p_days: days, p_tz: "Asia/Jakarta" });
    fail(error); return data as AnalyticsSummary;
  }
  async isAdmin() {
    const { data: u } = await this.sb.auth.getUser(); if (!u.user) return false;
    const { data, error } = await this.sb.from("admins").select("user_id").eq("user_id", u.user.id).maybeSingle();
    if (error) throw new Error(error.message);
    return !!data;
  }
  async loadAll() {
    const t = (n: string) => this.sb.from(n).select("*").order("sort");
    const [profile, cats, skills, exp, proj, cases, pubs, certs] = await Promise.all([
      this.sb.from("profile").select("data").eq("id", 1).maybeSingle(), t("skill_categories"), t("skills"), t("experiences"), t("projects"),
      t("case_studies"), t("publications"), t("certificates"),
    ]);
    for (const r of [profile, cats, skills, exp, proj, cases, pubs, certs]) fail(r.error);
    const m = rowsToData({ profile: profile.data as any, cats: cats.data!, skills: skills.data!, exp: exp.data!, proj: proj.data!, cases: cases.data!, pubs: pubs.data!, certs: certs.data! });
    return normalize({ ...m, profile: m.profile ?? structuredClone(DEFAULT_DATA.profile) });
  }
  async saveProfile(p: Profile) { fail((await this.sb.from("profile").upsert({ id: 1, data: p, updated_at: new Date().toISOString() })).error); }
  async saveProject(p: Project, sort: number) { fail((await this.sb.from("projects").upsert(projectRow(p, sort))).error); }
  async deleteProject(id: string) { fail((await this.sb.from("projects").delete().eq("id", id)).error); }
  async saveExperience(x: Experience, sort: number) { fail((await this.sb.from("experiences").upsert(experienceRow(x, sort))).error); }
  async deleteExperience(id: string) { fail((await this.sb.from("experiences").delete().eq("id", id)).error); }
  async saveCategory(c: SkillCategory, sort: number) { fail((await this.sb.from("skill_categories").upsert(categoryRow(c, sort))).error); }
  async deleteCategory(id: string) { fail((await this.sb.from("skill_categories").delete().eq("id", id)).error); }
  async saveSkill(categoryId: string, s: Skill, sort: number) {
    const row: Record<string, unknown> = { category_id: categoryId, name: s.name, logo: s.logo, sort };
    if (s.id) row.id = s.id;
    const { data, error } = await this.sb.from("skills").upsert(row).select("id").single();
    fail(error); return data!.id as string;
  }
  async deleteSkill(id: string) { fail((await this.sb.from("skills").delete().eq("id", id)).error); }
  async saveCase(c: CaseStudy, sort: number) { fail((await this.sb.from("case_studies").upsert(caseRow(c, sort))).error); }
  async deleteCase(id: string) { fail((await this.sb.from("case_studies").delete().eq("id", id)).error); }
  async savePub(p: Publication, sort: number) { fail((await this.sb.from("publications").upsert(pubRow(p, sort))).error); }
  async deletePub(id: string) { fail((await this.sb.from("publications").delete().eq("id", id)).error); }
  async saveCert(c: Certificate, sort: number) { fail((await this.sb.from("certificates").upsert(certRow(c, sort))).error); }
  async deleteCert(id: string) { fail((await this.sb.from("certificates").delete().eq("id", id)).error); }
  async reorder(table: OrderTable, ids: string[]) {
    const res = await Promise.all(ids.map((id, i) => this.sb.from(table).update({ sort: i }).eq("id", id)));
    res.forEach(r => fail(r.error));
  }
  async upload(file: Blob, folder: string, ext: string, downloadName?: string) {
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await this.sb.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
    fail(error);
    return this.sb.storage.from(BUCKET).getPublicUrl(path, downloadName ? { download: downloadName } : undefined).data.publicUrl;
  }
  async remove(urls: string[]) {
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const paths = urls.filter(u => u?.includes(marker)).map(u => decodeURIComponent(u.split(marker)[1].split("?")[0]));
    if (paths.length) fail((await this.sb.storage.from(BUCKET).remove(paths)).error);
  }
  async storageUsage() {
    let total = 0;
    const walk = async (prefix: string, depth: number): Promise<void> => {
      const { data, error } = await this.sb.storage.from(BUCKET).list(prefix, { limit: 1000 });
      if (error || !data) return;
      for (const it of data) {
        if (it.id === null && depth < 3) await walk(prefix ? `${prefix}/${it.name}` : it.name, depth + 1);
        else total += Number((it.metadata as any)?.size ?? 0);
      }
    };
    await walk("", 0);
    return total;
  }
}

/* perkecil gambar sebelum upload (sisi terpanjang maxSide px) lalu simpan sebagai WebP —
   jauh lebih kecil dari PNG (screenshot 3 MB → ±200 KB) dan tetap mendukung transparansi.
   Browser yang belum bisa membuat WebP memakai JPEG, atau PNG bila gambarnya transparan.
   `jpeg = true` untuk foto profil: dipakai juga sebagai gambar pratinjau link, dan tidak semua aplikasi mendukung WebP. */
export function compressImage(file: Blob, maxSide = 1600, quality = 0.82, jpeg = false): Promise<{ blob: Blob; ext: string }> {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type)) return reject(new Error("File harus berupa gambar"));
    if (file.type === "image/svg+xml") return resolve({ blob: file, ext: "svg" });
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const k = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
      const ctx = c.getContext("2d")!;
      if (jpeg) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); }
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      const done = (b: Blob | null, ext: string) => b ? resolve({ blob: b, ext }) : reject(new Error("Gagal memproses gambar"));
      if (jpeg) return c.toBlob(b => done(b, "jpg"), "image/jpeg", quality);
      c.toBlob(b => {
        if (b?.type === "image/webp") return done(b, "webp");
        /* fallback: browser tidak mendukung encode WebP */
        const alpha = file.type !== "image/jpeg" && ctx.getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v < 255);
        c.toBlob(b2 => done(b2, alpha ? "png" : "jpg"), alpha ? "image/png" : "image/jpeg", quality);
      }, "image/webp", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Gambar tidak bisa dibaca")); };
    img.src = url;
  });
}
