/* =====================================================================
   Interaksi halaman utama (dibundel Astro). Konten sudah dirender server;
   skrip ini hanya menambah interaksi: tema, menu, animasi, filter, popup, lightbox.
   ===================================================================== */
import { initTheme, onThemeChange } from "./theme";
import { initLang, onLangChange, t } from "./lang";
import { iconSvg } from "../lib/icons";

const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector(s) as T | null;
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll(s)] as T[];
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fine = matchMedia("(hover:hover) and (pointer:fine)").matches;
const afterFonts = (fn: () => void) => { fn(); document.fonts?.ready.then(fn); };
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function toast(msg: string) {
  const t = $("#toast")!; t.innerHTML = iconSvg("check", 16) + esc(msg); t.classList.add("show");
  clearTimeout((t as any)._t); (t as any)._t = setTimeout(() => t.classList.remove("show"), 2000);
}

/* pratinjau yang mengikuti kursor (Projects & Skills): satu elemen position:fixed, posisi ditulis lewat translate3d
   dalam satu requestAnimationFrame dengan sedikit "pegas" (lerp) — tanpa getBoundingClientRect per gerakan mouse,
   tanpa transisi CSS pada posisi (yang membuat pratinjau tersendat), jadi tetap lancar. */
function follower(el: HTMLElement, above = false) {   // above: tampil di atas kursor (agar tidak menutupi judul kartu)
  let tx = 0, ty = 0, x = 0, y = 0, w = 0, h = 0, raf = 0, shown = false;
  const paint = () => { el.style.transform = `translate3d(${x}px,${y}px,0)`; };
  const step = () => {
    x += (tx - x) * .3; y += (ty - y) * .3; paint();
    raf = Math.abs(tx - x) + Math.abs(ty - y) > .4 ? requestAnimationFrame(step) : 0;
  };
  /* ukuran (tetap) dibaca saat browser senggang — bukan saat kursor pertama kali masuk */
  const size = () => { if (!w) { const r = el.firstElementChild!.getBoundingClientRect(); w = r.width; h = r.height; } };
  /* pemanasan: gambar kartu miring sekali (hampir transparan, 2 frame) saat senggang → kemunculan pertama tidak tersendat */
  const warm = () => { size(); if (shown) return; el.classList.add("warm"); requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove("warm"))); };
  ("requestIdleCallback" in window ? requestIdleCallback : setTimeout)(warm);
  const aim = (cx: number, cy: number) => {
    if (above) { tx = Math.max(8, Math.min(innerWidth - w - 8, cx - w / 2)); ty = cy - h - 24 < 8 ? cy + 28 : cy - h - 24; return; }
    tx = cx + 28 + w > innerWidth - 8 ? cx - 28 - w : cx + 28;
    ty = Math.max(8, Math.min(innerHeight - h - 8, cy - h / 2));
  };
  return {
    show(cx: number, cy: number) {
      size();
      aim(cx, cy); if (!shown) { x = tx; y = ty; paint(); }
      shown = true; el.classList.add("show");
    },
    move(cx: number, cy: number) { if (!shown) return this.show(cx, cy); aim(cx, cy); if (!raf) raf = requestAnimationFrame(step); },   // muncul lagi setelah disembunyikan saat scroll
    hide() { shown = false; el.classList.remove("show"); },
  };
}

/* ===== selalu buka dari atas (browser HP mengingat #hash/posisi terakhir) ===== */
if (location.hash) history.replaceState(null, "", location.pathname + location.search);
scrollTo(0, 0);
addEventListener("pageshow", e => { if ((e as PageTransitionEvent).persisted) scrollTo(0, 0); });

/* link menu: scroll halus tanpa menulis #hash ke URL */
document.addEventListener("click", e => {
  const a = (e.target as Element).closest('a[href^="#"]'); if (!a) return;
  const id = a.getAttribute("href")!.slice(1), t = id ? document.getElementById(id) : null; if (!t) return;
  e.preventDefault();
  if (id === "hero") scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  else t.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  if (!t.hasAttribute("tabindex")) t.setAttribute("tabindex", "-1");
  t.focus({ preventScroll: true });
});

