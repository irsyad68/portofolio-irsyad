/* =====================================================================
   Panel admin (/admin) — login Supabase, kelola konten, upload ke Storage.
   File baru diupload saat "Simpan" (batal = tidak ada file sampah); file lama yang dihapus
   dibuang dari Storage setelah penyimpanan berhasil.
   ===================================================================== */
import { initTheme } from "./theme";
import { iconSvg as icon } from "../lib/icons";
import { logoHTML, safeSrc, safeUrl, safeCv, prettyUrl, isSamplePhoto } from "../lib/format";
import { SIMPLE_ICONS_CDN } from "../data/default";
import { SupabaseBackend, compressImage, type Backend, type OrderTable, type ActivityRow, type MessageRow, type AnalyticsSummary, type Stat } from "../lib/admin/backend";
import type { PortfolioData, Project, Experience, Certificate, SkillCategory, Photo, CaseStudy, Publication } from "../lib/types";

/* ---------- util DOM ---------- */
const $ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector(s) as T;
const $$ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll(s)] as T[];
const val = (id: string) => ($(`#${id}`) as HTMLInputElement).value.trim();
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const isEmail = (v: string) => /^\S+@\S+\.\S+$/.test(v);
const isHttps = (v: string) => !v || /^https:\/\/\S+\.\S+/.test(v);
const uid = (p: string) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const kb = (n: number) => n < 1024 * 1024 ? Math.round(n / 1024) + " KB" : (n / 1024 / 1024).toFixed(1) + " MB";
function toast(m: string, bad = false) {
  const t = $("#toast"); t.classList.toggle("bad", bad); t.innerHTML = icon(bad ? "x" : "check", 16) + esc(m); t.classList.add("show");
  clearTimeout((t as any)._t); (t as any)._t = setTimeout(() => t.classList.remove("show"), bad ? 5000 : 2800);
}
const SAVED = "Tersimpan — tampil di website dalam ±1 menit";

/* ---------- backend ---------- */
let api: Backend;
let D: PortfolioData;
async function pickBackend(): Promise<Backend | null> {
  const url = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined, key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;
  /* mode uji lokal: hanya ada saat `npm run dev`, tidak ikut ter-build */
  if (import.meta.env.DEV && new URLSearchParams(location.search).has("mock")) {
    const { MemoryBackend } = await import("../lib/admin/memory");
    $("#modeBadge").hidden = false; return new MemoryBackend();
  }
  return url && key ? new SupabaseBackend(url, key) : null;
}

/* jalankan aksi async dengan tombol "sibuk" + pesan error yang jelas.
   Hasil: { ok: true, v } jika berhasil (termasuk fungsi tanpa nilai kembali), { ok: false } jika gagal. */
type Result<T> = { ok: true; v: T } | { ok: false };
async function run<T>(btn: HTMLElement | null, fn: () => Promise<T>, errPrefix = "Gagal menyimpan"): Promise<Result<T>> {
  const old = btn?.innerHTML;
  if (btn) { btn.classList.add("busy"); btn.setAttribute("aria-busy", "true"); btn.innerHTML = `<span class="spin"></span>${btn.textContent?.trim() || ""}`; }
  try { return { ok: true, v: await fn() }; }
  catch (e: any) {
    const msg = String(e?.message || e);
    toast(`${errPrefix}: ${/JWT|session|token/i.test(msg) ? "sesi login habis, silakan masuk lagi" : /row-level security|42501/i.test(msg) ? "akun ini tidak punya izin admin" : msg}`, true);
    return { ok: false };
  } finally { if (btn) { btn.classList.remove("busy"); btn.removeAttribute("aria-busy"); btn.innerHTML = old!; } }
}

/* ===================== LOGIN ===================== */
async function boot() {
  initTheme();
  const b = await pickBackend();
  if (!b) { $("#loginSub").textContent = "Supabase belum dikonfigurasi (.env kosong). Lihat README."; ($("#loginBtn") as HTMLButtonElement).disabled = true; return; }
  api = b;
  const email = await api.currentEmail().catch(() => null);
  if (email) await enter(email); else ($("#em") as HTMLInputElement).focus();
}
async function enter(email: string, fresh = false) {
  if (!(await api.isAdmin().catch(() => false))) {
    await api.signOut(); showLoginError("Akun ini bukan admin portofolio."); return;
  }
  if (fresh) api.logEvent("login").catch(() => {});
  try { if (localStorage.getItem("pf-no-track") === null) localStorage.setItem("pf-no-track", "1"); } catch { /* abaikan */ }
  $("#login").hidden = true; $("#app").hidden = false; $("#bnav").hidden = false;
  for (const id of ["#meEmail", "#meEmailM"]) $(id).textContent = email;
  for (const id of ["#meInit", "#meInitM"]) $(id).textContent = email.slice(0, 2).toUpperCase();
  await reload();
}
/* logo/ikon website: dipakai untuk favicon tab & tanda merek di panel admin */
function applyBranding() {
  const logo = safeSrc(D?.profile?.logo);
  const fav = document.getElementById("favicon") as HTMLLinkElement | null;
  if (fav) { fav.href = logo || "/favicon.svg"; fav.type = logo ? "" : "image/svg+xml"; }
  $$(".brand .mark, .login-brand .mark").forEach(m => {
    m.innerHTML = logo ? `<img src="${esc(logo)}" alt="">` : "AD";
    m.classList.toggle("has-img", !!logo);
  });
}
async function reload() {
  try { D = await api.loadAll(); applyBranding(); renderView(); refreshUnread(); }
  catch (e: any) { $("#viewRoot").innerHTML = `<div class="panel empty">Gagal memuat data: ${esc(e?.message || e)}</div>`; }
}
function showLoginError(m: string) { const e = $("#loginErr"); e.textContent = m; }
$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault(); showLoginError("");
  const email = val("em"), pw = ($("#pw") as HTMLInputElement).value;
  $("#fEmail").classList.toggle("invalid", !isEmail(email)); $("#fPw").classList.toggle("invalid", !pw);
  if (!isEmail(email)) return $("#em").focus();
  if (!pw) return $("#pw").focus();
  await run($("#loginBtn"), async () => {
    try { await api.signIn(email, pw); } catch (err: any) { showLoginError(err.message); return; }
    ($("#pw") as HTMLInputElement).value = "";
    await enter(email, true);
  }, "Gagal masuk");
});
async function logout(all = false) {
  if (dirty && !confirm("Perubahan profil belum disimpan. Tetap keluar?")) return;
  closeSheet();
  await (all ? api.signOutAll() : api.signOut()).catch(() => {});
  dirty = false; location.reload();
}
$("#logout").addEventListener("click", () => logout());
$("#logoutM").addEventListener("click", () => logout());

/* ===================== NAVIGASI ===================== */
type View = "dashboard" | "stats" | "messages" | "profile" | "projects" | "cases" | "pubs" | "experience" | "skills" | "certificates" | "activity" | "account";
const VIEWS: Record<View, { title: string; crumb: string; add?: string; onAdd?: () => void }> = {
  dashboard: { title: "Dashboard", crumb: "Ringkasan" },
  stats: { title: "Statistik pengunjung", crumb: "Tanpa cookie · data pribadi tidak disimpan" },
  messages: { title: "Pesan masuk", crumb: "Formulir kontak website" },
  profile: { title: "Profil & Kontak", crumb: "Konten / Profil" },
  projects: { title: "Projects & Achievements", crumb: "Konten / Projects", add: "Tambah project", onAdd: () => openProject() },
  cases: { title: "Studi kasus", crumb: "Konten / Studi kasus", add: "Tambah studi kasus", onAdd: () => openCase() },
  pubs: { title: "Publikasi", crumb: "Konten / Publikasi", add: "Tambah publikasi", onAdd: () => openPub() },
  experience: { title: "Experience", crumb: "Konten / Experience", add: "Tambah pengalaman", onAdd: () => openExperience() },
  skills: { title: "Technical Skills", crumb: "Konten / Skills", add: "Tambah kategori", onAdd: () => openCategory() },
  certificates: { title: "Certificates", crumb: "Konten / Certificates", add: "Tambah sertifikat", onAdd: () => openCert() },
  activity: { title: "Log aktivitas", crumb: "Akun / Aktivitas" },
  account: { title: "Akun & keamanan", crumb: "Akun / Keamanan" },
};
const MORE_VIEWS: View[] = ["stats", "messages", "cases", "pubs", "skills", "certificates", "activity", "account"];
let view: View = "dashboard", dirty = false;
function go(v: View) {
  if (dirty && view === "profile" && v !== "profile" && !confirm("Perubahan profil belum disimpan. Tinggalkan halaman ini?")) return;
  closeSheet(); dirty = false; view = v; renderView(); scrollTo(0, 0);
}
$$("[data-v].nav-i, [data-v].bn, [data-v].sheet-i").forEach(n => n.addEventListener("click", () => go(n.dataset.v as View)));

/* ----- panel "Lainnya" (HP) ----- */
function openSheet() {
  $("#sheet").classList.add("open"); $("#sheetOv").classList.add("open"); $("#moreBtn").setAttribute("aria-expanded", "true");
  document.body.style.overflow = "hidden"; setTimeout(() => ($(".sheet-i", $("#sheet")) as HTMLElement).focus(), 60);
}
function closeSheet() {
  if (!$("#sheet").classList.contains("open")) return;
  $("#sheet").classList.remove("open"); $("#sheetOv").classList.remove("open"); $("#moreBtn").setAttribute("aria-expanded", "false");
  document.body.style.overflow = "";
}
$("#moreBtn").addEventListener("click", () => $("#sheet").classList.contains("open") ? closeSheet() : openSheet());
$("#sheetOv").addEventListener("click", closeSheet);
$("#addBtn").addEventListener("click", () => VIEWS[view].onAdd?.());
const root = () => $("#viewRoot");
function renderView() {
  const v = VIEWS[view];
  $$("[data-v].nav-i, [data-v].bn, [data-v].sheet-i").forEach(n => n.dataset.v === view ? n.setAttribute("aria-current", "page") : n.removeAttribute("aria-current"));
  MORE_VIEWS.includes(view) ? $("#moreBtn").setAttribute("aria-current", "page") : $("#moreBtn").removeAttribute("aria-current");
  $("#viewTitle").textContent = v.title; $("#crumb").textContent = v.crumb;
  $("#addBtn").hidden = !v.add; if (v.add) $("#addLabel").textContent = v.add;
  $("#nProj").textContent = String(D.projects.length); $("#nExp").textContent = String(D.experience.length);
  $("#nCase").textContent = String(D.cases.length); $("#nPub").textContent = String(D.pubs.length);
  $("#nSkill").textContent = String(D.skills.reduce((n, s) => n + s.items.length, 0)); $("#nCert").textContent = String(D.certs.length);
  const t = todos(); $("#nTodo").textContent = t.length ? String(t.length) : ""; $("#nTodo").hidden = !t.length; $("#nTodoM").hidden = !t.length;
  ({ dashboard: renderDashboard, stats: renderStats, messages: renderMessages, profile: renderProfile, projects: renderProjects, cases: renderCases, pubs: renderPubs, experience: renderExperience, skills: renderSkills, certificates: renderCerts, activity: renderActivity, account: renderAccount })[view]();
}
const kpis = (list: [string, string | number][]) => { $("#kpis").innerHTML = list.map(([l, v]) => `<div class="kpi"><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join(""); };
function filters(el: HTMLElement, opts: string[], cur: string, on: (c: string) => void) {
  el.innerHTML = opts.map(c => `<button class="f-btn" data-c="${esc(c)}" aria-pressed="${c === cur}">${esc(c)}</button>`).join("");
  $$(".f-btn", el).forEach(b => b.addEventListener("click", () => on(b.dataset.c!)));
}
const orderBtns = (id: string, i: number, n: number) =>
  `<button class="btn icon sm" data-up="${esc(id)}" aria-label="Naikkan" ${i === 0 ? "disabled" : ""}>${icon("chevronUp", 14)}</button><button class="btn icon sm" data-down="${esc(id)}" aria-label="Turunkan" ${i === n - 1 ? "disabled" : ""}>${icon("chevronDown", 14)}</button>`;
function bindOrder(scope: HTMLElement, arr: { id: string }[], table: OrderTable, rerender: () => void) {
  $$("[data-up],[data-down]", scope).forEach(b => b.addEventListener("click", async () => {
    const id = b.dataset.up || b.dataset.down!, i = arr.findIndex(x => x.id === id), j = i + (b.dataset.up ? -1 : 1);
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]]; rerender();
    const r = await run(null, () => api.reorder(table, arr.map(x => x.id)), "Gagal mengubah urutan");
    if (!r.ok) { await reload(); return; }
    api.logEvent("reorder", table).catch(() => {});
    $(`[data-${b.dataset.up ? "up" : "down"}="${CSS.escape(id)}"]`, scope)?.focus();
  }));
}

/* ===================== DASHBOARD ===================== */
function todos(): [string, View][] {
  const P = D.profile, out: [string, View][] = [];
  if (!safeSrc(P.photo)) out.push(["Foto profil belum diunggah", "profile"]);
  if (!safeSrc(P.logo)) out.push(["Logo / ikon website belum diunggah — tab browser masih “AD” (opsional)", "profile"]);
  if (!safeCv(P.cv?.src)) out.push(["CV belum diunggah — tombol Download CV hanya menampilkan “CV akan segera tersedia”", "profile"]);
  if (!safeSrc(P.education.logo)) out.push(["Logo universitas belum diunggah (opsional)", "profile"]);
  if (!P.email) out.push(["Email kontak belum diisi", "profile"]);
  D.experience.filter(x => !x.desc).forEach(x => out.push([`Deskripsi kosong: ${x.role}`, "experience"]));
  const noXpPhoto = D.experience.filter(x => !x.photos.some(p => !isSamplePhoto(p.src))).length;
  if (noXpPhoto) out.push([`${noXpPhoto} pengalaman belum punya foto bukti (opsional)`, "experience"]);
  const noPhoto = D.projects.filter(p => !p.photos.length).length;
  if (noPhoto) out.push([`${noPhoto} project belum punya foto dokumentasi`, "projects"]);
  const sample = D.projects.filter(p => /^(p[1-4])$/.test(p.id)).length + D.cases.filter(c => /^cs\d$/.test(c.id)).length + D.pubs.filter(p => /\(example\)/.test(p.t)).length;
  if (sample) out.push([`${sample} isi project / studi kasus / publikasi masih contoh — ganti dengan data asli`, "projects"]);
  const certTodo = D.certs.filter(c => !safeSrc(c.img) || /^Certificate name/.test(c.t)).length;
  if (certTodo) out.push([`${certTodo} sertifikat masih contoh / belum ada gambar`, "certificates"]);
  return out;
}
function renderDashboard() {
  const t = todos(), photos = [...D.experience, ...D.projects].reduce((n, x) => n + x.photos.filter(p => !isSamplePhoto(p.src)).length, 0);
  kpis([["Project", D.projects.length], ["Pengalaman", D.experience.length], ["Foto dokumentasi", photos], ["Perlu dilengkapi", t.length]]);
  root().innerHTML = `<div class="dash">
    <div class="panel pad"><h2 class="ph2">Kelengkapan konten</h2><p class="help">Hal yang masih kosong atau masih contoh. Klik untuk memperbaiki.</p>
      <ul class="todo">${t.length ? t.map(([txt, v]) => `<li><button data-go="${v}">${icon(/opsional/.test(txt) ? "info" : "alert", 16)}<span>${esc(txt)}</span>${icon("chevronRight", 16)}</button></li>`).join("") : `<li class="done">${icon("check", 16)} Semua konten sudah lengkap.</li>`}</ul></div>
    <div class="dash-side">
      <div class="panel pad"><div class="ph-row"><h2 class="ph2">Pesan masuk</h2><button class="btn sm" data-go="messages">Buka</button></div><ul class="msg-mini" id="dashMsg"><li class="help">Memuat…</li></ul></div>
      <div class="panel pad"><div class="ph-row"><h2 class="ph2">Aktivitas terbaru</h2><button class="btn sm" data-go="activity">Lihat semua</button></div><ul class="act-list" id="recentAct"><li class="help">Memuat…</li></ul></div>
      <div class="panel pad"><h2 class="ph2">Penyimpanan file</h2><div class="meter"><span id="meterBar"></span></div><p class="help" id="meterText">Menghitung…</p>
        <p class="help">${api.mode === "supabase" ? "Foto, logo & CV di Supabase Storage (paket gratis: 1 GB)." : "Mode uji lokal — file tidak benar-benar diupload."}</p></div>
      <div class="panel pad"><h2 class="ph2">Optimalkan gambar</h2>
        <p class="help" id="optText">${heavyImages().length ? `${heavyImages().length} gambar lama masih berformat PNG/JPG berukuran besar. Kompres jadi WebP agar website lebih cepat dibuka & hemat kuota Supabase. Tampilan tidak berubah.` : "Semua gambar sudah dalam format ringan (WebP)."}</p>
        ${heavyImages().length ? `<div class="btn-row"><button class="btn" id="optBtn">${icon("zap", 16)}Optimalkan sekarang</button></div>` : ""}</div>
      <div class="panel pad"><h2 class="ph2">Backup data</h2>
        <p class="help">Unduh seluruh isi sebagai JSON (teks & URL file). Simpan berkala, terutama sebelum perubahan besar.</p>
        <div class="btn-row"><button class="btn" id="exportBtn">${icon("download", 16)}Export JSON</button></div></div>
    </div></div>`;
  $$("[data-go]", root()).forEach(b => b.addEventListener("click", () => go(b.dataset.go as View)));
  $("#exportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ ...D, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `portfolio-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); toast("File backup diunduh");
  });
  api.listMessages().then(rows => {
    const el = $("#dashMsg"); if (!el) return;
    const unread = rows.filter(m => !m.read);
    el.innerHTML = unread.length ? unread.slice(0, 3).map(m => `<li><button data-msg="${m.id}"><b>${esc(m.name)}</b><time datetime="${esc(m.created_at)}">${esc(fmtTime(m.created_at).rel)}</time><span>${esc(m.message)}</span></button></li>`).join("")
      + (unread.length > 3 ? `<li class="help">+${unread.length - 3} pesan belum dibaca lainnya</li>` : "")
      : `<li class="help">${rows.length ? "Tidak ada pesan baru." : "Belum ada pesan. Pesan dari formulir kontak website akan muncul di sini."}</li>`;
    $$("[data-msg]", el).forEach(b => b.addEventListener("click", () => { openMsg = Number(b.dataset.msg); go("messages"); }));
  }).catch(() => { const el = $("#dashMsg"); if (el) el.innerHTML = `<li class="help">Pesan tidak bisa dimuat.</li>`; });
  $("#optBtn")?.addEventListener("click", e => optimizeImages(e.currentTarget as HTMLElement));
  const LIMIT = 1024 * 1024 * 1024;
  api.listActivity(5).then(rows => { const el = $("#recentAct"); if (el) el.innerHTML = rows.length ? rows.map(actItem).join("") : `<li class="help">Belum ada aktivitas.</li>`; })
    .catch(() => { const el = $("#recentAct"); if (el) el.innerHTML = `<li class="help">Log aktivitas tidak bisa dimuat.</li>`; });
  api.storageUsage().then(used => {
    const pct = Math.min(100, used / LIMIT * 100), bar = $("#meterBar"); if (!bar) return;
    bar.style.width = Math.max(pct, used ? 1 : 0) + "%"; bar.classList.toggle("high", pct > 80);
    $("#meterText").textContent = `${kb(used)} dari 1 GB terpakai (${pct < 1 && used ? "<1" : pct.toFixed(0)}%).`;
  }).catch(() => { const m = $("#meterText"); if (m) m.textContent = "Tidak bisa membaca pemakaian storage."; });
}

