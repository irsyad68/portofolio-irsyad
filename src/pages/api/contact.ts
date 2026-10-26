/* Formulir kontak → tabel messages (dibaca di panel admin → Pesan).
   Lapisan anti-spam:
     1. kolom jebakan (honeypot) & jeda minimal 3 dtk sejak formulir tampil — bot dibalas "sukses" tapi pesan dibuang
     2. hanya menerima kiriman dari situs ini sendiri (header Origin)
     3. validasi isi + tolak pesan yang penuh link
     4. di database: kunci rahasia server (CONTACT_SECRET) + batas 3 pesan/10 menit & 10/hari per pengirim, 30/jam total
   IP pengunjung tidak disimpan — hanya hash-nya (untuk pembatasan). */
import type { APIRoute } from "astro";
import { getSecret } from "astro:env/server";
import { supabase } from "../../lib/supabase";

export const prerender = false;

const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export const POST: APIRoute = async ({ request, url, clientAddress }) => {
  const secret = getSecret("CONTACT_SECRET");
  if (!supabase || !secret) return json({ error: "The contact form is not available right now. Please email me directly." }, 503);

  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) return json({ error: "Invalid request." }, 403);

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return json({ error: "Invalid request." }, 400); }
  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string) : "").trim();
  const name = str("name"), email = str("email"), message = str("message");

  /* bot: isi kolom tersembunyi, atau kirim terlalu cepat → pura-pura berhasil */
  const elapsed = Date.now() - Number(body.t || 0);
  if (str("website") || !(elapsed > 3000)) return json({ ok: true });

  if (!name || name.length > 100) return json({ error: "Please enter your name (max 100 characters)." }, 422);
  if (!EMAIL.test(email) || email.length > 200) return json({ error: "Please enter a valid email address." }, 422);
  if (message.length < 10 || message.length > 4000) return json({ error: "Message must be between 10 and 4,000 characters." }, 422);
  if ((message.match(/https?:\/\//gi) ?? []).length > 3) return json({ error: "Please include fewer links in your message." }, 422);

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || (() => { try { return clientAddress; } catch { return "unknown"; } })();
  const ipHash = (await sha256(`${ip}|${secret}`)).slice(0, 32);

  const { error } = await supabase.rpc("submit_message", { p_secret: secret, p_name: name, p_email: email, p_message: message, p_ip_hash: ipHash });
  if (error) {
    if (/rate_limited/.test(error.message)) return json({ error: "Too many messages in a short time. Please try again later or email me directly." }, 429);
    console.error("[contact] gagal menyimpan pesan:", error.message);
    return json({ error: "Sorry, your message could not be sent. Please email me directly." }, 500);
  }
  return json({ ok: true });
};