/* ===== menu HP ===== */
const nav = $("#nav")!, links = $("#links")!, menuBtn = $("#menuBtn")!;
function setMenu(open: boolean) {
  links.classList.toggle("max-xl:hidden", !open);
  nav.classList.toggle("nav-scrolled", open || scrollY > 20);
  menuBtn.setAttribute("aria-expanded", String(open)); menuBtn.setAttribute("aria-label", t(open ? "nav.menuClose" : "nav.menuOpen"));
}
const menuOpen = () => !links.classList.contains("max-xl:hidden");
menuBtn.addEventListener("click", () => setMenu(!menuOpen()));
$$("a", links).forEach(a => a.addEventListener("click", () => setMenu(false)));
/* klik di luar navbar menutup menu (composedPath tetap akurat walau isi elemen berubah saat diklik) */
document.addEventListener("click", e => { if (menuOpen() && !e.composedPath().includes(nav)) setMenu(false); });
addEventListener("resize", () => { if (innerWidth >= 1280 && menuOpen()) setMenu(false); });
onLangChange(() => setMenu(menuOpen()));

/* ===== role bergilir ===== */
const rs = $("#roleSwap");
if (rs) {
  const items = $$("span", rs);
  afterFonts(() => {
    rs.style.width = "auto";
    const w = Math.max(...items.map(s => { s.style.display = "inline-block"; const v = s.getBoundingClientRect().width; s.style.display = ""; return v; }));
    rs.style.width = Math.ceil(w) + "px";
  });
  let ri = 0;
  if (!reduce && items.length > 1) setInterval(() => {
    if (document.hidden) return;
    ri = (ri + 1) % items.length; items.forEach(s => s.style.transform = `translateY(${-ri * 100}%)`);
  }, 2200);
}

/* ===== kisi kristal interaktif di hero (atom tersusun heksagonal; ikatan menyala di dekat kursor) =====
   Efisien: kisi samar digambar SEKALI ke canvas cadangan; tiap frame hanya menyalin gambar itu lalu menggambar
   atom & ikatan di sekitar kursor (puluhan, bukan ribuan garis). Animasi berhenti sendiri saat diam. */