/* ===================== OPTIMASI GAMBAR LAMA ===================== */
const BUCKET_MARK = "/storage/v1/object/public/portfolio/";
/** gambar konten di bucket yang masih PNG/JPG (logo website dibiarkan PNG untuk favicon; foto profil JPEG cukup kecil) */
function heavyImages(): string[] {
  const urls = [/\.png(\?|$)/i.test(D.profile.photo) ? D.profile.photo : "", ...D.experience.flatMap(x => x.photos.map(p => p.src)), ...D.projects.flatMap(p => p.photos.map(x => x.src)),
    ...D.certs.map(c => c.img), ...D.skills.flatMap(c => c.items.map(i => i.logo))];
  return [...new Set(urls.filter(u => u?.includes(BUCKET_MARK) && /\.(png|jpe?g)(\?|$)/i.test(u)))];
}
/** unduh tiap gambar lama → kompres WebP → upload → ganti URL di konten → hapus file lama */
async function optimizeImages(btn: HTMLElement) {
  const list = heavyImages(), text = $("#optText"), map = new Map<string, string>();
  const skillLogos = new Set(D.skills.flatMap(c => c.items.map(i => i.logo)));
  let before = 0, after = 0;
  const r = await run(btn, async () => {
    for (const [i, u] of list.entries()) {
      text.textContent = `Mengompres gambar ${i + 1} dari ${list.length}…`;
      try {
        const res = await fetch(u, { cache: "no-store" }); if (!res.ok) continue;
        const blob = await res.blob();
        const c = await compressImage(blob, skillLogos.has(u) ? 256 : u === D.profile.photo ? 1000 : 1600, 0.82, u === D.profile.photo);
        if (c.blob.size > blob.size * 0.9) continue;          // tidak cukup berhemat — biarkan
        const folder = decodeURIComponent(u.split(BUCKET_MARK)[1].split("?")[0]).split("/").slice(0, -1).join("/");
        map.set(u, await api.upload(c.blob, folder, c.ext)); before += blob.size; after += c.blob.size;
      } catch { /* gambar rusak / gagal dibaca: lewati */ }
    }
    text.textContent = "Menyimpan perubahan…";
    const sw = (u: string) => map.get(u) ?? u, hit = (u: string) => map.has(u), done: string[] = [];
    try {
      if (hit(D.profile.photo)) { const n = { ...D.profile, photo: sw(D.profile.photo) }; await api.saveProfile(n); done.push(D.profile.photo); D.profile = n; }
      for (const [i, x] of D.experience.entries()) if (x.photos.some(p => hit(p.src))) {
        const n = { ...x, photos: x.photos.map(p => ({ ...p, src: sw(p.src) })) }; await api.saveExperience(n, i); done.push(...x.photos.map(p => p.src)); D.experience[i] = n;
      }
      for (const [i, p] of D.projects.entries()) if (p.photos.some(x => hit(x.src))) {
        const n = { ...p, photos: p.photos.map(x => ({ ...x, src: sw(x.src) })) }; await api.saveProject(n, i); done.push(...p.photos.map(x => x.src)); D.projects[i] = n;
      }
      for (const [i, c] of D.certs.entries()) if (hit(c.img)) { const n = { ...c, img: sw(c.img) }; await api.saveCert(n, i); done.push(c.img); D.certs[i] = n; }
      for (const cat of D.skills) for (const [k, s] of cat.items.entries()) if (hit(s.logo)) {
        const n = { ...s, logo: sw(s.logo) }; await api.saveSkill(cat.id, n, k); done.push(s.logo); cat.items[k] = n;
      }
    } finally {
      /* hapus file lama yang sudah tergantikan; file baru yang tidak jadi dipakai juga dibersihkan */
      const used = new Set(done);
      await api.remove([...map.keys()].filter(u => used.has(u))).catch(() => {});
      await api.remove([...map].filter(([o]) => !used.has(o)).map(([, n]) => n)).catch(() => {});
    }
  }, "Gagal mengoptimalkan");
  if (r.ok) toast(map.size ? `${map.size} gambar dioptimalkan: ${kb(before)} → ${kb(after)} (hemat ${Math.round((1 - after / before) * 100)}%)` : "Tidak ada gambar yang perlu dioptimalkan");
  renderView();
}

/* ===================== PENGELOLA FILE (upload saat Simpan) ===================== */
type PendingPhoto = Photo & { file?: Blob; ext?: string };
/** antrian file: yang baru diupload saat commit(), yang lama dihapus setelah sukses */
class FileQueue {
  removed: string[] = [];
  drop(url?: string) { if (url && /^https:\/\//.test(url)) this.removed.push(url); }
  async uploadPhotos(list: PendingPhoto[], folder: string): Promise<Photo[]> {
    const out: Photo[] = [];
    for (const p of list) {
      if (p.file) out.push({ src: await api.upload(p.file, folder, p.ext!), caption: p.caption ?? "" });
      else if (!isSamplePhoto(p.src)) out.push({ src: p.src, caption: p.caption ?? "" });
    }
    return out;
  }
  async cleanup() { if (this.removed.length) await api.remove(this.removed).catch(() => {}); this.removed = []; }
}
const preview = (blob: Blob) => URL.createObjectURL(blob);
/** potong bagian tengah gambar menjadi persegi `size`×`size` PNG (SVG dibiarkan apa adanya) */
function squareImage(file: File, size = 512): Promise<{ blob: Blob; ext: string }> {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type)) return reject(new Error("File harus berupa gambar"));
    if (file.type === "image/svg+xml") return resolve({ blob: file, ext: "svg" });
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height), c = document.createElement("canvas");
      c.width = c.height = Math.min(size, side);
      c.getContext("2d")!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => b ? resolve({ blob: b, ext: "png" }) : reject(new Error("Gagal memproses gambar")), "image/png");
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Gambar tidak bisa dibaca")); };
    img.src = url;
  });
}

