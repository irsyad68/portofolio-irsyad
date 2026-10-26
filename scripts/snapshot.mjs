/* Salinan cadangan konten dari Supabase, dibuat otomatis setiap build (npm run build → prebuild).
   Dipakai website HANYA jika Supabase tidak bisa dihubungi (mis. proyek gratis sedang di-pause),
   supaya pengunjung tetap melihat isi asli — bukan data contoh.
   Hanya membaca data publik (anon key + RLS). Gagal di sini tidak menggagalkan build. */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const OUT = new URL("../src/data/snapshot.json", import.meta.url);
const env = { ...process.env };
if (existsSync(".env")) for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const url = env.PUBLIC_SUPABASE_URL, key = env.PUBLIC_SUPABASE_ANON_KEY;

async function main() {
  if (!url || !key) return console.log("[snapshot] Supabase belum diatur — dilewati.");
  const get = async (path) => {
    const r = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
    return r.json();
  };
  const [profile, cats, skills, exp, proj, cases, pubs, certs] = await Promise.all([
    get("profile?select=data&id=eq.1"), get("skill_categories?select=*&order=sort"), get("skills?select=*&order=sort"),
    get("experiences?select=*&order=sort"), get("projects?select=*&order=sort"), get("case_studies?select=*&order=sort"),
    get("publications?select=*&order=sort"), get("certificates?select=*&order=sort"),
  ]);
  if (!profile[0]) return console.log("[snapshot] profil kosong — dilewati.");
  writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), rows: { profile: profile[0], cats, skills, exp, proj, cases, pubs, certs } }));
  console.log(`[snapshot] tersimpan: ${proj.length} project, ${exp.length} pengalaman, ${certs.length} sertifikat.`);
}
main().catch(e => console.warn("[snapshot] gagal, build tetap lanjut:", e.message));