const cv = $<HTMLCanvasElement>("#dots"), cx = cv?.getContext("2d");
if (cv && cx) {
  type Atom = { x: number; y: number; s: number; r: number; c: number };
  let W = 0, H = 0, dpr = 1, rows: Atom[][] = [], lit: Atom[] = [], m = { x: -1e4, y: -1e4 }, raf = 0, rgb = "77,0,17";
  const R = 170, base = document.createElement("canvas"), bx = base.getContext("2d")!;
  const readDot = () => { rgb = getComputedStyle(document.documentElement).getPropertyValue("--dot").trim() || "77,0,17"; };
  /* tetangga kanan & dua tetangga bawah (baris ganjil bergeser setengah jarak) */
  const nb = (a: Atom) => { const r = rows[a.r], n = rows[a.r + 1], o = a.r % 2; return [r[a.c + 1], n?.[a.c + o - 1], n?.[a.c + o]]; };
  const drawBase = () => {
    base.width = cv.width; base.height = cv.height; bx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bx.strokeStyle = `rgba(${rgb},.05)`; bx.lineWidth = .6; bx.beginPath();
    for (const r of rows) for (const a of r) for (const b of nb(a)) if (b) { bx.moveTo(a.x, a.y); bx.lineTo(b.x, b.y); }
    bx.stroke();
    bx.fillStyle = `rgba(${rgb},.18)`; bx.beginPath();
    for (const r of rows) for (const a of r) { bx.moveTo(a.x + 1.1, a.y); bx.arc(a.x, a.y, 1.1, 0, 6.283); }
    bx.fill();
  };
  const frame = () => {
    raf = 0; let active = false;
    /* atom yang sedang/masih menyala: dalam jangkauan kursor atau sedang meredup */
    const near: Atom[] = [];
    if (m.x > -1e3) {
      const g = rows[0]?.[1] ? rows[0][1].x - rows[0][0].x : 40, gy = rows[1] ? rows[1][0].y - rows[0][0].y : 35;
      const r0 = Math.max(0, Math.floor((m.y - R) / gy) - 1), r1 = Math.min(rows.length - 1, Math.ceil((m.y + R) / gy) + 1);
      for (let ri = r0; ri <= r1; ri++) { const r = rows[ri], c0 = Math.max(0, Math.floor((m.x - R) / g) - 1), c1 = Math.min(r.length - 1, Math.ceil((m.x + R) / g) + 1); for (let ci = c0; ci <= c1; ci++) near.push(r[ci]); }
    }
    const set = new Set([...lit, ...near]); lit = [];
    for (const a of set) {
      const d = Math.hypot(a.x - m.x, a.y - m.y), target = d < R ? 1 - d / R : 0; a.s += (target - a.s) * .14;
      if (Math.abs(target - a.s) > .01) active = true;
      if (a.s > .005) lit.push(a); else a.s = 0;
    }
    cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, cv.width, cv.height); cx.drawImage(base, 0, 0); cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const a of lit) for (const b of nb(a)) {
      if (!b) continue; const k = Math.min(a.s, b.s); if (k < .01) continue;
      cx.strokeStyle = `rgba(${rgb},${k * .55})`; cx.lineWidth = .6 + k; cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke();
    }
    for (const a of lit) { cx.fillStyle = `rgba(${rgb},${a.s * .7})`; cx.beginPath(); cx.arc(a.x, a.y, 1.1 + a.s * 3, 0, 6.283); cx.fill(); }
    if (active && !reduce) raf = requestAnimationFrame(frame);
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
  const setup = () => {
    const w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
    if (w === W && Math.abs(h - H) < 80 && rows.length) return;   // abaikan perubahan kecil (address bar HP)
    dpr = Math.min(devicePixelRatio || 1, 2); W = w; H = h; cv.width = W * dpr; cv.height = H * dpr;
    const g = parseFloat(getComputedStyle(document.documentElement).fontSize) * 2.4, gy = g * .866; rows = []; lit = [];
    for (let y = gy / 2, ri = 0; y < H + gy; y += gy, ri++) { const r: Atom[] = []; for (let x = (ri % 2) * g / 2, ci = 0; x < W + g; x += g, ci++) r.push({ x, y, s: 0, r: ri, c: ci }); rows.push(r); }
    drawBase(); frame();
  };
  readDot(); setup(); new ResizeObserver(setup).observe(cv);
  onThemeChange(() => { readDot(); drawBase(); frame(); });
  if (fine && !reduce) {
    const hero = $("#hero")!; let top = 0, left = 0;
    hero.addEventListener("pointerenter", () => { const r = cv.getBoundingClientRect(); top = r.top; left = r.left; });
    hero.addEventListener("pointermove", e => { m = { x: e.clientX - left, y: e.clientY - top }; kick(); });
    hero.addEventListener("pointerleave", () => { m = { x: -1e4, y: -1e4 }; kick(); });
    addEventListener("scroll", () => { if (m.x > -1e3) { const r = cv.getBoundingClientRect(); top = r.top; left = r.left; } }, { passive: true });
  }
}

/* foto miring mengikuti kursor + tombol magnetik (hanya perangkat dengan mouse) */
if (fine && !reduce) {
  /* rect dibaca sekali saat kursor masuk (bukan tiap gerakan) dan transform ditulis maksimal sekali per frame */
  const hoverFx = (el: HTMLElement, fx: (x: number, y: number, r: DOMRect) => string) => {
    let r: DOMRect | null = null, raf = 0, ex = 0, ey = 0;
    el.addEventListener("pointerenter", () => { el.style.transform = ""; r = el.getBoundingClientRect(); });
    el.addEventListener("pointermove", e => {
      ex = e.clientX; ey = e.clientY;
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (r) el.style.transform = fx((ex - r.left) / r.width - .5, (ey - r.top) / r.height - .5, r); });
    });
    el.addEventListener("pointerleave", () => { cancelAnimationFrame(raf); raf = 0; r = null; el.style.transform = ""; });
  };
  const pt = $("#portrait");
  if (pt) hoverFx(pt, (x, y) => `perspective(900px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg)`);
  $$(".magnetic").forEach(b => hoverFx(b, (x, y, r) => `translate(${x * r.width * .18}px,${y * r.height * .3}px)`));
}

/* ===== segmented tabs (pill bergeser) ===== */
function seg(el: HTMLElement, onPick: (v: string) => void) {
  const pill = $(".seg-pill", el)!, btns = $$<HTMLButtonElement>("button", el);
  const move = () => { const b = btns.find(x => x.getAttribute("aria-selected") === "true"); if (!b) return; pill.style.left = b.offsetLeft + "px"; pill.style.width = b.offsetWidth + "px"; };
  afterFonts(move); new ResizeObserver(move).observe(el); onLangChange(move);
  btns.forEach(b => b.addEventListener("click", () => {
    btns.forEach(x => x.setAttribute("aria-selected", String(x === b))); move();
    b.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduce ? "auto" : "smooth" });
    onPick(b.dataset.v!);
  }));
}