/* ===================== PROFIL & KONTAK ===================== */
function renderProfile() {
  const P = structuredClone(D.profile), E = P.education;
  kpis([["Role", P.roles.length], ["Foto profil", safeSrc(P.photo) ? "Ada" : "Belum"], ["CV", safeCv(P.cv?.src) ? "Ada" : "Belum"], ["Status", P.openToWork ? "Open to work" : "—"]]);
  const roles = [...P.roles], files = new FileQueue();
  let photo: PendingPhoto = { src: P.photo };
  let logo: PendingPhoto = { src: P.logo ?? "" };
  let uni: PendingPhoto = { src: E.logo ?? "" };
  let cv: { src: string; name: string; file?: Blob } = { ...P.cv };
  const f = (id: string, label: string, v: string, attrs = "", help = "") => `<div class="field" id="w-${id}"><label for="${id}">${label}</label><input id="${id}" value="${esc(v)}" ${attrs}>${help ? `<div class="help">${help}</div>` : ""}<div class="err" id="e-${id}"></div></div>`;
  const ta = (id: string, label: string, v: string, help = "") => `<div class="field"><label for="${id}">${label}</label><textarea id="${id}">${esc(v)}</textarea>${help ? `<div class="help">${help}</div>` : ""}</div>`;
  root().innerHTML = `<form id="profileForm" class="profile" novalidate>
  <div class="panel pad"><h2 class="ph2">Identitas & hero</h2>
    <div class="row2">${f("pName", "Nama lengkap", P.name)}${f("pTitle", "Jabatan utama", P.title, "", "Tampil sebagai “<b>…</b> focused on …”")}</div>
    <div class="row2">${f("pFirst", "Nama baris 1 (hero)", P.first)}${f("pLast", "Nama baris 2 (hero)", P.last)}</div>
    <div class="field"><label for="roleIn">Role bergilir di hero</label>
      <div class="role-add"><input id="roleIn" placeholder="mis. Cloud Engineer, Network Engineer, IT Helpdesk…" maxlength="40"><button type="button" class="btn" id="roleAddBtn">${icon("plus", 16)}Tambah</button></div>
      <ul class="role-list" id="roleList"></ul>
      <div class="help">Bergantian di bawah nama: “${esc(P.title || "Metallurgical Engineer")} focused on …”. Urutkan dengan tombol panah.</div></div>
    ${f("pHeadline", "Headline (sampul PDF)", P.headline)}
    <div class="row2">${f("pLoc", "Lokasi", P.location)}${f("pHigh", "Label prestasi di foto", P.highlight, "", "Kosongkan untuk menyembunyikan")}</div>
    <div class="row2"><div class="field"><label class="check"><input type="checkbox" id="pOpen" ${P.openToWork ? "checked" : ""}> Tampilkan status “Open to work”</label></div>${f("pStatus", "Teks status", P.status)}</div>
  </div>
  <div class="panel pad"><h2 class="ph2">Logo & ikon website</h2>
    <p class="help">Menggantikan kotak hitam “AD” di <b>tab browser</b> (favicon), <b>navbar</b> website, dan panel admin. Kosongkan untuk memakai inisial nama.</p>
    <div class="logo-row">
      <div class="logo-up"><div class="logo-prev-lg" id="lgPrev"></div>
        <div><label class="btn" tabindex="0" id="lgLbl">${icon("upload", 16)}Pilih gambar<input type="file" id="lgFile" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden></label>
        <button type="button" class="btn danger" id="lgDel">${icon("trash", 16)}Hapus</button>
        <p class="help">PNG/JPG/WebP/SVG. Dipotong otomatis jadi persegi 512×512 — gunakan gambar dengan objek di tengah.</p></div></div>
      <div class="logo-demo" aria-hidden="true">
        <div class="tab-demo"><span class="tab-ic" id="lgTab"></span><span class="tab-tt">${esc(P.name.split(",")[0] || "Portfolio")} — Portfolio</span><span class="tab-x">×</span></div>
        <div class="nav-demo"><span class="nav-ic" id="lgNav"></span><b>${esc(`${P.first} ${String(P.last).split(",")[0]}`.trim())}</b></div>
      </div>
    </div>
  </div>
  <div class="panel pad"><h2 class="ph2">Foto profil</h2>
    <div class="photo-row"><div class="avatar-prev" id="avPrev"></div>
      <div><label class="btn" tabindex="0" id="avLbl">${icon("upload", 16)}Pilih foto<input type="file" id="avFile" accept="image/png,image/jpeg,image/webp" hidden></label>
      <button type="button" class="btn danger" id="avDel">${icon("trash", 16)}Hapus</button>
      <p class="help">Rasio 4:5 (potret). Otomatis diperkecil. Diupload saat menekan “Simpan profil”.</p></div></div>
  </div>
  <div class="panel pad"><h2 class="ph2">Curriculum Vitae (CV)</h2>
    <div class="opts row2" role="radiogroup" aria-label="Sumber CV">
      <label class="opt"><input type="radio" name="cvm" value="upload" ${!cv.src || cv.src.includes("/storage/v1/object/") || cv.src.startsWith("data:") ? "checked" : ""}><span><b>Upload PDF</b><small>Maks 10 MB, disimpan di Supabase Storage</small></span></label>
      <label class="opt"><input type="radio" name="cvm" value="url" ${cv.src && !cv.src.includes("/storage/v1/object/") && cv.src.startsWith("https:") ? "checked" : ""}><span><b>Link (Google Drive, dll.)</b><small>Akses “siapa saja yang punya link”</small></span></label>
    </div>
    <div class="cv-upload"><label class="drop" tabindex="0" id="cvDrop"><input type="file" id="cvFile" accept="application/pdf" hidden>${icon("upload", 20)}<b>Pilih file CV (PDF)</b></label></div>
    <div class="cv-url">${f("cvUrl", "Link CV", cv.src && !cv.src.includes("/storage/v1/object/") ? cv.src : "", 'type="url" placeholder="https://drive.google.com/…"')}</div>
    <div class="cv-now" id="cvNow"></div>
  </div>
  <div class="panel pad"><h2 class="ph2">About</h2>${ta("pLead", "Kalimat pembuka", P.lead, "Kata yang sama dengan role otomatis diberi garis bawah.")}${ta("pAbout", "Paragraf about", P.about)}</div>
  <div class="panel pad"><h2 class="ph2">Versi Bahasa Indonesia (mode ID)</h2>
    <p class="help">Tampil saat pengunjung menekan tombol <b>EN / ID</b>. Kosongkan kolom mana pun untuk memakai teks bahasa Inggris.</p>
    <div class="row2">${f("trTitle", "Jabatan utama (ID)", P.tr.title ?? "", 'placeholder="mis. Sarjana Teknik Metalurgi"')}${f("trStatus", "Teks status (ID)", P.tr.status ?? "", 'placeholder="mis. Terbuka untuk peluang kerja"')}</div>
    ${ta("trLead", "Kalimat pembuka (ID)", P.tr.lead ?? "")}${ta("trAbout", "Paragraf about (ID)", P.tr.about ?? "")}
    ${f("trFocus", "Fokus (ID)", P.tr.focus ?? "")}${ta("trCourses", "Mata kuliah relevan (ID)", P.tr.courses ?? "")}${ta("trThesis", "Judul skripsi (ID)", P.tr.thesis ?? "")}
  </div>
  <div class="panel pad"><h2 class="ph2">Pendidikan</h2>
    <div class="uni-row"><div class="uni-prev" id="uniPrev"></div>
      <div><label class="btn" tabindex="0" id="uniLbl">${icon("upload", 16)}Upload logo universitas<input type="file" id="uniFile" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden></label>
      <button type="button" class="btn danger" id="uniDel">${icon("trash", 16)}Hapus</button>
      <p class="help">Menggantikan ikon toga di kartu pendidikan (bagian About). PNG transparan / SVG paling bagus.</p></div></div>
    <div class="row2">${f("eSchool", "Universitas", E.school)}${f("eFaculty", "Fakultas", E.faculty)}</div>
    <div class="row3">${f("eDegree", "Gelar / jurusan", E.degree)}${f("eYears", "Tahun", E.years)}${f("eGpa", "IPK", E.gpa, "", "Mis. 3.63 / 4.00")}</div>
    ${f("eFocus", "Fokus", E.focus)}${ta("eCourses", "Mata kuliah relevan", E.courses)}${ta("eThesis", "Judul skripsi", E.thesis)}
  </div>
  <div class="panel pad"><h2 class="ph2">Kontak</h2>
    <div class="row3">${f("cEmail", "Email", P.email, 'type="email"')}${f("cLinkedin", "LinkedIn (URL)", P.linkedin, 'type="url" placeholder="https://www.linkedin.com/in/…"')}${f("cGithub", "GitHub (URL)", P.github, 'type="url" placeholder="https://github.com/…"')}</div>
    <p class="help">Nomor HP sengaja tidak ditampilkan di website publik.</p>
  </div>
  <div class="savebar"><span class="help nomargin" id="dirty">Perubahan belum disimpan.</span><button class="btn dark" type="submit" id="pSave">${icon("check", 16)}Simpan profil</button></div>
  </form>`;
  const markDirty = () => { dirty = true; $("#dirty").classList.add("show"); };
  const form = $("#profileForm") as HTMLFormElement;
  form.addEventListener("input", markDirty);

  const drawRoles = () => {
    $("#roleList").innerHTML = roles.map((r, i) => `<li><span>${esc(r)}</span>
      <button type="button" class="btn icon sm" data-ru="${i}" aria-label="Naikkan ${esc(r)}" ${i === 0 ? "disabled" : ""}>${icon("chevronUp", 14)}</button>
      <button type="button" class="btn icon sm" data-rd="${i}" aria-label="Turunkan ${esc(r)}" ${i === roles.length - 1 ? "disabled" : ""}>${icon("chevronDown", 14)}</button>
      <button type="button" class="btn icon sm danger" data-rx="${i}" aria-label="Hapus ${esc(r)}">${icon("x", 14)}</button></li>`).join("") || `<li class="help">Belum ada role.</li>`;
    const mv = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= roles.length) return; [roles[i], roles[j]] = [roles[j], roles[i]]; drawRoles(); markDirty(); };
    $$("[data-ru]", root()).forEach(b => b.addEventListener("click", () => mv(+b.dataset.ru!, -1)));
    $$("[data-rd]", root()).forEach(b => b.addEventListener("click", () => mv(+b.dataset.rd!, 1)));
    $$("[data-rx]", root()).forEach(b => b.addEventListener("click", () => { roles.splice(+b.dataset.rx!, 1); drawRoles(); markDirty(); }));
  };
  const addRole = () => {
    const inp = $("#roleIn") as HTMLInputElement, v = inp.value.trim(); if (!v) return;
    if (roles.some(r => r.toLowerCase() === v.toLowerCase())) return toast("Role sudah ada", true);
    roles.push(v); inp.value = ""; drawRoles(); markDirty(); inp.focus();
  };
  $("#roleAddBtn").addEventListener("click", addRole);
  $("#roleIn").addEventListener("keydown", e => { if ((e as KeyboardEvent).key === "Enter") { e.preventDefault(); addRole(); } });
  drawRoles();

  const drawAv = () => { $("#avPrev").innerHTML = photo.src ? `<img src="${esc(photo.src)}" alt="Foto profil">` : `<span>${icon("user", 28)}</span>`; $("#avDel").hidden = !photo.src; };
  drawAv(); keyClick($("#avLbl"), $("#avFile") as HTMLInputElement);
  $("#avFile").addEventListener("change", async e => {
    const inp = e.target as HTMLInputElement, file = inp.files?.[0]; inp.value = ""; if (!file) return;
    try { const c = await compressImage(file, 1000, .85, true); files.drop(D.profile.photo === photo.src ? photo.src : undefined); photo = { src: preview(c.blob), file: c.blob, ext: c.ext }; drawAv(); markDirty(); }
    catch (err: any) { toast(err.message, true); }
  });
  $("#avDel").addEventListener("click", () => { files.drop(photo.file ? undefined : photo.src); photo = { src: "" }; drawAv(); markDirty(); });

  const ini = esc((P.name.split(/\s+/).filter(w => /^[A-Za-z]/.test(w)).slice(0, 2).map(w => w[0]).join("") || "AD").toUpperCase());
  const drawLogo = () => {
    const img = logo.src ? `<img src="${esc(logo.src)}" alt="">` : `<span class="ini">${ini}</span>`;
    $("#lgPrev").innerHTML = logo.src ? img : `<span class="ini">${ini}</span>`;
    $("#lgTab").innerHTML = img; $("#lgNav").innerHTML = img; $("#lgDel").hidden = !logo.src;
  };
  drawLogo(); keyClick($("#lgLbl"), $("#lgFile") as HTMLInputElement);
  $("#lgFile").addEventListener("change", async e => {
    const inp = e.target as HTMLInputElement, file = inp.files?.[0]; inp.value = ""; if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast("Logo maksimal 5 MB", true);
    try { const c = await squareImage(file, 512); files.drop(logo.file ? undefined : logo.src); logo = { src: preview(c.blob), file: c.blob, ext: c.ext }; drawLogo(); markDirty(); }
    catch (err: any) { toast(err.message, true); }
  });
  $("#lgDel").addEventListener("click", () => { files.drop(logo.file ? undefined : logo.src); logo = { src: "" }; drawLogo(); markDirty(); });

  const drawUni = () => { $("#uniPrev").innerHTML = uni.src ? `<img src="${esc(uni.src)}" alt="Logo universitas">` : icon("cap", 26); $("#uniDel").hidden = !uni.src; };
  drawUni(); keyClick($("#uniLbl"), $("#uniFile") as HTMLInputElement);
  $("#uniFile").addEventListener("change", async e => {
    const inp = e.target as HTMLInputElement, file = inp.files?.[0]; inp.value = ""; if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast("Logo maksimal 5 MB", true);
    try { const c = await compressImage(file, 512, .9); files.drop(uni.file ? undefined : uni.src); uni = { src: preview(c.blob), file: c.blob, ext: c.ext }; drawUni(); markDirty(); }
    catch (err: any) { toast(err.message, true); }
  });
  $("#uniDel").addEventListener("click", () => { files.drop(uni.file ? undefined : uni.src); uni = { src: "" }; drawUni(); markDirty(); });

  const cvMode = () => ($('input[name="cvm"]:checked') as HTMLInputElement).value;
  const drawCv = () => {
    $(".cv-upload").hidden = cvMode() !== "upload"; $(".cv-url").hidden = cvMode() !== "url";
    const has = cv.file || safeCv(cv.src);
    $("#cvNow").innerHTML = has ? `<div class="cv-file">${icon("fileText", 20)}<span><b>${esc(cv.name || "CV")}</b><small>${cv.file ? kb(cv.file.size) + " · akan diupload saat disimpan" : esc(prettyUrl(cv.src))}</small></span>
      ${cv.file ? "" : `<a class="btn sm" href="${esc(cv.src)}" target="_blank" rel="noopener">Cek</a>`}<button type="button" class="btn sm danger" id="cvDel">Hapus</button></div>` : `<p class="help">Belum ada CV — tombol “Download CV” di website menampilkan pesan “CV akan segera tersedia”.</p>`;
    $("#cvDel")?.addEventListener("click", () => { files.drop(cv.file ? undefined : cv.src); cv = { src: "", name: "" }; ($("#cvUrl") as HTMLInputElement).value = ""; drawCv(); markDirty(); });
  };
  $$('input[name="cvm"]', root()).forEach(r => r.addEventListener("change", drawCv));
  dropzone($("#cvDrop"), $("#cvFile") as HTMLInputElement, files2 => {
    const file = files2[0]; if (!file) return;
    if (file.type !== "application/pdf") return toast("CV harus berformat PDF", true);
    if (file.size > 10 * 1024 * 1024) return toast("CV maksimal 10 MB", true);
    files.drop(cv.file ? undefined : cv.src); cv = { src: "", name: file.name, file }; drawCv(); markDirty();
  });
  $("#cvUrl").addEventListener("input", () => { const v = val("cvUrl"); if (!cv.file) { cv = v ? { src: v, name: "CV (link)" } : { src: "", name: "" }; drawCv(); } });
  drawCv();

  form.addEventListener("submit", async e => {
    e.preventDefault(); if (saving) return;
    const errs: string[] = [];
    const check = (id: string, ok: boolean, msg: string) => { $(`#w-${id}`).classList.toggle("invalid", !ok); $(`#e-${id}`).textContent = ok ? "" : msg; if (!ok) errs.push(id); };
    check("pName", !!val("pName"), "Nama wajib diisi.");
    check("cEmail", !val("cEmail") || isEmail(val("cEmail")), "Format email tidak valid.");
    check("cLinkedin", isHttps(val("cLinkedin")), "Harus diawali https://");
    check("cGithub", isHttps(val("cGithub")), "Harus diawali https://");
    if (cvMode() === "url" && !cv.file) check("cvUrl", isHttps(val("cvUrl")), "Harus diawali https://");
    if (!roles.length) { toast("Tambahkan minimal satu role", true); errs.push("roleIn"); }
    if (errs.length) return $(`#${errs[0]}`).focus();
    saving = true;
    await run($("#pSave"), async () => {
      let photoUrl = photo.src, logoUrl = logo.src, uniUrl = uni.src;
      if (logo.file) logoUrl = await api.upload(logo.file, "branding", logo.ext!);
      if (uni.file) uniUrl = await api.upload(uni.file, "education", uni.ext!);
      if (photo.file) photoUrl = await api.upload(photo.file, "profile", photo.ext!);
      let cvOut = { src: safeCv(cv.src) ? cv.src : "", name: cv.name };
      if (cv.file) cvOut = { src: await api.upload(cv.file, "cv", "pdf", cv.name), name: cv.name };
      const next = {
        ...D.profile, name: val("pName"), title: val("pTitle"), first: val("pFirst") || val("pName").split(" ")[0], last: val("pLast"), roles: [...roles],
        headline: val("pHeadline"), location: val("pLoc"), highlight: val("pHigh"), openToWork: ($("#pOpen") as HTMLInputElement).checked, status: val("pStatus"),
        photo: photoUrl, logo: logoUrl, cv: cvOut, lead: val("pLead"), about: val("pAbout"), email: val("cEmail"), linkedin: val("cLinkedin"), github: val("cGithub"),
        education: { school: val("eSchool"), faculty: val("eFaculty"), degree: val("eDegree"), years: val("eYears"), gpa: val("eGpa"), focus: val("eFocus"), courses: val("eCourses"), thesis: val("eThesis"), logo: uniUrl },
        tr: { title: val("trTitle"), status: val("trStatus"), lead: val("trLead"), about: val("trAbout"), focus: val("trFocus"), courses: val("trCourses"), thesis: val("trThesis") },
      };
      await api.saveProfile(next);
      D.profile = next; dirty = false; await files.cleanup(); applyBranding(); toast(SAVED); renderView();
    });
    saving = false;
  });
}
addEventListener("beforeunload", e => { if (dirty) e.preventDefault(); });

