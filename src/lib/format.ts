/* Helper format & keamanan — dipakai di server (komponen) maupun klien */
import { SIMPLE_ICONS_CDN } from "../data/default";
import { iconSvg } from "./icons";
import type { Photo } from "./types";

/** gambar hanya boleh data:image/ atau https:// (mencegah javascript: dsb.) */
export const safeSrc = (s?: string) => (/^(data:image\/|https:\/\/)/.test(s ?? "") ? String(s) : "");
/** link hanya boleh https:// atau mailto: */
export const safeUrl = (s?: string) => (/^(https:\/\/|mailto:)/i.test((s ?? "").trim()) ? String(s).trim() : "");
/** CV: PDF (data:application/pdf) atau link https:// */
export const safeCv = (s?: string) => (/^(data:application\/pdf;base64,|https:\/\/)/.test(s ?? "") ? String(s) : "");
export const prettyUrl = (u?: string) => String(u ?? "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
export const initials = (n?: string) =>
  String(n ?? "").split(/\s+/).filter(w => /^[A-Za-z]/.test(w)).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "AD";
/** foto contoh (SVG berlabel "contoh") hanya untuk mockup — tidak pernah ditampilkan ke publik */
export const isSamplePhoto = (src?: string) => /^data:image\/svg\+xml/.test(src ?? "") && decodeURIComponent(src ?? "").includes("contoh");
export const photosOf = (o: { photos?: Photo[] }) => (o.photos ?? []).filter(p => safeSrc(p.src) && !isSamplePhoto(p.src));
export const pad2 = (i: number) => String(i + 1).padStart(2, "0");
const escHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** HTML logo skill: Simple Icons (warna ikut tema via CSS mask), ikon bawaan, gambar, atau inisial */
export function logoHTML(logo: string, name: string, size = 18): string {
  const r = size / 16 + "rem";
  const slug = logo?.startsWith("si:") ? logo.slice(3).replace(/[^a-z0-9]/g, "") : "";
  if (slug) return `<span class="logo-si" aria-hidden="true" style="--src:url('${SIMPLE_ICONS_CDN}${slug}.svg');width:${r};height:${r}"></span>`;
  if (logo?.startsWith("ic:")) return iconSvg(logo.slice(3), size);
  if (safeSrc(logo)) return `<img class="logo-img" src="${safeSrc(logo).replace(/"/g, "%22")}" alt="" style="width:${r};height:${r}" loading="lazy">`;
  return `<span class="logo-txt" aria-hidden="true">${escHtml(String(name || "?").slice(0, 2))}</span>`;
}