/* ===== roda skill: kartu kategori berputar sesuai jarak ke tengah, kartu tengah + indeksnya disorot ===== */
const wheel = $("#skillWheel");
if (wheel) {
  const cards = $$(".sk-card", wheel), idx = $$<HTMLButtonElement>("[data-skill-go]");
  let cur = -1, centers: number[] = [], half = 1;
  /* posisi layout (offsetTop) dibaca sekali — tidak terdistorsi rotasi kartu & tidak memaksa layout tiap scroll */
  const measure = () => { half = wheel.clientHeight / 2; centers = cards.map(c => c.offsetTop + c.offsetHeight / 2); };
  const paint = () => {
    const mid = wheel.scrollTop + half; let ci = 0, best = 1e9;
    cards.forEach((c, i) => {
      const o = (centers[i] - mid) / half, ao = Math.abs(o);
      if (ao < best) { best = ao; ci = i; }
      c.style.transform = reduce ? "" : `rotateX(${Math.max(-60, Math.min(60, -o * 38))}deg) scale(${1 - Math.min(ao, 1.5) * .08})`;
      c.style.opacity = String(Math.max(.15, 1 - Math.max(0, ao - .15) * .7));   // kartu dekat tengah tetap penuh
    });
    if (ci !== cur) {
      cur = ci;
      cards.forEach((c, i) => c.classList.toggle("is-center", i === ci));
      idx.forEach((b, i) => { b.classList.toggle("active", i === ci); b.setAttribute("aria-current", String(i === ci)); });
    }
  };
  let raf = 0;
  wheel.addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; paint(); }); }, { passive: true });
  const remeasure = () => { measure(); paint(); };
  afterFonts(remeasure); new ResizeObserver(remeasure).observe(wheel); onLangChange(() => requestAnimationFrame(remeasure));
  const goTo = (i: number, smooth = true) => {
    const c = cards[Math.max(0, Math.min(cards.length - 1, i))]; if (!c) return;
    wheel.scrollTo({ top: c.offsetTop - wheel.clientHeight / 2 + c.offsetHeight / 2, behavior: smooth && !reduce ? "smooth" : "auto" });
  };
  measure(); goTo(0, false);
  idx.forEach(b => b.addEventListener("click", () => goTo(+b.dataset.skillGo!)));
  cards.forEach((c, i) => c.addEventListener("click", () => { if (i !== cur) goTo(i); }));
  $$<HTMLButtonElement>("[data-wheel]").forEach(b => b.addEventListener("click", () => goTo(cur + +b.dataset.wheel!)));

  const pvEl = $("#skillPrev");
  if (pvEl && fine) {
    const pv = follower(pvEl, true), slot = (k: string) => $(`[data-slot="${k}"]`, pvEl)!;
    $$(".sk-chip", wheel).forEach(chip => {
      chip.addEventListener("pointerenter", e => {
        slot("logo").replaceChildren($<HTMLTemplateElement>(".sk-big", chip)!.content.cloneNode(true));
        slot("name").textContent = $("[data-name]", chip)?.textContent || "";
        slot("cat").textContent = chip.dataset.cat || "";
        pv.show(e.clientX, e.clientY);
      });
      chip.addEventListener("pointermove", e => pv.move(e.clientX, e.clientY));
      chip.addEventListener("pointerleave", () => pv.hide());
    });
    wheel.addEventListener("scroll", () => pv.hide(), { passive: true });
  }
}

/* tombol Download CV saat CV belum diupload lewat admin */
$$("[data-cv-missing]").forEach(b => b.addEventListener("click", () => toast(t("hero.cvSoon"))));

/* ===== experience ===== */
const xpSeg = $('[data-seg="xp"]');
if (xpSeg) seg(xpSeg, v => $$("[data-xp-list]").forEach(l => l.hidden = l.dataset.xpList !== v));
$$<HTMLButtonElement>(".xp-btn").forEach(b => b.addEventListener("click", () => {
  const open = b.parentElement!.classList.toggle("open"); b.setAttribute("aria-expanded", String(open));
}));