/* ===================== PROJECTS ===================== */
const PROJECT_CATS = ["Research", "Internship", "Case Study", "Project", "Competition", "Achievement"];
/* kategori yang sudah dipakai data tetap bisa dipilih */
const projectCats = () => [...new Set([...PROJECT_CATS, ...D.projects.map(p => p.c).filter(Boolean)])];
const PROJECT_ICONS: Record<string, string> = { folder: "Folder", flask: "Lab / kimia", microscope: "Analisis lab", factory: "Pabrik / proses", gauge: "Proses / efisiensi", layers: "Mineral / lapisan", globe: "Web", code: "Kode", layout: "UI / Layout", database: "Database", network: "Jaringan", activity: "Monitoring", flame: "Api / sensor", radio: "IoT / nirkabel", cpu: "Hardware", bot: "Robot", hand: "Gesture", swap: "Client–server", award: "Penghargaan", trophy: "Juara" };
let pCat = "Semua", pQ = "", flashId: string | null = null;
function renderProjects() {
  root().innerHTML = `<div class="panel"><div class="panel-h"><div class="filters" id="pFilters" role="group" aria-label="Filter kategori"></div>
    <label class="search">${icon("search", 16)}<input id="pQ" type="search" placeholder="Cari judul…" aria-label="Cari judul project" value="${esc(pQ)}"></label></div>
    <div class="table-wrap"><table><thead><tr><th>Judul</th><th class="hide-m">Kategori</th><th class="hide-m">Dokumentasi & link</th><th>Tampil</th><th>Aksi</th></tr></thead><tbody id="pBody"></tbody></table></div></div>`;
  filters($("#pFilters"), ["Semua", ...projectCats()], pCat, c => { pCat = c; renderProjects(); });
  $("#pQ").addEventListener("input", e => { pQ = (e.target as HTMLInputElement).value; drawRows(); });
  drawRows();
  function drawRows() {
    const q = pQ.trim().toLowerCase(), canOrder = pCat === "Semua" && !q;
    const rows = D.projects.filter(p => (pCat === "Semua" || p.c === pCat) && `${p.t} ${p.s}`.toLowerCase().includes(q));
    $("#pBody").innerHTML = rows.length ? rows.map(p => {
      const i = D.projects.indexOf(p), ph = p.photos.filter(x => safeSrc(x.src));
      return `<tr class="${p.id === flashId ? "flash" : ""}">
       <td><div class="ttl"><span class="th">${ph.length ? `<img src="${esc(ph[0].src)}" alt="">` : icon(p.ic || "folder", 20)}</span><div><b>${esc(p.t)}</b><small>${esc(p.s || "—")} · ${esc(p.y)}</small></div></div></td>
       <td class="hide-m"><span class="pill">${esc(p.c)}</span></td>
       <td class="hide-m"><div class="badges"><span class="pill ${ph.length ? "" : "dim"}">${icon("camera", 13)}${ph.length}</span><span class="pill ${safeUrl(p.demo) ? "" : "dim"}">Demo</span><span class="pill ${safeUrl(p.repo) ? "" : "dim"}">GitHub</span></div></td>
       <td><button class="sw" role="switch" aria-checked="${p.pub !== false}" aria-label="Tampilkan ${esc(p.t)} di website" data-sw="${esc(p.id)}"></button></td>
       <td><div class="acts">${canOrder ? orderBtns(p.id, i, D.projects.length) : ""}<button class="btn icon" data-ed="${esc(p.id)}" aria-label="Edit ${esc(p.t)}">${icon("pencil", 15)}</button><button class="btn icon danger" data-del="${esc(p.id)}" aria-label="Hapus ${esc(p.t)}">${icon("trash", 15)}</button></div></td></tr>`;
    }).join("") : `<tr><td colspan="5" class="empty">Tidak ada item yang cocok.</td></tr>`;
    const pub = D.projects.filter(p => p.pub !== false).length;
    kpis([["Total item", D.projects.length], ["Tampil di website", pub], ["Dengan dokumentasi", D.projects.filter(p => p.photos.length).length], ["Dengan link", D.projects.filter(p => safeUrl(p.demo) || safeUrl(p.repo)).length]]);
    const body = $("#pBody");
    $$("[data-sw]", body).forEach(s => s.addEventListener("click", async () => {
      const p = D.projects.find(x => x.id === s.dataset.sw)!, next = { ...p, pub: p.pub === false };
      const r = await run(s, () => api.saveProject(next, D.projects.indexOf(p)));
      if (r.ok) { Object.assign(p, next); toast(next.pub ? "Ditampilkan di website (±1 menit)" : "Disembunyikan dari website (±1 menit)"); drawRows(); }
    }));
    $$("[data-del]", body).forEach(b => b.addEventListener("click", () => {
      const p = D.projects.find(x => x.id === b.dataset.del)!;
      askConfirm("Hapus project?", `“${p.t}” beserta fotonya akan dihapus.`, "Hapus", async () => {
        if (!(await run(null, () => api.deleteProject(p.id), "Gagal menghapus")).ok) return;
        await api.remove(p.photos.map(x => x.src)).catch(() => {});
        D.projects = D.projects.filter(x => x !== p); toast("Project dihapus"); renderView();
      }, b);
    }));
    $$("[data-ed]", body).forEach(b => b.addEventListener("click", () => openProject(b.dataset.ed)));
    if (canOrder) bindOrder(body, D.projects, "projects", drawRows);
    flashId = null;
  }
}
function openProject(id?: string) {
  const p = id ? D.projects.find(x => x.id === id) : undefined, tags = [...(p?.tags ?? [])];
  const photos: PendingPhoto[] = (p?.photos ?? []).map(x => ({ ...x })), files = new FileQueue();
  openDrawer(p ? "Edit project" : "Tambah project", `
    <div class="sec-t">Informasi utama</div>
    <div class="field" id="fwT"><label for="fT">Judul</label><input id="fT" value="${esc(p?.t)}" placeholder="mis. Atmospheric Leaching of Nickel Laterite"><div class="err">Judul wajib diisi.</div></div>
    <div class="field"><label for="fS">Subjudul / teknologi utama</label><input id="fS" value="${esc(p?.s)}" placeholder="mis. Hydrometallurgy · Final research"></div>
    <div class="row3">
      <div class="field"><label for="fC">Kategori</label><select id="fC">${projectCats().map(c => `<option ${p?.c === c ? "selected" : ""}>${c}</option>`).join("")}</select></div>
      <div class="field"><label for="fY">Tahun</label><input id="fY" type="number" inputmode="numeric" min="2000" max="2100" value="${esc(p?.y || new Date().getFullYear())}"></div>
      <div class="field"><label for="fIc">Ikon</label><div class="ic-pick"><span id="icPrev"></span><select id="fIc">${Object.entries(PROJECT_ICONS).map(([k, l]) => `<option value="${k}" ${(p?.ic || "folder") === k ? "selected" : ""}>${l}</option>`).join("")}</select></div></div>
    </div>
    <div class="field"><label for="fD">Deskripsi</label><textarea id="fD" placeholder="Apa yang Anda kerjakan dan apa hasilnya?">${esc(p?.d)}</textarea><div class="help">Disarankan 2–3 kalimat (tampil utuh di popup & PDF).</div></div>
    <details class="tr-box"><summary>Versi Bahasa Indonesia (opsional)</summary><div class="field"><label for="fSId">Subjudul (ID)</label><input id="fSId" value="${esc(p?.tr?.s)}"></div><div class="field"><label for="fDId">Deskripsi (ID)</label><textarea id="fDId">${esc(p?.tr?.d)}</textarea></div></details>
    <div class="field"><label for="fTag">Tags / metode / alat</label><input id="fTag" placeholder="Ketik lalu tekan Enter"><div class="chips" id="chips"></div></div>
    <hr><div class="sec-t">Link (opsional)</div>
    <div class="row2">
      <div class="field" id="fwDemo"><label for="fDemo">Link demo / website</label><input id="fDemo" type="url" value="${esc(p?.demo)}" placeholder="https://"><div class="err">Harus diawali https://</div></div>
      <div class="field" id="fwRepo"><label for="fRepo">Link GitHub / source code</label><input id="fRepo" type="url" value="${esc(p?.repo)}" placeholder="https://github.com/…"><div class="err">Harus diawali https://</div></div>
    </div>
    <p class="help">Tombol “Live demo” / “Source code” di popup hanya muncul jika link diisi — boleh dikosongkan.</p>
    <hr><div class="sec-t">Foto dokumentasi</div><div id="pUp"></div>`);
  const chips = () => {
    $("#chips").innerHTML = tags.map((t, i) => `<span class="chip">${esc(t)}<button type="button" data-i="${i}" aria-label="Hapus tag ${esc(t)}">${icon("x", 12)}</button></span>`).join("");
    $$("#chips button").forEach(b => b.addEventListener("click", () => { tags.splice(+b.dataset.i!, 1); chips(); $("#fTag").focus(); }));
  }; chips();
  $("#fTag").addEventListener("keydown", e => {
    const k = (e as KeyboardEvent).key; if (k !== "Enter" && k !== ",") return; e.preventDefault();
    const inp = e.target as HTMLInputElement, v = inp.value.trim(); if (v && !tags.includes(v)) { tags.push(v); chips(); } inp.value = "";
  });
  const icp = () => { $("#icPrev").innerHTML = icon(($("#fIc") as HTMLSelectElement).value, 18); }; $("#fIc").addEventListener("change", icp); icp();
  photoUploader($("#pUp"), photos, 6, files, "Foto utama jadi sampul kartu project.");
  onSave = async () => {
    if (!required("fT", "fwT")) return false;
    const demo = val("fDemo"), repo = val("fRepo");
    $("#fwDemo").classList.toggle("invalid", !isHttps(demo)); $("#fwRepo").classList.toggle("invalid", !isHttps(repo));
    if (!isHttps(demo) || !isHttps(repo)) { $(!isHttps(demo) ? "#fDemo" : "#fRepo").focus(); return false; }
    const pend = val("fTag"); if (pend && !tags.includes(pend)) tags.push(pend);
    const y = parseInt(val("fY"), 10), pid = p?.id ?? uid("p");
    const next: Project = { id: pid, pub: p?.pub ?? true, t: val("fT"), s: val("fS"), c: val("fC"), y: Number.isFinite(y) ? y : new Date().getFullYear(),
      ic: val("fIc"), d: val("fD"), tags, demo, repo, photos: await files.uploadPhotos(photos, `projects/${pid}`), tr: { s: val("fSId"), d: val("fDId") } };
    const sort = p ? D.projects.indexOf(p) : 0;
    await api.saveProject(next, sort);
    if (p) Object.assign(p, next); else { D.projects.unshift(next); await api.reorder("projects", D.projects.map(x => x.id)); }
    await files.cleanup(); flashId = pid; toast(SAVED); return true;
  };
}

/* ===================== EXPERIENCE ===================== */
let xType = "Semua";
function renderExperience() {
  const rows = D.experience.filter(x => xType === "Semua" || x.type === xType);
  root().innerHTML = `<div class="panel"><div class="panel-h"><div class="filters" id="xFilters" role="group" aria-label="Filter jenis"></div>
    <span class="help nomargin">Urutan di sini = urutan di website & PDF.</span></div>
    <div class="table-wrap"><table><thead><tr><th>Posisi & organisasi</th><th class="hide-m">Periode</th><th>Foto</th><th>Aksi</th></tr></thead><tbody id="xBody">
    ${rows.map(x => {
      const i = D.experience.indexOf(x), ph = x.photos.filter(p => safeSrc(p.src) && !isSamplePhoto(p.src));
      return `<tr class="${x.id === flashId ? "flash" : ""}">
       <td><div class="ttl"><div><b>${esc(x.role)}</b><small>${esc(x.org)} · ${x.type === "Work" ? "Work" : "Organization"}${x.desc ? "" : ` · <span class="warn-t">deskripsi kosong</span>`}</small></div></div></td>
       <td class="hide-m nowrap">${esc(x.date)}</td>
       <td><div class="ph-stack">${ph.slice(0, 3).map(p => `<img src="${esc(p.src)}" alt="">`).join("")}<span>${ph.length || "—"}</span></div></td>
       <td><div class="acts">${xType === "Semua" ? orderBtns(x.id, i, D.experience.length) : ""}<button class="btn icon" data-ed="${esc(x.id)}" aria-label="Edit ${esc(x.role)}">${icon("pencil", 15)}</button><button class="btn icon danger" data-del="${esc(x.id)}" aria-label="Hapus ${esc(x.role)}">${icon("trash", 15)}</button></div></td></tr>`;
    }).join("") || `<tr><td colspan="4" class="empty">Belum ada pengalaman.</td></tr>`}</tbody></table></div></div>`;
  filters($("#xFilters"), ["Semua", "Work", "Organization"], xType, c => { xType = c; renderExperience(); });
  kpis([["Total pengalaman", D.experience.length], ["Work", D.experience.filter(x => x.type === "Work").length], ["Organization", D.experience.filter(x => x.type === "Organization").length], ["Foto bukti", D.experience.reduce((n, x) => n + x.photos.filter(p => !isSamplePhoto(p.src)).length, 0)]]);
  const body = $("#xBody");
  $$("[data-ed]", body).forEach(b => b.addEventListener("click", () => openExperience(b.dataset.ed)));
  $$("[data-del]", body).forEach(b => b.addEventListener("click", () => {
    const x = D.experience.find(e => e.id === b.dataset.del)!;
    askConfirm("Hapus pengalaman?", `“${x.role}” beserta fotonya akan dihapus.`, "Hapus", async () => {
      if (!(await run(null, () => api.deleteExperience(x.id), "Gagal menghapus")).ok) return;
      await api.remove(x.photos.map(p => p.src)).catch(() => {});
      D.experience = D.experience.filter(e => e !== x); toast("Pengalaman dihapus"); renderView();
    }, b);
  }));
  if (xType === "Semua") bindOrder(body, D.experience, "experiences", renderExperience);
  flashId = null;
}
function openExperience(id?: string) {
  const x = id ? D.experience.find(e => e.id === id) : undefined;
  const photos: PendingPhoto[] = (x?.photos ?? []).map(p => ({ ...p })), files = new FileQueue();
  openDrawer(x ? "Edit pengalaman" : "Tambah pengalaman", `
    <div class="sec-t">Informasi</div>
    <div class="row2">
      <div class="field"><label for="xT">Jenis</label><select id="xT"><option value="Work" ${x?.type === "Work" ? "selected" : ""}>Work</option><option value="Organization" ${x?.type === "Organization" ? "selected" : ""}>Organization & volunteer</option></select></div>
      <div class="field"><label for="xDt">Periode</label><input id="xDt" value="${esc(x?.date)}" placeholder="mis. Jan 2024 – Dec 2024"></div>
    </div>
    <div class="field" id="fwR"><label for="xR">Posisi / peran</label><input id="xR" value="${esc(x?.role)}" placeholder="mis. Internship — Extractive Metallurgy"><div class="err">Posisi wajib diisi.</div></div>
    <div class="field"><label for="xO">Organisasi / instansi</label><input id="xO" value="${esc(x?.org)}" placeholder="mis. PT Contoh Smelter Indonesia"></div>
    <div class="field"><label for="xD">Deskripsi</label><textarea id="xD" placeholder="Apa peran dan kontribusi Anda?">${esc(x?.desc)}</textarea></div>
    <details class="tr-box"><summary>Versi Bahasa Indonesia (opsional)</summary><div class="field"><label for="xRId">Posisi / peran (ID)</label><input id="xRId" value="${esc(x?.tr?.role)}"></div><div class="field"><label for="xDId">Deskripsi (ID)</label><textarea id="xDId">${esc(x?.tr?.desc)}</textarea></div></details>
    <hr><div class="sec-t">Foto bukti kegiatan</div><div id="xUp"></div>`);
  photoUploader($("#xUp"), photos, 8, files, "Foto utama tampil pertama di website & PDF.");
  onSave = async () => {
    if (!required("xR", "fwR")) return false;
    const xid = x?.id ?? uid("x");
    const next: Experience = { id: xid, type: val("xT") as Experience["type"], date: val("xDt"), role: val("xR"), org: val("xO"), desc: val("xD"),
      photos: await files.uploadPhotos(photos, `experience/${xid}`), tr: { role: val("xRId"), desc: val("xDId") } };
    await api.saveExperience(next, x ? D.experience.indexOf(x) : 0);
    if (x) Object.assign(x, next); else { D.experience.unshift(next); await api.reorder("experiences", D.experience.map(e => e.id)); }
    await files.cleanup(); flashId = xid; toast(SAVED); return true;
  };
}

