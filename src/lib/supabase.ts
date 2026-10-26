/* Klien Supabase. Aktif hanya jika PUBLIC_SUPABASE_URL & PUBLIC_SUPABASE_ANON_KEY diisi di .env
   Anon key aman dipakai di browser KARENA tabel dilindungi Row Level Security (lihat supabase/schema.sql).
   Jangan pernah menaruh service_role key di proyek ini. */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;

export const supabaseEnabled = Boolean(url && key && /^https:\/\//.test(url));
export const supabase: SupabaseClient | null = supabaseEnabled ? createClient(url!, key!, {
  auth: { persistSession: false },
  /* batas waktu 6 dtk: bila database lambat/di-pause, halaman langsung memakai cadangan, tidak menggantung */
  global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(6000) }) },
}) : null;