/* ===== projects: filter + cari ===== */
let pCat = "All", pQ = "";
const cards = $$<HTMLElement>(".p-card");
function filterProjects() {
  let n = 0;
  cards.forEach(c => { const show = (pCat === "All" || c.dataset.cat === pCat) && c.dataset.search!.includes(pQ); c.hidden = !show; if (show) n++; });
  $("#pEmpty")!.hidden = n > 0;
}
const pSeg = $('[data-seg="proj"]');
if (pSeg) seg(pSeg, v => { pCat = v; filterProjects(); });
$<HTMLInputElement>("#pSearch")?.addEventListener("input", e => { pQ = (e.target as HTMLInputElement).value.trim().toLowerCase(); filterProjects(); });

/* pratinjau project mengikuti kursor (hanya perangkat dengan mouse) — isi diambil dari <template> baris yang di-hover */
const projPrev = $("#projPrev");
if (projPrev && fine && !reduce) {
  const pv = follower(projPrev), media = $("[data-slot=media]", projPrev)!;
  /* render pratinjau sekali saat browser senggang (masih transparan) → saat kursor pertama kali masuk tidak ada jeda */
  const first = $<HTMLTemplateElement>(".p-src", cards[0] ?? document);
  if (first) ("requestIdleCallback" in window ? requestIdleCallback : setTimeout)(() => { if (!media.firstChild) media.replaceChildren(first.content.cloneNode(true)); });
  let warmed = false;
  $("#pGrid")?.addEventListener("pointerenter", () => {   // muat & decode foto lebih dulu agar tidak tersendat saat pertama muncul
    if (warmed) return; warmed = true;
    cards.forEach(c => { const img = $<HTMLTemplateElement>(".p-src", c)?.content.querySelector("img"); if (img) { const im = new Image(); im.src = img.src; im.decode?.().catch(() => {}); } });
  });
  cards.forEach(c => {
    const src = $<HTMLTemplateElement>(".p-src", c); if (!src) return;
    /* isi diganti dulu, pratinjau baru dimunculkan frame berikutnya — tidak bertumpuk dengan animasi isi baris di frame yang sama */
    c.addEventListener("pointerenter", e => { const x = e.clientX, y = e.clientY; media.replaceChildren(src.content.cloneNode(true)); requestAnimationFrame(() => { if (c.matches(":hover")) pv.show(x, y); }); });
    c.addEventListener("pointermove", e => pv.move(e.clientX, e.clientY));
    c.addEventListener("pointerleave", () => pv.hide());
  });
  addEventListener("scroll", () => pv.hide(), { passive: true });
}

/* ===== popup project ===== */
const modal = $("#modal")!, modalContent = $("#modalContent")!;
let lastFocus: HTMLElement | null = null;
function openModal(id: string) {
  const tpl = document.getElementById(`pm-${id}`) as HTMLTemplateElement | null; if (!tpl) return;
  lastFocus = document.activeElement as HTMLElement;
  modalContent.replaceChildren(tpl.content.cloneNode(true));
  const title = $("[data-title]", modalContent); title?.setAttribute("id", "mTitle");
  track("project", title?.textContent?.trim());
  modal.classList.add("open"); document.body.style.overflow = "hidden";
  setTimeout(() => $<HTMLButtonElement>("#mClose")!.focus(), 60);
}
function closeModal() {
  if (!modal.classList.contains("open")) return;
  modal.classList.remove("open"); document.body.style.overflow = ""; lastFocus?.focus();
}
$$<HTMLButtonElement>("[data-project]").forEach(b => b.addEventListener("click", () => openModal(b.dataset.project!)));
$("#mClose")!.addEventListener("click", closeModal);
modal.addEventListener("click", e => { if (e.target === modal) closeModal(); });