/* ===================== SKILLS ===================== */
const CAT_ICONS: Record<string, string> = { code: "Kode", flame: "Ekstraksi", flask: "Lab / kimia", microscope: "Analisis lab", factory: "Proses", layers: "Mineral", database: "Database", layout: "Web / UI", network: "Jaringan", cpu: "Hardware / IoT", bot: "Robot", globe: "Web", activity: "Monitoring" };
function renderSkills() {
  root().innerHTML = `<div class="sk-grid" id="skGrid">${D.skills.map((s, ci) => `<div class="sk-cat">
    <div class="sk-head"><span class="th">${icon(s.ic || "code", 18)}</span><h3>${esc(s.cat)}</h3><small>${s.items.length}</small>
      <div class="acts">${orderBtns(s.id, ci, D.skills.length)}
      <button class="btn icon sm" data-edc="${esc(s.id)}" aria-label="Edit kategori ${esc(s.cat)}">${icon("pencil", 14)}</button>
      <button class="btn icon sm" data-add="${esc(s.id)}" aria-label="Tambah skill ke ${esc(s.cat)}">${icon("plus", 14)}</button></div></div>
    <div class="sk-items">${s.items.map((it, i) => `<span class="sk-item"><span class="lg">${logoHTML(it.logo, it.name, 16)}</span>${esc(it.name)}
      <button data-ed="${esc(s.id)}:${i}" aria-label="Edit ${esc(it.name)}">${icon("pencil", 13)}</button>
      <button data-del="${esc(s.id)}:${i}" aria-label="Hapus ${esc(it.name)}">${icon("x", 13)}</button></span>`).join("") || `<span class="help">Belum ada skill. Klik + untuk menambah.</span>`}</div>
  </div>`).join("") || `<div class="panel empty">Belum ada kategori.</div>`}</div>`;
  const all = D.skills.flatMap(s => s.items);
  kpis([["Total skill", all.length], ["Kategori", D.skills.length], ["Logo otomatis", all.filter(i => i.logo?.startsWith("si:")).length], ["Logo upload", all.filter(i => /^https:/.test(i.logo || "")).length]]);
  const g = $("#skGrid");
  $$("[data-add]", g).forEach(b => b.addEventListener("click", () => openSkill(null, b.dataset.add!)));
  $$("[data-edc]", g).forEach(b => b.addEventListener("click", () => openCategory(b.dataset.edc)));
  $$("[data-ed]", g).forEach(b => b.addEventListener("click", () => { const [c, i] = b.dataset.ed!.split(":"); openSkill(+i, c); }));
  $$("[data-del]", g).forEach(b => b.addEventListener("click", () => {
    const [c, i] = b.dataset.del!.split(":"), cat = D.skills.find(s => s.id === c)!, it = cat.items[+i];
    askConfirm("Hapus skill?", `“${it.name}” akan dihapus dari ${cat.cat}.`, "Hapus", async () => {
      if (it.id && !(await run(null, () => api.deleteSkill(it.id!), "Gagal menghapus")).ok) return;
      if (/^https:/.test(it.logo || "")) await api.remove([it.logo]).catch(() => {});
      cat.items.splice(+i, 1); toast("Skill dihapus"); renderView();
    }, b);
  }));
  bindOrder(g, D.skills, "skill_categories", renderSkills);
}
function openCategory(id?: string) {
  const c = id ? D.skills.find(s => s.id === id) : undefined;
  openDrawer(c ? "Edit kategori" : "Tambah kategori", `
    <div class="field" id="fwCat"><label for="cN">Nama kategori</label><input id="cN" value="${esc(c?.cat)}" placeholder="mis. Cloud & DevOps"><div class="err">Nama wajib diisi.</div></div>
    <div class="field"><label for="cIc">Ikon</label><div class="ic-pick"><span id="cIcPrev"></span><select id="cIc">${Object.entries(CAT_ICONS).map(([k, l]) => `<option value="${k}" ${(c?.ic || "code") === k ? "selected" : ""}>${l}</option>`).join("")}</select></div></div>
    <label class="check"><input type="checkbox" id="cWide" ${c?.wide ? "checked" : ""}> Kartu lebar (untuk kategori dengan banyak skill)</label>
    ${c ? `<hr><button type="button" class="btn danger" id="cDel">${icon("trash", 16)}Hapus kategori ini</button><p class="help">Semua skill di dalamnya ikut terhapus.</p>` : ""}`);
  const pv = () => { $("#cIcPrev").innerHTML = icon(($("#cIc") as HTMLSelectElement).value, 18); }; $("#cIc").addEventListener("change", pv); pv();
  $("#cDel")?.addEventListener("click", e => askConfirm("Hapus kategori?", `Kategori “${c!.cat}” dan ${c!.items.length} skill di dalamnya akan dihapus.`, "Hapus", async () => {
    if (!(await run(null, () => api.deleteCategory(c!.id), "Gagal menghapus")).ok) return;
    await api.remove(c!.items.map(i => i.logo).filter(l => /^https:/.test(l))).catch(() => {});
    D.skills = D.skills.filter(s => s !== c); closeDrawer(); toast("Kategori dihapus"); renderView();
  }, e.currentTarget as HTMLElement));
  onSave = async () => {
    if (!required("cN", "fwCat")) return false;
    const next: SkillCategory = { id: c?.id ?? uid("s"), cat: val("cN"), ic: val("cIc"), wide: ($("#cWide") as HTMLInputElement).checked, items: c?.items ?? [] };
    await api.saveCategory(next, c ? D.skills.indexOf(c) : D.skills.length);
    if (c) Object.assign(c, next); else D.skills.push(next);
    toast(SAVED); return true;
  };
}
const guessSlug = (n: string) => n.toLowerCase().replace(/\+/g, "plus").replace(/\./g, "dot").replace(/#/g, "sharp").replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
function openSkill(index: number | null, catId: string) {
  const cat = D.skills.find(s => s.id === catId) ?? D.skills[0]; if (!cat) return toast("Buat kategori dulu", true);
  const it = index != null ? cat.items[index] : null, logo = it?.logo || "", files = new FileQueue();
  const mode = /^https:/.test(logo) ? "upload" : logo.startsWith("si:") || !it ? "si" : "none";
  openDrawer(it ? "Edit skill" : "Tambah skill", `
    <div class="field" id="fwN"><label for="sN">Nama skill / bahasa</label><input id="sN" value="${esc(it?.name)}" placeholder="mis. Laravel"><div class="err">Nama wajib diisi.</div></div>
    <div class="field"><label for="sC">Kategori</label><select id="sC">${D.skills.map(s => `<option value="${esc(s.id)}" ${s.id === cat.id ? "selected" : ""}>${esc(s.cat)}</option>`).join("")}</select></div>
    <hr><div class="sec-t">Logo</div>
    <div class="opts" role="radiogroup" aria-label="Sumber logo">
      <label class="opt"><input type="radio" name="lm" value="si" ${mode === "si" ? "checked" : ""}><span><b>Logo otomatis</b><small>Dari Simple Icons, warnanya mengikuti tema</small></span></label>
      <label class="opt"><input type="radio" name="lm" value="upload" ${mode === "upload" ? "checked" : ""}><span><b>Upload gambar</b><small>PNG/SVG/JPG, tampil apa adanya</small></span></label>
      <label class="opt"><input type="radio" name="lm" value="none" ${mode === "none" ? "checked" : ""}><span><b>Tanpa logo</b><small>Pakai ikon / inisial</small></span></label>
    </div>
    <div class="field lm-si mt"><label for="sSlug">Nama logo (slug)</label>
      <div class="row-logo"><input id="sSlug" value="${esc(logo.startsWith("si:") ? logo.slice(3) : "")}" placeholder="otomatis dari nama"><span class="logo-prev" id="slugPrev"></span></div>
      <div class="help" id="slugHelp">Cari nama logo di <a href="https://simpleicons.org" target="_blank" rel="noopener">simpleicons.org</a>.</div></div>
    <div class="field lm-upload mt"><label>File logo</label>
      <div class="row-logo"><label class="drop grow" tabindex="0" id="sDrop"><input type="file" id="sFile" accept="image/png,image/svg+xml,image/jpeg,image/webp" hidden>${icon("upload", 18)}<b>Pilih gambar logo</b></label><span class="logo-prev" id="upPrev"></span></div></div>
    <hr><div class="sec-t">Pratinjau di website</div>
    <div class="mq-prev"><span class="mq-item"><span class="mq-logo" id="pvLogo"></span><span id="pvName">Nama skill</span></span></div>`);
  let up: { src: string; file?: Blob; ext?: string } = { src: /^https:/.test(logo) ? logo : "" };
  const m = () => ($('input[name="lm"]:checked') as HTMLInputElement).value;
  const current = () => {
    if (m() === "si") { const sl = val("sSlug") || guessSlug(val("sN")); return sl ? "si:" + sl : ""; }
    return m() === "upload" ? up.src : (it?.logo?.startsWith("ic:") ? it.logo : "");
  };
  let checkT: ReturnType<typeof setTimeout>;
  const upd = () => {
    $(".lm-si").hidden = m() !== "si"; $(".lm-upload").hidden = m() !== "upload";
    const l = current(), name = val("sN") || "Nama skill";
    $("#pvName").textContent = name; $("#pvLogo").innerHTML = up.file && m() === "upload" ? `<img class="logo-img" src="${esc(up.src)}" alt="" style="width:1.375rem;height:1.375rem">` : logoHTML(l, name, 22);
    $("#upPrev").innerHTML = up.src ? `<img class="logo-img" src="${esc(up.src)}" alt="" style="width:1.625rem;height:1.625rem">` : "";
    if (m() === "si") {
      const slug = l.startsWith("si:") ? l.slice(3) : ""; $("#slugPrev").innerHTML = slug ? logoHTML(l, name, 26) : "";
      clearTimeout(checkT); checkT = setTimeout(() => {
        if (!slug) return; const im = new Image();
        im.onload = () => { $("#slugHelp").innerHTML = `Logo <b>${esc(slug)}</b> ditemukan.`; };
        im.onerror = () => { $("#slugHelp").innerHTML = `Logo “${esc(slug)}” tidak ada. Cek di <a href="https://simpleicons.org" target="_blank" rel="noopener">simpleicons.org</a> atau pilih Upload gambar.`; };
        im.src = SIMPLE_ICONS_CDN + slug.replace(/[^a-z0-9]/g, "") + ".svg";
      }, 350);
    }
  };
  $$('input[name="lm"]').forEach(r => r.addEventListener("change", upd)); $("#sN").addEventListener("input", upd); $("#sSlug").addEventListener("input", upd); upd();
  dropzone($("#sDrop"), $("#sFile") as HTMLInputElement, async fl => {
    const f = fl[0]; if (!f) return; if (f.size > 2 * 1024 * 1024) return toast("Logo maksimal 2 MB", true);
    try { const c = await compressImage(f, 256, .9); files.drop(up.file ? undefined : up.src); up = { src: preview(c.blob), file: c.blob, ext: c.ext }; upd(); } catch (err: any) { toast(err.message, true); }
  });
  onSave = async () => {
    if (!required("sN", "fwN")) return false;
    if (m() === "upload" && !up.src) { toast("Pilih file logo dulu", true); return false; }
    let l = current();
    if (m() === "upload" && up.file) l = await api.upload(up.file, "logos", up.ext!);
    if (m() !== "upload" && /^https:/.test(it?.logo || "")) files.drop(it!.logo);
    const target = D.skills.find(s => s.id === val("sC"))!;
    const moving = it && target !== cat, sort = it && !moving ? index! : target.items.length;
    const id = await api.saveSkill(target.id, { id: it?.id, name: val("sN"), logo: l }, sort);
    const item = { id, name: val("sN"), logo: l };
    if (it && !moving) Object.assign(it, item); else { if (it) cat.items.splice(index!, 1); target.items.push(item); }
    await files.cleanup(); toast(SAVED); return true;
  };
}

/* ===================== STUDI KASUS ===================== */
function renderCases() {
  root().innerHTML = `<div class="panel"><div class="panel-h"><span class="help nomargin">Urutan di sini = urutan di website. Bagian “Case studies” disembunyikan bila kosong.</span></div>
    <div class="table-wrap"><table><thead><tr><th>Judul & konteks</th><th class="hide-m">Tahun</th><th class="hide-m">ID</th><th>Aksi</th></tr></thead><tbody id="csBody">
    ${D.cases.map((c, i) => `<tr class="${c.id === flashId ? "flash" : ""}">
      <td><div class="ttl"><span class="th">${icon(c.ic || "flask", 20)}</span><div><b>${esc(c.t)}</b><small>${esc(c.ctx || "—")}${c.problem && c.result ? "" : ` · <span class="warn-t">tantangan/hasil kosong</span>`}</small></div></div></td>
      <td class="hide-m nowrap">${esc(c.y || "—")}</td>
      <td class="hide-m"><span class="pill ${c.tr?.t ? "" : "dim"}">ID</span></td>
      <td><div class="acts">${orderBtns(c.id, i, D.cases.length)}<button class="btn icon" data-ed="${esc(c.id)}" aria-label="Edit ${esc(c.t)}">${icon("pencil", 15)}</button><button class="btn icon danger" data-del="${esc(c.id)}" aria-label="Hapus ${esc(c.t)}">${icon("trash", 15)}</button></div></td></tr>`).join("") || `<tr><td colspan="4" class="empty">Belum ada studi kasus — bagian ini tidak tampil di website.</td></tr>`}</tbody></table></div></div>`;
  kpis([["Total studi kasus", D.cases.length], ["Dengan foto", D.cases.filter(c => c.photos.length).length], ["Versi ID", D.cases.filter(c => c.tr?.t).length], ["Masih contoh", D.cases.filter(c => /^cs\d$/.test(c.id)).length]]);
  const body = $("#csBody");
  $$("[data-ed]", body).forEach(b => b.addEventListener("click", () => openCase(b.dataset.ed)));
  $$("[data-del]", body).forEach(b => b.addEventListener("click", () => {
    const c = D.cases.find(x => x.id === b.dataset.del)!;
    askConfirm("Hapus studi kasus?", `“${c.t}” beserta fotonya akan dihapus.`, "Hapus", async () => {
      if (!(await run(null, () => api.deleteCase(c.id), "Gagal menghapus")).ok) return;
      await api.remove(c.photos.map(p => p.src)).catch(() => {});
      D.cases = D.cases.filter(x => x !== c); toast("Studi kasus dihapus"); renderView();
    }, b);
  }));
  bindOrder(body, D.cases, "case_studies", renderCases);
  flashId = null;
}
function openCase(id?: string) {
  const c = id ? D.cases.find(x => x.id === id) : undefined, tags = [...(c?.tags ?? [])];
  const photos: PendingPhoto[] = (c?.photos ?? []).map(p => ({ ...p })), files = new FileQueue();
  const ta = (fid: string, label: string, v: string | undefined, ph = "") => `<div class="field"><label for="${fid}">${label}</label><textarea id="${fid}" placeholder="${esc(ph)}">${esc(v)}</textarea></div>`;
  openDrawer(c ? "Edit studi kasus" : "Tambah studi kasus", `
    <div class="sec-t">Informasi utama</div>
    <div class="field" id="fwCsT"><label for="csT">Judul</label><input id="csT" value="${esc(c?.t)}" placeholder="mis. Raising Nickel Recovery in Atmospheric Leaching"><div class="err">Judul wajib diisi.</div></div>
    <div class="field"><label for="csC">Konteks</label><input id="csC" value="${esc(c?.ctx)}" placeholder="mis. Final research · Hydrometallurgy lab"></div>
    <div class="row2">
      <div class="field"><label for="csY">Tahun</label><input id="csY" type="number" inputmode="numeric" min="2000" max="2100" value="${esc(c?.y || new Date().getFullYear())}"></div>
      <div class="field"><label for="csIc">Ikon</label><div class="ic-pick"><span id="csIcPrev"></span><select id="csIc">${Object.entries(PROJECT_ICONS).map(([k, l]) => `<option value="${k}" ${(c?.ic || "flask") === k ? "selected" : ""}>${l}</option>`).join("")}</select></div></div>
    </div>
    <hr><div class="sec-t">Alur: tantangan → pendekatan → hasil</div>
    ${ta("csP", "Tantangan / masalah", c?.problem, "Masalah apa yang dihadapi? Sertakan angka bila ada.")}
    ${ta("csA", "Pendekatan / metode", c?.approach, "Apa yang Anda lakukan? Metode, alat, analisis.")}
    ${ta("csR", "Hasil", c?.result, "Apa hasilnya? Angka, rekomendasi, dampak.")}
    <div class="field"><label for="csTag">Tags / metode / alat</label><input id="csTag" placeholder="Ketik lalu tekan Enter"><div class="chips" id="csChips"></div></div>
    ${"<details class=\"tr-box\"><summary>Versi Bahasa Indonesia (opsional)</summary>"}
      <div class="field"><label for="csTId">Judul (ID)</label><input id="csTId" value="${esc(c?.tr?.t)}"></div>
      <div class="field"><label for="csCId">Konteks (ID)</label><input id="csCId" value="${esc(c?.tr?.ctx)}"></div>
      ${ta("csPId", "Tantangan (ID)", c?.tr?.problem)}${ta("csAId", "Pendekatan (ID)", c?.tr?.approach)}${ta("csRId", "Hasil (ID)", c?.tr?.result)}
    </details>
    <hr><div class="sec-t">Foto dokumentasi (opsional)</div><div id="csUp"></div>`);
  const chips = () => {
    $("#csChips").innerHTML = tags.map((t, i) => `<span class="chip">${esc(t)}<button type="button" data-i="${i}" aria-label="Hapus tag ${esc(t)}">${icon("x", 12)}</button></span>`).join("");
    $$("#csChips button").forEach(b => b.addEventListener("click", () => { tags.splice(+b.dataset.i!, 1); chips(); $("#csTag").focus(); }));
  }; chips();
  $("#csTag").addEventListener("keydown", e => {
    const k = (e as KeyboardEvent).key; if (k !== "Enter" && k !== ",") return; e.preventDefault();
    const inp = e.target as HTMLInputElement, v = inp.value.trim(); if (v && !tags.includes(v)) { tags.push(v); chips(); } inp.value = "";
  });
  const icp = () => { $("#csIcPrev").innerHTML = icon(($("#csIc") as HTMLSelectElement).value, 18); }; $("#csIc").addEventListener("change", icp); icp();
  photoUploader($("#csUp"), photos, 6, files, "Tampil sebagai deretan foto di bawah kartu studi kasus.");
  onSave = async () => {
    if (!required("csT", "fwCsT")) return false;
    const pend = val("csTag"); if (pend && !tags.includes(pend)) tags.push(pend);
    const y = parseInt(val("csY"), 10), cid = c?.id ?? uid("cs");
    const next: CaseStudy = { id: cid, t: val("csT"), ctx: val("csC"), y: Number.isFinite(y) ? y : "", ic: val("csIc"), tags,
      problem: val("csP"), approach: val("csA"), result: val("csR"), photos: await files.uploadPhotos(photos, `cases/${cid}`),
      tr: { t: val("csTId"), ctx: val("csCId"), problem: val("csPId"), approach: val("csAId"), result: val("csRId") } };
    await api.saveCase(next, c ? D.cases.indexOf(c) : D.cases.length);
    if (c) Object.assign(c, next); else D.cases.push(next);
    await files.cleanup(); flashId = cid; toast(SAVED); return true;
  };
}

/* ===================== PUBLIKASI ===================== */
const PUB_KINDS = ["Journal", "Conference", "Proceeding", "Article", "Thesis", "Book chapter", "Blog"];
function renderPubs() {
  root().innerHTML = `<div class="panel"><div class="panel-h"><span class="help nomargin">Urutan di sini = urutan di website (disarankan terbaru di atas). Bagian “Publications” disembunyikan bila kosong.</span></div>
    <div class="table-wrap"><table><thead><tr><th>Judul</th><th class="hide-m">Jenis</th><th class="hide-m">Tahun</th><th>Aksi</th></tr></thead><tbody id="pbBody">
    ${D.pubs.map((p, i) => `<tr class="${p.id === flashId ? "flash" : ""}">
      <td><div class="ttl"><div><b>${esc(p.t)}</b><small>${esc([p.authors, p.venue].filter(Boolean).join(" · ") || "—")}${safeUrl(p.link) ? ` · <span class="ok-t">${icon("check", 12)} link</span>` : ""}</small></div></div></td>
      <td class="hide-m"><span class="pill">${esc(p.kind || "—")}</span></td>
      <td class="hide-m nowrap">${esc(p.y || "—")}</td>
      <td><div class="acts">${orderBtns(p.id, i, D.pubs.length)}<button class="btn icon" data-ed="${esc(p.id)}" aria-label="Edit ${esc(p.t)}">${icon("pencil", 15)}</button><button class="btn icon danger" data-del="${esc(p.id)}" aria-label="Hapus ${esc(p.t)}">${icon("trash", 15)}</button></div></td></tr>`).join("") || `<tr><td colspan="4" class="empty">Belum ada publikasi — bagian ini tidak tampil di website.</td></tr>`}</tbody></table></div></div>`;
  kpis([["Total publikasi", D.pubs.length], ["Dengan link", D.pubs.filter(p => safeUrl(p.link)).length], ["Dengan abstrak", D.pubs.filter(p => p.abs).length], ["Masih contoh", D.pubs.filter(p => /\(example\)/.test(p.t)).length]]);
  const body = $("#pbBody");
  $$("[data-ed]", body).forEach(b => b.addEventListener("click", () => openPub(b.dataset.ed)));
  $$("[data-del]", body).forEach(b => b.addEventListener("click", () => {
    const p = D.pubs.find(x => x.id === b.dataset.del)!;
    askConfirm("Hapus publikasi?", `“${p.t}” akan dihapus.`, "Hapus", async () => {
      if (!(await run(null, () => api.deletePub(p.id), "Gagal menghapus")).ok) return;
      D.pubs = D.pubs.filter(x => x !== p); toast("Publikasi dihapus"); renderView();
    }, b);
  }));
  bindOrder(body, D.pubs, "publications", renderPubs);
  flashId = null;
}
function openPub(id?: string) {
  const p = id ? D.pubs.find(x => x.id === id) : undefined;
  const kinds = [...new Set([...PUB_KINDS, ...(p?.kind ? [p.kind] : [])])];
  openDrawer(p ? "Edit publikasi" : "Tambah publikasi", `
    <div class="field" id="fwPbT"><label for="pbT">Judul</label><input id="pbT" value="${esc(p?.t)}" placeholder="Judul lengkap makalah / artikel"><div class="err">Judul wajib diisi.</div></div>
    <div class="field"><label for="pbA">Penulis</label><input id="pbA" value="${esc(p?.authors)}" placeholder="mis. I. Ghibran, A. Pembimbing"></div>
    <div class="field"><label for="pbV">Jurnal / konferensi / media</label><input id="pbV" value="${esc(p?.venue)}" placeholder="mis. Jurnal Teknologi Mineral, Vol. 5 No. 2"></div>
    <div class="row2">
      <div class="field"><label for="pbK">Jenis</label><select id="pbK">${kinds.map(k => `<option ${(p?.kind || "Journal") === k ? "selected" : ""}>${esc(k)}</option>`).join("")}</select></div>
      <div class="field"><label for="pbY">Tahun</label><input id="pbY" inputmode="numeric" value="${esc(p?.y || new Date().getFullYear())}"></div>
    </div>
    <div class="field" id="fwPbL"><label for="pbL">Link (DOI / jurnal, opsional)</label><input id="pbL" type="url" value="${esc(p?.link)}" placeholder="https://doi.org/…"><div class="err">Harus diawali https://</div></div>
    <div class="field"><label for="pbAbs">Abstrak (opsional)</label><textarea id="pbAbs" placeholder="Bisa dibuka pengunjung lewat tombol “Abstract”.">${esc(p?.abs)}</textarea></div>`);
  onSave = async () => {
    if (!required("pbT", "fwPbT")) return false;
    const link = val("pbL"); $("#fwPbL").classList.toggle("invalid", !isHttps(link)); if (!isHttps(link)) { $("#pbL").focus(); return false; }
    const pid = p?.id ?? uid("pb");
    const next: Publication = { id: pid, t: val("pbT"), authors: val("pbA"), venue: val("pbV"), kind: val("pbK"), y: val("pbY"), link, abs: val("pbAbs") };
    await api.savePub(next, p ? D.pubs.indexOf(p) : 0);
    if (p) Object.assign(p, next); else { D.pubs.unshift(next); await api.reorder("publications", D.pubs.map(x => x.id)); }
    flashId = pid; toast(SAVED); return true;
  };
}

/* ===================== CERTIFICATES ===================== */
function renderCerts() {
  root().innerHTML = `<div class="cert-grid" id="cGrid">${D.certs.map((c, i) => `<div class="c-card ${c.id === flashId ? "flash" : ""}">
    <div class="c-img">${safeSrc(c.img) ? `<img src="${esc(c.img)}" alt="">` : `<span>${icon("image", 22)}Belum ada gambar</span>`}</div>
    <div class="c-body"><b>${esc(c.t)}</b><small>${esc([c.o, c.y].filter(Boolean).join(" · ") || "—")}</small>${safeUrl(c.link) ? `<small class="ok-t">${icon("check", 12)} link verifikasi</small>` : ""}</div>
    <div class="acts">${orderBtns(c.id, i, D.certs.length)}<button class="btn icon" data-ed="${esc(c.id)}" aria-label="Edit ${esc(c.t)}">${icon("pencil", 15)}</button><button class="btn icon danger" data-del="${esc(c.id)}" aria-label="Hapus ${esc(c.t)}">${icon("trash", 15)}</button></div>
  </div>`).join("") || `<div class="panel empty">Belum ada sertifikat.</div>`}</div>`;
  kpis([["Total sertifikat", D.certs.length], ["Dengan gambar", D.certs.filter(c => safeSrc(c.img)).length], ["Dengan link", D.certs.filter(c => safeUrl(c.link)).length], ["Masih contoh", D.certs.filter(c => /^Certificate name/.test(c.t)).length]]);
  const g = $("#cGrid");
  $$("[data-ed]", g).forEach(b => b.addEventListener("click", () => openCert(b.dataset.ed)));
  $$("[data-del]", g).forEach(b => b.addEventListener("click", () => {
    const c = D.certs.find(x => x.id === b.dataset.del)!;
    askConfirm("Hapus sertifikat?", `“${c.t}” akan dihapus.`, "Hapus", async () => {
      if (!(await run(null, () => api.deleteCert(c.id), "Gagal menghapus")).ok) return;
      await api.remove([c.img]).catch(() => {});
      D.certs = D.certs.filter(x => x !== c); toast("Sertifikat dihapus"); renderView();
    }, b);
  }));
  bindOrder(g, D.certs, "certificates", renderCerts);
  flashId = null;
}
function openCert(id?: string) {
  const c = id ? D.certs.find(x => x.id === id) : undefined, files = new FileQueue();
  let img: { src: string; file?: Blob; ext?: string } = { src: c?.img ?? "" };
  openDrawer(c ? "Edit sertifikat" : "Tambah sertifikat", `
    <div class="field" id="fwCt"><label for="ctT">Nama sertifikat</label><input id="ctT" value="${esc(c?.t)}" placeholder="mis. Cisco CCNA: Introduction to Networks"><div class="err">Nama wajib diisi.</div></div>
    <div class="row2"><div class="field"><label for="ctO">Penerbit</label><input id="ctO" value="${esc(c?.o)}" placeholder="mis. Cisco Networking Academy"></div>
      <div class="field"><label for="ctY">Tahun</label><input id="ctY" value="${esc(c?.y)}" inputmode="numeric" placeholder="2025"></div></div>
    <div class="field" id="fwCl"><label for="ctL">Link verifikasi (opsional)</label><input id="ctL" type="url" value="${esc(c?.link)}" placeholder="https://"><div class="err">Harus diawali https://</div></div>
    <hr><div class="sec-t">Gambar sertifikat</div>
    <div class="cert-up"><div class="c-img" id="ctPrev"></div>
      <div><label class="btn" tabindex="0" id="ctLbl">${icon("upload", 16)}Pilih gambar<input type="file" id="ctFile" accept="image/png,image/jpeg,image/webp" hidden></label>
      <button type="button" class="btn danger" id="ctDel">${icon("trash", 16)}Hapus</button><p class="help">Untuk sertifikat PDF: screenshot halaman pertama lalu upload sebagai gambar.</p></div></div>`);
  const draw = () => { $("#ctPrev").innerHTML = img.src ? `<img src="${esc(img.src)}" alt="">` : `<span>${icon("image", 22)}Belum ada</span>`; $("#ctDel").hidden = !img.src; };
  draw(); keyClick($("#ctLbl"), $("#ctFile") as HTMLInputElement);
  $("#ctFile").addEventListener("change", async e => {
    const inp = e.target as HTMLInputElement, f = inp.files?.[0]; inp.value = ""; if (!f) return;
    try { const r = await compressImage(f, 1600, .82); files.drop(img.file ? undefined : img.src); img = { src: preview(r.blob), file: r.blob, ext: r.ext }; draw(); } catch (err: any) { toast(err.message, true); }
  });
  $("#ctDel").addEventListener("click", () => { files.drop(img.file ? undefined : img.src); img = { src: "" }; draw(); });
  onSave = async () => {
    if (!required("ctT", "fwCt")) return false;
    const link = val("ctL"); $("#fwCl").classList.toggle("invalid", !isHttps(link)); if (!isHttps(link)) { $("#ctL").focus(); return false; }
    const cid = c?.id ?? uid("c");
    const next: Certificate = { id: cid, t: val("ctT"), o: val("ctO"), y: val("ctY"), link, img: img.file ? await api.upload(img.file, `certs/${cid}`, img.ext!) : img.src };
    await api.saveCert(next, c ? D.certs.indexOf(c) : D.certs.length);
    if (c) Object.assign(c, next); else D.certs.push(next);
    await files.cleanup(); flashId = cid; toast(SAVED); return true;
  };
}

/* ===================== LOG AKTIVITAS ===================== */
const ENTITY: Record<string, string> = { messages: "pesan dari", projects: "project", case_studies: "studi kasus", publications: "publikasi", experiences: "pengalaman", certificates: "sertifikat", skills: "skill", skill_categories: "kategori skill", profile: "profil", auth: "akun" };
const ACTION: Record<string, [string, string]> = {
  insert: ["Menambah", "plus"], update: ["Mengubah", "pencil"], delete: ["Menghapus", "trash"], reorder: ["Mengubah urutan", "swap"],
  login: ["Masuk ke panel admin", "logIn"], logout: ["Keluar dari panel admin", "logout"], logout_all: ["Keluar dari semua perangkat", "shield"], password: ["Mengganti password", "lock"],
};
const fmtTime = (iso: string) => {
  const d = new Date(iso), diff = (Date.now() - d.getTime()) / 1000;
  const rel = diff < 60 ? "baru saja" : diff < 3600 ? `${Math.floor(diff / 60)} menit lalu` : diff < 86400 ? `${Math.floor(diff / 3600)} jam lalu` : d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  return { rel, abs: d.toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short" }), day: d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) };
};
function actText(r: ActivityRow) {
  const [verb] = ACTION[r.action] ?? [r.action];
  if (r.entity === "auth") return esc(verb);
  if (r.action === "reorder") return `${esc(verb)} ${esc(ENTITY[r.entity] ?? r.entity)}`;
  return `${esc(verb)} ${esc(ENTITY[r.entity] ?? r.entity)}${r.label ? ` <b>“${esc(r.label)}”</b>` : ""}`;
}
function actItem(r: ActivityRow) {
  const [, ic] = ACTION[r.action] ?? ["", "info"], t = fmtTime(r.created_at);
  return `<li class="act act-${esc(r.action)}"><span class="act-ic">${icon(ic, 15)}</span><span class="act-txt">${actText(r)}<small>${esc(r.actor)} · <time datetime="${esc(r.created_at)}" title="${esc(t.abs)}">${esc(t.rel)}</time></small></span></li>`;
}
/* ===================== STATISTIK PENGUNJUNG ===================== */
let statDays = 30;
const SECTION_NAMES: Record<string, string> = { hero: "Beranda (atas)", about: "About", skills: "Skills", experience: "Experience", projects: "Projects", cases: "Studi kasus", publications: "Publikasi", certificates: "Certificates", contact: "Contact" };
const ACTION_NAMES: Record<string, string> = { cv: "Unduh / buka CV", pdf: "Unduh portfolio PDF", linkedin: "Buka LinkedIn", github: "Buka GitHub", email: "Salin email", contact: "Kirim pesan" };
const DEVICE_NAMES: Record<string, string> = { mobile: "HP", desktop: "Komputer / laptop", tablet: "Tablet" };
const flag = (c: string) => /^[A-Z]{2}$/.test(c) ? String.fromCodePoint(...[...c].map(ch => 0x1f1a5 + ch.charCodeAt(0))) : "🌐";
const countryName = (c: string) => { try { return new Intl.DisplayNames(["id"], { type: "region" }).of(c) ?? c; } catch { return c; } };
const fmtN = (n: number) => n.toLocaleString("id-ID");
function change(now: number, prev: number) {
  if (!prev) return now ? `<small class="chg up">baru</small>` : "";
  const d = Math.round((now - prev) / prev * 100);
  return `<small class="chg ${d > 0 ? "up" : d < 0 ? "down" : ""}">${d > 0 ? "▲" : d < 0 ? "▼" : "="} ${Math.abs(d)}%</small>`;
}
function barList(rows: Stat[], label: (k: string) => string, opts: { total?: number; empty?: string } = {}) {
  if (!rows.length) return `<p class="help">${opts.empty ?? "Belum ada data."}</p>`;
  const max = Math.max(...rows.map(r => r.n), 1);
  return `<ul class="bars">${rows.map(r => `<li><span class="bar" style="width:${Math.max(2, r.n / max * 100).toFixed(1)}%"></span>
    <span class="bar-k">${label(r.k)}</span><b>${fmtN(r.n)}${opts.total ? `<small>${Math.round(r.n / opts.total * 100)}%</small>` : ""}</b></li>`).join("")}</ul>`;
}
function chart(daily: AnalyticsSummary["daily"]) {
  const max = Math.max(...daily.map(d => d.visitors), 1), step = Math.ceil(daily.length / (innerWidth < 640 ? 4 : 7));
  const showX = (i: number) => i % step === 0 || (i === daily.length - 1 && i % step >= step / 2);
  const fmtD = (d: string, long = false) => new Date(d + "T00:00:00").toLocaleDateString("id-ID", long ? { weekday: "long", day: "numeric", month: "long" } : { day: "numeric", month: "short" });
  return `<div class="chart" role="img" aria-label="Grafik pengunjung harian">
    <div class="chart-y" aria-hidden="true"><span>${fmtN(max)}</span><span>${fmtN(Math.round(max / 2))}</span><span>0</span></div>
    <div class="chart-plot">${daily.map((d, i) => `<div class="col" tabindex="0" title="${esc(fmtD(d.d, true))}: ${d.visitors} pengunjung, ${d.views} kunjungan">
      <span class="col-bar" style="height:${(d.visitors / max * 100).toFixed(1)}%"></span>
      <span class="col-tip">${esc(fmtD(d.d))}<b>${d.visitors}</b></span>
      ${showX(i) ? `<span class="col-x">${esc(fmtD(d.d))}</span>` : ""}</div>`).join("")}</div></div>`;
}
function renderStats() {
  kpis([["Pengunjung unik", "…"], ["Kunjungan halaman", "…"], ["Unduh CV & PDF", "…"], ["Pesan terkirim", "…"]]);
  let mine = false; try { mine = localStorage.getItem("pf-no-track") === "1"; } catch { /* abaikan */ }
  root().innerHTML = `<div class="stats">
    <div class="panel pad"><div class="act-head"><h2 class="ph2 nomargin">Pengunjung per hari</h2><div class="filters" id="statFilters" role="group" aria-label="Rentang waktu"></div></div>
      <div id="statChart"><div class="loading"><span class="spin"></span>Menghitung…</div></div></div>
    <div class="stat-grid" id="statGrid"></div>
    <div class="panel pad"><h2 class="ph2">Privasi & pengaturan</h2>
      <p class="help">Tanpa cookie dan tanpa banner persetujuan. IP pengunjung tidak disimpan — pengunjung unik dihitung dari kode acak yang berganti setiap hari. Bot & kunjungan dari <i>localhost</i> tidak dihitung. Data disimpan 13 bulan.</p>
      <p class="help">${mine ? "✓ Kunjungan dari <b>browser ini</b> tidak dihitung (karena dipakai login admin), supaya angka tidak tercampur kunjungan Anda sendiri." : "Kunjungan dari browser ini <b>ikut dihitung</b>."}</p>
      <p class="help">Tips: bagikan link dengan <code>?ref=linkedin</code>, <code>?ref=cv</code>, atau <code>?ref=whatsapp</code> agar sumber kunjungan tercatat lebih tepat (misalnya link di CV PDF yang tidak punya referrer).</p>
      <div class="btn-row"><button class="btn sm" id="statMine">${mine ? "Hitung juga kunjungan browser ini" : "Jangan hitung browser ini"}</button></div></div>
  </div>`;
  $("#statMine").addEventListener("click", () => {
    try { localStorage.setItem("pf-no-track", mine ? "0" : "1"); } catch { /* abaikan */ }
    toast(mine ? "Kunjungan dari browser ini akan dihitung" : "Kunjungan dari browser ini tidak dihitung"); renderStats();
  });
  const load = () => {
    filters($("#statFilters"), ["7 hari", "30 hari", "90 hari"], `${statDays} hari`, c => { statDays = parseInt(c); load(); });
    $("#statChart").innerHTML = `<div class="loading"><span class="spin"></span>Menghitung…</div>`;
    api.analytics(statDays).then(a => {
      if (view !== "stats") return;
      const t = a.totals;
      $("#kpis").innerHTML = [["Pengunjung unik", fmtN(t.visitors), change(t.visitors, a.prev.visitors)], ["Kunjungan halaman", fmtN(t.views), change(t.views, a.prev.views)],
        ["Unduh CV & PDF", fmtN(t.cv + t.pdf), ""], ["Pesan terkirim", fmtN(t.contact), ""]]
        .map(([l, v, c]) => `<div class="kpi"><span>${esc(l)}</span><b>${esc(v)}${c}</b></div>`).join("");
      $("#statChart").innerHTML = t.views ? chart(a.daily) + `<p class="help mt">Dibanding ${statDays} hari sebelumnya. Arahkan / ketuk batang untuk melihat angka harian.</p>`
        : `<div class="empty">${icon("activity", 28)}<p>Belum ada kunjungan tercatat di rentang ini.<br>Statistik mulai terisi setelah website dikunjungi orang lain.</p></div>`;
      const vis = Math.max(t.visitors, 1);
      $("#statGrid").innerHTML = [
        ["Sumber kunjungan", "Dari mana pengunjung datang", barList(a.sources, k => esc(k), { total: vis })],
        ["Bagian yang dilihat", "Persentase pengunjung yang menggulir sampai bagian ini", barList([...a.sections].sort((x, y) => Object.keys(SECTION_NAMES).indexOf(x.k) - Object.keys(SECTION_NAMES).indexOf(y.k)), k => esc(SECTION_NAMES[k] ?? k), { total: vis })],
        ["Aksi pengunjung", "Klik penting di website", barList(a.actions, k => esc(ACTION_NAMES[k] ?? k), { empty: "Belum ada klik CV, PDF, LinkedIn, dll." })],
        ["Project paling sering dibuka", "Jumlah popup detail project dibuka", barList(a.projects, k => esc(k), { empty: "Belum ada project yang dibuka." })],
        ["Perangkat", "Jenis perangkat pengunjung", barList(a.devices, k => esc(DEVICE_NAMES[k] ?? k), { total: vis })],
        ["Negara", "Perkiraan lokasi dari jaringan", barList(a.countries, k => `${flag(k)} ${esc(countryName(k))}`, { total: vis })],
      ].map(([h, sub, body]) => `<div class="panel pad"><h2 class="ph2">${h}</h2><p class="help nomargin">${sub}</p>${body}</div>`).join("");
    }).catch(e => { $("#statChart").innerHTML = `<div class="empty">Statistik tidak bisa dimuat: ${esc(e?.message || e)}</div>`; });
  };
  load();
}

/* ===================== PESAN MASUK ===================== */
let msgFilter = "Semua", openMsg: number | null = null;
function setUnread(n: number) {
  const t = n > 99 ? "99+" : String(n);
  for (const id of ["#nMsg", "#nMsgS"]) { const el = $(id); if (el) { el.textContent = n ? t : ""; el.hidden = !n; } }
  const dot = $("#nMsgM"); if (dot) dot.hidden = !n;
}
function refreshUnread() { api.unreadMessages().then(setUnread).catch(() => {}); }
/* cek pesan baru tiap 2 menit selama tab admin terbuka */
setInterval(() => { if (api && D && document.visibilityState === "visible") refreshUnread(); }, 120000);
document.addEventListener("visibilitychange", () => { if (api && D && document.visibilityState === "visible") refreshUnread(); });

function renderMessages() {
  kpis([["Total pesan", "…"], ["Belum dibaca", "…"], ["7 hari terakhir", "…"], ["Batas anti-spam", "3 / 10 mnt"]]);
  root().innerHTML = `<div class="panel pad"><div class="act-head"><div class="filters" id="msgFilters" role="group" aria-label="Filter pesan"></div>
    <button class="btn sm" id="msgAllRead" hidden>${icon("check", 14)}Tandai semua dibaca</button></div>
    <div id="msgBody"><div class="loading"><span class="spin"></span>Memuat pesan…</div></div></div>`;
  let rows: MessageRow[] = [];
  const draw = () => {
    const unread = rows.filter(m => !m.read).length; setUnread(unread);
    kpis([["Total pesan", rows.length], ["Belum dibaca", unread], ["7 hari terakhir", rows.filter(m => Date.now() - +new Date(m.created_at) < 7 * 864e5).length], ["Batas anti-spam", "3 / 10 mnt"]]);
    filters($("#msgFilters"), ["Semua", "Belum dibaca"], msgFilter, c => { msgFilter = c; draw(); });
    $("#msgAllRead").hidden = !unread;
    const list = rows.filter(m => msgFilter === "Semua" || !m.read);
    $("#msgBody").innerHTML = list.length ? `<ul class="msgs">${list.map(m => {
      const t = fmtTime(m.created_at), open = openMsg === m.id;
      const quote = m.message.replace(/\n/g, "\n> ");
      const reply = `mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent("Re: Pesan dari website portofolio")}&body=${encodeURIComponent(`\n\n---\nPada ${t.abs}, ${m.name} menulis:\n> ${quote}`)}`;
      return `<li class="msg${m.read ? "" : " unread"}${open ? " open" : ""}" data-id="${m.id}">
        <button class="msg-h" aria-expanded="${open}"><span class="msg-dot" aria-hidden="true"></span>
          <span class="msg-who"><b>${esc(m.name)}</b><small>${esc(m.email)}</small></span>
          <time datetime="${esc(m.created_at)}" title="${esc(t.abs)}">${esc(t.rel)}</time>
          <span class="msg-prev">${esc(m.message)}</span></button>
        <div class="msg-b">
          <p class="msg-text">${esc(m.message)}</p>
          <div class="btn-row">
            <a class="btn dark sm" href="${esc(reply)}">${icon("mail", 14)}Balas via email</a>
            <button class="btn sm" data-copy>${icon("copy", 14)}Salin email</button>
            <button class="btn sm" data-toggle>${icon(m.read ? "mail" : "check", 14)}${m.read ? "Tandai belum dibaca" : "Tandai dibaca"}</button>
            <button class="btn sm danger" data-del>${icon("trash", 14)}Hapus</button>
          </div>
        </div></li>`;
    }).join("")}</ul>` : `<div class="empty">${icon("inbox", 28)}<p>${rows.length ? "Semua pesan sudah dibaca." : "Belum ada pesan.<br>Pesan dari formulir <b>Contact</b> di website akan muncul di sini."}</p></div>`;

    $$(".msg", $("#msgBody")).forEach(li => {
      const id = Number(li.dataset.id), m = rows.find(x => x.id === id)!;
      $(".msg-h", li).addEventListener("click", () => {
        openMsg = openMsg === id ? null : id;
        if (openMsg === id && !m.read) { m.read = true; api.setMessageRead([id], true).catch(() => { m.read = false; draw(); }); }
        draw();
      });
      $("[data-toggle]", li).addEventListener("click", async e => {
        const r = await run(e.currentTarget as HTMLElement, () => api.setMessageRead([id], !m.read), "Gagal mengubah status");
        if (r.ok) { m.read = !m.read; if (!m.read) openMsg = null; draw(); }
      });
      $("[data-copy]", li).addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(m.email); toast("Email disalin"); } catch { toast(m.email); }
      });
      $("[data-del]", li).addEventListener("click", e => askConfirm("Hapus pesan?", `Pesan dari ${m.name} akan dihapus permanen.`, "Hapus", async () => {
        const r = await run(null, () => api.deleteMessage(id), "Gagal menghapus");
        if (r.ok) { rows = rows.filter(x => x.id !== id); if (openMsg === id) openMsg = null; toast("Pesan dihapus"); draw(); }
      }, e.currentTarget as HTMLElement));
    });
    if (openMsg) $(`.msg[data-id="${openMsg}"]`)?.scrollIntoView({ block: "nearest" });
  };
  $("#msgAllRead").addEventListener("click", async e => {
    const ids = rows.filter(m => !m.read).map(m => m.id);
    const r = await run(e.currentTarget as HTMLElement, () => api.setMessageRead(ids, true), "Gagal mengubah status");
    if (r.ok) { rows.forEach(m => { m.read = true; }); toast("Semua pesan ditandai dibaca"); draw(); }
  });
  api.listMessages().then(r => {
    rows = r;
    if (openMsg) { const m = rows.find(x => x.id === openMsg); if (m && !m.read) { m.read = true; api.setMessageRead([m.id], true).catch(() => {}); } }
    draw();
  }).catch(e => { $("#msgBody").innerHTML = `<div class="empty">Pesan tidak bisa dimuat: ${esc(e?.message || e)}</div>`; });
}

