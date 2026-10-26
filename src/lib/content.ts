/* =====================================================================
   Sumber konten, berurutan:
     1. Supabase (langsung)
     2. salinan terakhir yang berhasil dibaca server ini (selama server masih "hangat")
     3. salinan cadangan saat build (src/data/snapshot.json — dibuat scripts/snapshot.mjs)
     4. data awal (src/data/default.ts) — hanya bila semua di atas tidak ada
   Jadi saat Supabase sedang di-pause/gangguan, pengunjung tetap melihat isi asli, bukan data contoh.
   Semua data dinormalisasi agar field yang hilang selalu punya nilai bawaan.
   ===================================================================== */
import { DEFAULT_DATA } from "../data/default";
import { normalize, clone } from "./normalize";
import { supabase } from "./supabase";
import { rowsToData } from "./mappers";
import type { PortfolioData } from "./types";
export { normalize };

export type ContentSource = "supabase" | "cache" | "snapshot" | "default";

type Rows = Parameters<typeof rowsToData>[0];
const toData = (rows: Rows) => {
  const m = rowsToData(rows);
  return normalize({ ...m, profile: m.profile ?? clone(DEFAULT_DATA.profile) });
};

/* file snapshot boleh tidak ada (mis. build tanpa Supabase) — glob tidak error bila kosong */
const snapFile = Object.values(import.meta.glob<{ at: string; rows: Rows }>("../data/snapshot.json", { eager: true, import: "default" }))[0];

let lastGood: PortfolioData | null = null;

/** ambil seluruh konten. Struktur tabel: lihat supabase/schema.sql */
export async function getContent(): Promise<{ data: PortfolioData; source: ContentSource; error?: string }> {
  if (!supabase) return { data: normalize(clone(DEFAULT_DATA)), source: "default" };
  try {
    const t = (n: string) => supabase!.from(n).select("*").order("sort");
    const [profile, cats, skills, exp, proj, cases, pubs, certs] = await Promise.all([
      supabase.from("profile").select("data").eq("id", 1).maybeSingle(),
      t("skill_categories"), t("skills"), t("experiences"), t("projects"), t("case_studies"), t("publications"), t("certificates"),
    ]);
    const err = [profile, cats, skills, exp, proj, cases, pubs, certs].find(r => r.error)?.error;
    if (err) throw err;
    const data = toData({ profile: profile.data as any, cats: cats.data ?? [], skills: skills.data ?? [], exp: exp.data ?? [], proj: proj.data ?? [],
      cases: cases.data ?? [], pubs: pubs.data ?? [], certs: certs.data ?? [] });
    lastGood = data;
    return { data: clone(data), source: "supabase" };
  } catch (e: any) {
    const error = e?.message ?? String(e);
    if (lastGood) {
      console.error("[content] Supabase gagal, memakai salinan terakhir:", error);
      return { data: clone(lastGood), source: "cache", error };
    }
    if (snapFile) {
      console.error(`[content] Supabase gagal, memakai snapshot build (${snapFile.at}):`, error);
      return { data: toData(snapFile.rows), source: "snapshot", error };
    }
    console.error("[content] Supabase gagal, memakai data awal:", error);
    return { data: normalize(clone(DEFAULT_DATA)), source: "default", error };
  }
}