/* ===== lightbox (galeri pengalaman, project, sertifikat) ===== */
type Pic = { src: string; caption: string };
const galleries: Record<string, Pic[]> = JSON.parse($("#galleries")?.textContent || "{}");
const lb = $("#lb")!, lbImg = $<HTMLImageElement>("#lbImg")!, lbCap = $("#lbCap")!, lbPrev = $("#lbPrev")!, lbNext = $("#lbNext")!;
let lbList: Pic[] = [], lbI = 0, lbFrom: HTMLElement | null = null;
function showLb() {
  const p = lbList[lbI]; lbImg.src = p.src; lbImg.alt = p.caption;
  lbCap.innerHTML = `<b>${esc(p.caption)}</b>${lbList.length > 1 ? `<span class="text-[0.8125rem] text-[#A1A1AA]">${lbI + 1} / ${lbList.length}</span>` : ""}`;
  lbPrev.hidden = lbNext.hidden = lbList.length < 2;
}
function openLb(key: string, i: number, from: HTMLElement) {
  const list = galleries[key]; if (!list?.length) return;
  lbList = list; lbI = Math.min(i, list.length - 1); lbFrom = from; showLb();
  lb.classList.add("open"); document.body.style.overflow = "hidden"; setTimeout(() => $<HTMLButtonElement>("#lbClose")!.focus(), 50);
}
function stepLb(d: number) { if (lbList.length < 2) return; lbI = (lbI + d + lbList.length) % lbList.length; showLb(); }
function closeLb() {
  if (!lb.classList.contains("open")) return; lb.classList.remove("open");
  if (!modal.classList.contains("open")) document.body.style.overflow = "";
  lbFrom?.focus();
}
document.addEventListener("click", e => {
  const b = (e.target as Element).closest<HTMLElement>("[data-gallery]"); if (!b || moved) return;
  openLb(b.dataset.gallery!, +(b.dataset.k || 0), b);
});
lbPrev.addEventListener("click", () => stepLb(-1)); lbNext.addEventListener("click", () => stepLb(1));
$("#lbClose")!.addEventListener("click", closeLb);
lb.addEventListener("click", e => { const t = e.target as Element; if (t === lb || t.classList.contains("lb-stage")) closeLb(); });
let swX: number | null = null;
lb.addEventListener("pointerdown", e => swX = e.clientX);
lb.addEventListener("pointerup", e => { if (swX !== null && Math.abs(e.clientX - swX) > 50) stepLb(e.clientX < swX ? 1 : -1); swX = null; });