let actFilter = "Semua";
function renderActivity() {
  kpis([["Ditampilkan", "…"], ["Perubahan konten", "…"], ["Login", "…"], ["Bisa diubah?", "Tidak"]]);
  root().innerHTML = `<div class="panel pad"><div class="act-head"><div class="filters" id="actFilters" role="group" aria-label="Filter aktivitas"></div>
    <span class="help nomargin">Dicatat otomatis oleh database · tidak bisa diubah atau dihapus</span></div>
    <div id="actBody"><div class="loading"><span class="spin"></span>Memuat log…</div></div>
    <div class="center mt"><button class="btn" id="actMore" hidden>Muat lebih banyak</button></div></div>`;
  let rows: ActivityRow[] = [], done = false;
  const draw = () => {
    filters($("#actFilters"), ["Semua", "Konten", "Login & keamanan"], actFilter, c => { actFilter = c; draw(); });
    const list = rows.filter(r => actFilter === "Semua" || (actFilter === "Konten" ? r.entity !== "auth" : r.entity === "auth"));
    let html = "", day = "";
    for (const r of list) {
      const d = fmtTime(r.created_at).day;
      if (d !== day) { if (day) html += `</ul>`; html += `<h3 class="act-day">${esc(d)}</h3><ul class="act-list">`; day = d; }
      html += actItem(r);
    }
    $("#actBody").innerHTML = list.length ? html + "</ul>" : `<p class="empty">Belum ada aktivitas${actFilter !== "Semua" ? " untuk filter ini" : ""}.</p>`;
    $("#actMore").hidden = done;
    kpis([["Ditampilkan", rows.length], ["Perubahan konten", rows.filter(r => r.entity !== "auth").length], ["Login", rows.filter(r => r.action === "login").length], ["Bisa diubah?", "Tidak"]]);
  };
  const more = async () => {
    const r = await run($("#actMore"), () => api.listActivity(40, rows.at(-1)?.id), "Gagal memuat log");
    if (!r.ok) { if (!rows.length) $("#actBody").innerHTML = `<p class="empty">Log aktivitas tidak bisa dimuat.</p>`; return; }
    rows = rows.concat(r.v); done = r.v.length < 40; draw();
  };
  $("#actMore").addEventListener("click", more);
  draw(); more();
}

