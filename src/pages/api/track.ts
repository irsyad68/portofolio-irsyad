/* Pencatat statistik pengunjung (dipanggil navigator.sendBeacon dari src/scripts/site.ts).
   Tanpa cookie & tanpa menyimpan IP: "visitor" = hash harian dari IP + browser + tanggal + kunci server,
   jadi pengunjung unik per hari bisa dihitung, tetapi orang yang sama tidak bisa dilacak antar hari.
   Data: halaman, sumber kunjungan (LinkedIn/Google/…), jenis perangkat, negara (dari Vercel), dan aksi (CV, PDF, project…). */
import type { APIRoute } from "astro";
import { getSecret } from "astro:env/server";
import { supabase } from "../../lib/supabase";

export const prerender = false;

const NAMES = new Set(["pageview", "section", "cv", "pdf", "linkedin", "github", "email", "project", "contact"]);
const BOT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|curl|wget|python|axios|node-fetch/i;
const SOURCES: [RegExp, string][] = [
  [/(^|\.)linkedin\.com$|^lnkd\.in$/, "LinkedIn"], [/(^|\.)google\./, "Google"], [/(^|\.)bing\.com$/, "Bing"],
  [/(^|\.)duckduckgo\.com$/, "DuckDuckGo"], [/(^|\.)github\.com$/, "GitHub"], [/whatsapp|^wa\.me$|^l\.wl\.co$/, "WhatsApp"],
  [/(^|\.)(facebook|fb)\.com$|^l\.facebook\.com$/, "Facebook"], [/(^|\.)instagram\.com$/, "Instagram"],
  [/^t\.co$|(^|\.)(twitter|x)\.com$/, "X / Twitter"], [/(^|\.)t\.me$|telegram/, "Telegram"], [/(^|\.)canva\.(com|site)$/, "Canva"],
  [/mail\.|outlook\.|gmail/, "Email"], [/(^|\.)vercel\.(app|com)$/, "Vercel"],
];
const done = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export const POST: APIRoute = async ({ request, url, clientAddress }) => {
  const secret = getSecret("CONTACT_SECRET");
  const ua = request.headers.get("user-agent") ?? "";
  const origin = request.headers.get("origin");
  if (!supabase || !secret || BOT.test(ua) || (origin && origin !== url.origin)) return done();

  let b: Record<string, unknown>;
  try { b = JSON.parse(await request.text()); } catch { return done(); }
  const name = String(b.n ?? "");
  if (!NAMES.has(name)) return done();
  const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

  /* sumber: ?utm_source=… / ?ref=… lebih diutamakan, lalu domain referrer (kunjungan dari situs sendiri diabaikan) */
  let source = str(b.u, 60), refHost: string | null = null;
  try {
    const h = new URL(String(b.r ?? "")).hostname.replace(/^www\./, "");
    if (h && h !== url.hostname) { refHost = h; source ??= SOURCES.find(([re]) => re.test(h))?.[1] ?? h; }
  } catch { /* tanpa referrer = kunjungan langsung */ }
  /* nama dari ?utm_source=linkedin dsb. diseragamkan */
  const KEYS: [RegExp, string][] = [[/linkedin|lnkd/, "LinkedIn"], [/google/, "Google"], [/github/, "GitHub"], [/whatsapp|^wa$/, "WhatsApp"],
    [/instagram|^ig$/, "Instagram"], [/facebook|^fb$/, "Facebook"], [/twitter|^x$/, "X / Twitter"], [/telegram/, "Telegram"], [/e?mail|gmail|outlook/, "Email"], [/^cv$|resume/, "CV"]];
  if (source) source = KEYS.find(([re]) => re.test(source!.toLowerCase()))?.[1] ?? source;

  const w = Number(b.w) || 0;
  const device = /iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua)) ? "tablet" : /Mobi|iPhone|Android/i.test(ua) || (w && w < 640) ? "mobile" : "desktop";
  const country = request.headers.get("x-vercel-ip-country")?.slice(0, 2) || null;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || (() => { try { return clientAddress; } catch { return "?"; } })();
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const visitor = (await sha256(`${day}|${ip}|${ua}|${secret}`)).slice(0, 32);

  const { error } = await supabase.rpc("track_event", {
    p_secret: secret, p_name: name, p_target: str(b.t, 120), p_path: str(b.p, 200) ?? "/", p_source: name === "pageview" ? source : null,
    p_ref_host: name === "pageview" ? refHost : null, p_device: device, p_country: country, p_visitor: visitor,
  });
  if (error) console.error("[track]", error.message);
  return done();
};