/* ===== keyboard: Esc, panah galeri, Tab terkunci di dialog ===== */
addEventListener("keydown", e => {
  const lbOpen = lb.classList.contains("open");
  if (e.key === "Escape") { if (lbOpen) closeLb(); else closeModal(); setMenu(false); }
  if (lbOpen && e.key === "ArrowLeft") stepLb(-1);
  if (lbOpen && e.key === "ArrowRight") stepLb(1);
  const box = lbOpen ? lb : modal.classList.contains("open") ? $("#modalBox") : null;
  if (e.key === "Tab" && box) {
    const f = $$<HTMLElement>("button,a[href]", box).filter(x => !x.hidden && x.offsetParent !== null); if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

/* ===== sertifikat: seret dengan mouse ===== */
const cs = $("#certs");
let down = false, moved = false, sx = 0, sl = 0;
cs?.addEventListener("pointerdown", e => { if (e.pointerType !== "mouse" || e.button !== 0) return; down = true; moved = false; sx = e.clientX; sl = cs.scrollLeft; });
addEventListener("pointermove", e => { if (!down || !cs) return; const dx = e.clientX - sx; if (Math.abs(dx) > 4) { moved = true; cs.classList.add("drag"); } if (moved) cs.scrollLeft = sl - dx; });
addEventListener("pointerup", () => { if (!down) return; down = false; cs?.classList.remove("drag"); setTimeout(() => moved = false, 0); });

/* ===== salin email ===== */
const copyBtn = $("#copyMail");
copyBtn?.addEventListener("click", async () => {
  const email = copyBtn.dataset.email!;
  try { await navigator.clipboard.writeText(email); $("#copyIc")!.innerHTML = iconSvg("check"); toast(t("js.copied")); track("email"); setTimeout(() => { $("#copyIc")!.innerHTML = iconSvg("copy"); }, 2000); }
  catch { location.href = "mailto:" + email; }
});

/* ===== statistik pengunjung (tanpa cookie) — diproses di src/pages/api/track.ts =====
   Tidak menghitung: localhost (kecuali ?track), browser yang pernah login admin, dan browser otomatis. */
const tracking = (() => {
  if (navigator.webdriver) return false;
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) && !new URLSearchParams(location.search).has("track")) return false;
  try { return localStorage.getItem("pf-no-track") !== "1"; } catch { return true; }
})();
function track(n: string, t?: string | null) {
  if (!tracking) return;
  const q = new URLSearchParams(location.search);
  const body = JSON.stringify({ n, t: t || undefined, p: location.pathname, r: document.referrer, u: q.get("utm_source") || q.get("ref") || undefined, w: innerWidth });
  try { if (!navigator.sendBeacon?.("/api/track", new Blob([body], { type: "text/plain" }))) throw 0; }
  catch { fetch("/api/track", { method: "POST", body, keepalive: true }).catch(() => {}); }
}
track("pageview");
/* bagian yang benar-benar dilihat: dihitung saat melewati tengah layar (sekali per kunjungan) */
if (tracking && "IntersectionObserver" in window) {
  const seen = new Set<string>();
  const io = new IntersectionObserver(es => es.forEach(e => {
    const id = (e.target as HTMLElement).id;
    if (e.isIntersecting && !seen.has(id)) { seen.add(id); track("section", id); io.unobserve(e.target); }
  }), { rootMargin: "-45% 0px -45% 0px" });
  $$("#hero, main section[id]").forEach(s => io.observe(s));
}
/* klik penting: tombol/link dengan atribut data-track (CV, PDF, LinkedIn, GitHub) */
document.addEventListener("click", e => {
  const el = (e.target as Element).closest<HTMLElement>("[data-track]");
  if (el) track(el.dataset.track!);
});

/* ===== formulir kontak → /api/contact ===== */
const cForm = $<HTMLFormElement>("#contactForm");
if (cForm) {
  const shownAt = Date.now(), msg = $("#cfMsg")!, btn = $<HTMLButtonElement>("#cfBtn")!;
  const show = (text: string, ok: boolean) => {
    msg.textContent = text; msg.classList.remove("hidden");
    msg.className = `mt-3 rounded-xl px-3.5 py-2.5 text-sm ${ok ? "bg-[#14532D]/40 text-[#BBF7D0]" : "bg-[#7F1D1D]/40 text-[#FECACA]"}`;
  };
  cForm.addEventListener("submit", async e => {
    e.preventDefault();
    if (btn.disabled) return;
    const f = new FormData(cForm), v = (k: string) => String(f.get(k) ?? "").trim();
    const bad = !v("name") ? "name" : !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v("email")) ? "email" : v("message").length < 10 ? "message" : "";
    if (bad) {
      show(t(bad === "name" ? "js.errName" : bad === "email" ? "js.errEmail" : "js.errMsg"), false);
      (cForm.elements.namedItem(bad) as HTMLElement).focus(); return;
    }
    btn.disabled = true; const label = btn.innerHTML; btn.textContent = t("js.sending");
    try {
      const r = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: v("name"), email: v("email"), message: v("message"), website: v("website"), t: shownAt }) });
      const res = await r.json().catch(() => ({}));
      if (r.ok && res.ok) { cForm.reset(); track("contact"); show(t("js.ok"), true); toast(t("js.sent")); }
      else show(res.error || t("js.errGeneric"), false);
    } catch { show(t("js.errNet"), false); }
    finally { btn.disabled = false; btn.innerHTML = label; }
  });
}

/* ===== scroll: progress, navbar, bagian aktif, kembali ke atas ===== */
const secs = $$("main section"), progress = $("#progress")!, toTop = $("#toTop")!, navLinks = $$(".nav-link");
let ticking = false, tops: number[] = [], docH = 0, viewH = 0, active = "";
const measureSecs = () => { tops = secs.map(s => s.offsetTop); docH = document.documentElement.scrollHeight; viewH = innerHeight; };
function onScroll() {
  ticking = false;
  const y = document.documentElement.scrollTop, max = docH - viewH;
  let cur = "";
  if (y > 40 && y + viewH >= docH - 4) cur = secs[secs.length - 1]?.id ?? "";
  else tops.forEach((top, i) => { if (y >= top - 160) cur = secs[i].id; });
  progress.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
  nav.classList.toggle("nav-scrolled", y > 20 || menuOpen());
  toTop.classList.toggle("show", y > 700);
  if (cur !== active) { active = cur; navLinks.forEach(a => a.classList.toggle("active", a.getAttribute("href") === "#" + cur)); }
}
addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
new ResizeObserver(() => { measureSecs(); onScroll(); }).observe(document.body);
measureSecs(); onScroll();
toTop.addEventListener("click", () => scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }));

/* ===== animasi muncul saat di-scroll ===== */
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .1, rootMargin: "0px 0px -40px 0px" });
$$(".reveal").forEach(el => io.observe(el));

initLang();
initTheme();