/* ===================== AKUN & KEAMANAN ===================== */
function strength(pw: string) {
  let n = 0;
  if (pw.length >= 8) n++;
  if (pw.length >= 12) n++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) n++;
  if (/\d/.test(pw)) n++;
  if (/[^A-Za-z0-9]/.test(pw)) n++;
  return Math.min(4, n);
}
function renderAccount() {
  kpis([]);
  const email = $("#meEmail").textContent || "";
  const pwField = (id: string, label: string, ac: string, help = "") => `<div class="field" id="w-${id}"><label for="${id}">${label}</label>
    <div class="pw-wrap"><input id="${id}" type="password" autocomplete="${ac}"><button type="button" class="pw-eye" data-eye="${id}" aria-label="Tampilkan password">${icon("eye", 18)}</button></div>
    ${help ? `<div class="help">${help}</div>` : ""}<div class="err" id="e-${id}"></div></div>`;
  root().innerHTML = `<div class="account">
    <div class="panel pad"><h2 class="ph2">Akun</h2>
      <dl class="acc-dl"><dt>Email login</dt><dd>${esc(email)}</dd><dt>Peran</dt><dd>Administrator portofolio</dd><dt>Mode</dt><dd>${api.mode === "supabase" ? "Supabase (produksi)" : "Uji lokal"}</dd></dl></div>
    <form class="panel pad" id="pwForm" novalidate><h2 class="ph2">Ubah password</h2>
      <p class="help">Demi keamanan, masukkan password lama terlebih dahulu.</p>
      <input type="email" autocomplete="username" value="${esc(email)}" hidden>
      ${pwField("pwOld", "Password lama", "current-password")}
      ${pwField("pwNew", "Password baru", "new-password", "Minimal 8 karakter. Disarankan 12+ karakter campuran huruf besar-kecil, angka &amp; simbol.")}
      <div class="pw-meter" aria-hidden="true"><span></span><span></span><span></span><span></span></div><p class="help nomargin" id="pwStr">&nbsp;</p>
      ${pwField("pwNew2", "Ulangi password baru", "new-password")}
      <div class="btn-row"><button class="btn dark" id="pwSave">${icon("lock", 16)}Simpan password baru</button></div>
    </form>
    <div class="panel pad"><h2 class="ph2">Sesi login</h2>
      <p class="help">Gunakan <b>Keluar dari semua perangkat</b> jika Anda pernah login di HP/komputer lain (mis. komputer umum) atau curiga akun dipakai orang lain.</p>
      <div class="btn-row"><button class="btn" id="accLogout">${icon("logout", 16)}Keluar</button><button class="btn danger" id="accLogoutAll">${icon("shield", 16)}Keluar dari semua perangkat</button></div></div>
  </div>`;
  $$("[data-eye]", root()).forEach(b => b.addEventListener("click", () => {
    const inp = $(`#${b.dataset.eye}`) as HTMLInputElement, show = inp.type === "password";
    inp.type = show ? "text" : "password"; b.innerHTML = icon(show ? "eyeOff" : "eye", 18); b.setAttribute("aria-label", show ? "Sembunyikan password" : "Tampilkan password");
  }));
  const LABEL = ["Sangat lemah", "Lemah", "Cukup", "Kuat", "Sangat kuat"];
  $("#pwNew").addEventListener("input", () => {
    const v = ($("#pwNew") as HTMLInputElement).value, n = v ? strength(v) : -1;
    $$(".pw-meter span", root()).forEach((el, i) => { el.className = v && i < Math.max(1, n) ? `on s${Math.max(1, n)}` : ""; });
    $("#pwStr").textContent = v ? `Kekuatan: ${LABEL[Math.max(0, n)]}` : "\u00a0";
  });
  $("#accLogout").addEventListener("click", () => logout());
  $("#accLogoutAll").addEventListener("click", e => askConfirm("Keluar dari semua perangkat?", "Semua sesi login (HP, laptop, browser lain) akan diakhiri, termasuk sesi ini.", "Keluar semua", () => logout(true), e.currentTarget as HTMLElement));
  $("#pwForm").addEventListener("submit", async e => {
    e.preventDefault(); if (saving) return;
    const old = ($("#pwOld") as HTMLInputElement).value, nw = ($("#pwNew") as HTMLInputElement).value, nw2 = ($("#pwNew2") as HTMLInputElement).value;
    const errs: string[] = [];
    const check = (id: string, ok: boolean, msg: string) => { $(`#w-${id}`).classList.toggle("invalid", !ok); $(`#e-${id}`).textContent = ok ? "" : msg; if (!ok) errs.push(id); };
    check("pwOld", !!old, "Password lama wajib diisi.");
    check("pwNew", nw.length >= 8 && nw !== old, nw.length < 8 ? "Minimal 8 karakter." : "Password baru harus berbeda dari password lama.");
    check("pwNew2", nw2 === nw, "Tidak sama dengan password baru.");
    if (errs.length) return $(`#${errs[0]}`).focus();
    saving = true;
    let wrongOld = false;
    const r = await run($("#pwSave"), async () => {
      try { await api.changePassword(old, nw); }
      catch (err: any) { if (/lama salah/i.test(String(err?.message))) { wrongOld = true; return; } throw err; }
    }, "Gagal mengganti password");
    saving = false;
    if (wrongOld) { check("pwOld", false, "Password lama salah."); $("#pwOld").focus(); return; }
    if (r.ok) {
      ["pwOld", "pwNew", "pwNew2"].forEach(id => { ($(`#${id}`) as HTMLInputElement).value = ""; });
      $("#pwNew").dispatchEvent(new Event("input")); toast("Password berhasil diganti");
    }
  });
}

