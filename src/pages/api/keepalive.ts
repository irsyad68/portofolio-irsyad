/* Dipanggil Vercel Cron sekali sehari (lihat vercel.json).
   Supabase paket gratis mem-pause proyek yang ±7 hari tanpa aktivitas; query kecil ini menjaganya tetap aktif.
   Hanya membaca data publik, jadi aman walau dibuka siapa saja. */
import type { APIRoute } from "astro";
import { supabase } from "../../lib/supabase";

export const prerender = false;

export const GET: APIRoute = async () => {
  const t = Date.now();
  const res = supabase ? await supabase.from("profile").select("id").eq("id", 1).maybeSingle() : null;
  const ok = !!res && !res.error;
  return new Response(JSON.stringify({ ok, ms: Date.now() - t, error: res?.error?.message ?? (supabase ? undefined : "Supabase belum diatur") }), {
    status: ok ? 200 : 503,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
};