/* ===================== komponen form ===================== */
function required(inputId: string, fieldId: string) {
  const ok = !!val(inputId); $(`#${fieldId}`).classList.toggle("invalid", !ok);
  $(`#${inputId}`).toggleAttribute("aria-invalid", !ok); if (!ok) $(`#${inputId}`).focus(); return ok;
}
function keyClick(label: HTMLElement, input: HTMLInputElement) {
  label.addEventListener("keydown", e => { const k = (e as KeyboardEvent).key; if (k === "Enter" || k === " ") { e.preventDefault(); input.click(); } });
}
function dropzone(zone: HTMLElement, input: HTMLInputElement, onFiles: (f: File[]) => void) {
  keyClick(zone, input);
  input.addEventListener("change", () => { onFiles([...(input.files ?? [])]); input.value = ""; });
  ["dragenter", "dragover"].forEach(t => zone.addEventListener(t, e => { e.preventDefault(); zone.classList.add("drag"); }));
  ["dragleave", "drop"].forEach(t => zone.addEventListener(t, e => { e.preventDefault(); zone.classList.remove("drag"); }));
  zone.addEventListener("drop", e => onFiles([...((e as DragEvent).dataTransfer?.files ?? [])]));
}
/** uploader foto (project & experience): array `photos` diubah langsung; file baru diupload saat simpan */
function photoUploader(box: HTMLElement, photos: PendingPhoto[], max: number, files: FileQueue, note: string) {
  for (let i = photos.length - 1; i >= 0; i--) if (isSamplePhoto(photos[i].src)) photos.splice(i, 1);   // foto contoh mockup tidak dibawa
  box.innerHTML = `<label class="drop" tabindex="0"><input type="file" accept="image/png,image/jpeg,image/webp" multiple hidden>
      ${icon("upload", 22)}<b>Klik atau seret foto ke sini</b><small>PNG/JPG/WebP · maks ${max} foto · otomatis diperkecil</small></label>
    <div class="ph-grid"></div><div class="help"></div>`;
  const grid = $(".ph-grid", box), help = $(".help", box);
  const draw = () => {
    grid.innerHTML = photos.map((p, i) => `<div class="ph-item"><div class="im"><img src="${esc(p.src)}" alt="">
      <button type="button" class="ph-del" data-i="${i}" aria-label="Hapus foto ${i + 1}">${icon("x", 14)}</button>
      ${i > 0 ? `<button type="button" class="ph-first" data-i="${i}">Jadikan utama</button>` : `<span class="ph-main">Utama</span>`}
      ${p.file ? `<span class="ph-sample">Baru</span>` : ""}</div>
      <input value="${esc(p.caption)}" data-cap="${i}" placeholder="Keterangan foto" aria-label="Keterangan foto ${i + 1}" maxlength="120"></div>`).join("");
    help.textContent = `${photos.length}/${max} foto. ${note} Foto baru diupload saat menekan “Simpan”.`;
    $$(".ph-del", grid).forEach(b => b.addEventListener("click", () => { const [p] = photos.splice(+b.dataset.i!, 1); if (!p.file) files.drop(p.src); draw(); }));
    $$(".ph-first", grid).forEach(b => b.addEventListener("click", () => { photos.unshift(...photos.splice(+b.dataset.i!, 1)); draw(); }));
    $$<HTMLInputElement>("[data-cap]", grid).forEach(inp => inp.addEventListener("input", () => { photos[+inp.dataset.cap!].caption = inp.value; }));
  }; draw();
  dropzone($(".drop", box), $("input[type=file]", box) as HTMLInputElement, async list => {
    const imgs = list.filter(f => /^image\//.test(f.type));
    if (!imgs.length) return toast("Pilih file gambar (PNG/JPG/WebP)", true);
    const room = max - photos.length; if (room <= 0) return toast(`Maksimal ${max} foto`, true);
    for (const f of imgs.slice(0, room)) {
      if (f.size > 20 * 1024 * 1024) { toast(`${f.name} lebih dari 20 MB`, true); continue; }
      try { const c = await compressImage(f, 1600, .8); photos.push({ src: preview(c.blob), file: c.blob, ext: c.ext, caption: f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ") }); }
      catch (err: any) { toast(err.message, true); }
    }
    if (imgs.length > room) toast(`Hanya ${room} foto pertama yang ditambahkan (maks ${max})`, true);
    draw();
  });
}

/* ===== drawer ===== */
let onSave: (() => Promise<boolean>) | null = null, lastFocus: HTMLElement | null = null;
function openDrawer(title: string, html: string) {
  lastFocus = document.activeElement as HTMLElement; $("#dTitle").textContent = title; $("#dForm").innerHTML = html; $("#dForm").scrollTop = 0;
  $("#drawer").classList.add("open"); $("#overlay").classList.add("open"); document.body.style.overflow = "hidden";
  setTimeout(() => ($("#dForm").querySelector("input:not([type=radio]):not([type=file]):not([type=checkbox]),select") as HTMLElement | null)?.focus(), 320);
}
function closeDrawer() {
  if (!$("#drawer").classList.contains("open")) return;
  $("#drawer").classList.remove("open"); $("#overlay").classList.remove("open"); document.body.style.overflow = ""; onSave = null;
  lastFocus?.isConnected ? lastFocus.focus() : $("#addBtn").focus();
}
[$("#dClose"), $("#dCancel"), $("#overlay")].forEach(el => el.addEventListener("click", closeDrawer));
let saving = false;   // cegah simpan ganda (klik/Enter berulang saat upload lambat)
$("#dForm").addEventListener("submit", async e => {
  e.preventDefault(); if (!onSave || saving) return;
  saving = true;
  try { const r = await run($("#dSave"), onSave); if (r.ok && r.v) { closeDrawer(); renderView(); } }
  finally { saving = false; }
});

/* ===== dialog konfirmasi ===== */
let onConfirm: (() => void) | null = null, confirmFrom: HTMLElement | null = null;
function askConfirm(title: string, text: string, yes: string, fn: () => void, from?: HTMLElement) {
  onConfirm = fn; confirmFrom = from ?? null; $("#cTitle").textContent = title; $("#cText").textContent = text + " Tindakan ini tidak bisa dibatalkan."; $("#cYes").textContent = yes;
  $("#confirm").classList.add("open"); setTimeout(() => $("#cNo").focus(), 50);
}
function closeConfirm() { $("#confirm").classList.remove("open"); const f = confirmFrom; confirmFrom = null; f?.isConnected ? f.focus() : ($("#drawer").classList.contains("open") ? $("#dClose") : $("#addBtn")).focus(); }
$("#cNo").addEventListener("click", closeConfirm);
$("#confirm").addEventListener("click", e => { if ((e.target as HTMLElement).id === "confirm") closeConfirm(); });
$("#cYes").addEventListener("click", () => { const fn = onConfirm; onConfirm = null; closeConfirm(); fn?.(); });

/* keyboard: Esc & kunci Tab di dialog */
addEventListener("keydown", e => {
  if (e.key === "Escape") { if ($("#confirm").classList.contains("open")) closeConfirm(); else if ($("#sheet").classList.contains("open")) { closeSheet(); $("#moreBtn").focus(); } else closeDrawer(); }
  const box = $("#confirm").classList.contains("open") ? $("#confirm") : $("#drawer").classList.contains("open") ? $("#drawer") : $("#sheet").classList.contains("open") ? $("#sheet") : null;
  if (e.key === "Tab" && box) {
    const f = $$("button,input:not([hidden]),select,textarea,a[href],[tabindex='0']", box).filter(x => !(x as HTMLButtonElement).disabled && x.offsetParent !== null);
    if (!f.length) return; const a = f[0], z = f[f.length - 1];
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  }
});

boot();
