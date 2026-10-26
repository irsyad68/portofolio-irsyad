-- =====================================================================
-- Skema database portofolio (Supabase / PostgreSQL)
-- Cara pakai: Supabase Dashboard → SQL Editor → New query → tempel seluruh file ini → Run.
-- Lalu jalankan supabase/seed.sql untuk mengisi data awal.
-- Aman dijalankan ulang (memakai IF NOT EXISTS / OR REPLACE).
-- =====================================================================

-- ---------- admin: hanya user yang terdaftar di tabel ini yang boleh mengubah konten ----------
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
-- Tidak bisa diubah lewat API. Pengguna login hanya bisa MEMBACA barisnya sendiri (untuk cek "apakah saya admin?").
drop policy if exists "read own admin row" on public.admins;
create policy "read own admin row" on public.admins for select to authenticated using (user_id = (select auth.uid()));

-- is_admin() di skema "private" yang TIDAK diekspos lewat API (/rest/v1/rpc) — saran Supabase Security Advisor
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;
revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated;

-- ---------- konten ----------
create table if not exists public.profile (
  id int primary key default 1 check (id = 1),         -- selalu satu baris
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.skill_categories (
  id text primary key default gen_random_uuid()::text,
  cat text not null,
  ic text not null default 'code',
  wide boolean not null default false,
  sort int not null default 0
);

create table if not exists public.skills (
  id text primary key default gen_random_uuid()::text,
  category_id text not null references public.skill_categories (id) on delete cascade,
  name text not null,
  logo text not null default '',                        -- "si:<slug>" | "ic:<ikon>" | URL gambar
  sort int not null default 0
);

create table if not exists public.experiences (
  id text primary key default gen_random_uuid()::text,
  type text not null check (type in ('Work', 'Organization')),
  role text not null,
  org text not null default '',
  period text not null default '',
  description text not null default '',
  photos jsonb not null default '[]'::jsonb,            -- [{ "src": "https://…", "caption": "…" }]
  sort int not null default 0
);

create table if not exists public.projects (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  subtitle text not null default '',
  category text not null default 'Project',
  year int,
  icon text not null default 'folder',
  published boolean not null default true,
  tags text[] not null default '{}',
  description text not null default '',
  demo_url text not null default '' check (demo_url = '' or demo_url like 'https://%'),
  repo_url text not null default '' check (repo_url = '' or repo_url like 'https://%'),
  photos jsonb not null default '[]'::jsonb,
  sort int not null default 0
);

create table if not exists public.certificates (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  issuer text not null default '',
  year text not null default '',
  image_url text not null default '',
  link text not null default '' check (link = '' or link like 'https://%'),
  sort int not null default 0
);

-- terjemahan Bahasa Indonesia (opsional) untuk mode bahasa ID: { "s": "…", "d": "…" } / { "role": "…", "desc": "…" }
alter table public.projects add column if not exists tr jsonb not null default '{}'::jsonb;
alter table public.experiences add column if not exists tr jsonb not null default '{}'::jsonb;

create table if not exists public.case_studies (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  context text not null default '',
  year int,
  icon text not null default 'flask',
  tags text[] not null default '{}',
  problem text not null default '',
  approach text not null default '',
  result text not null default '',
  photos jsonb not null default '[]'::jsonb,
  tr jsonb not null default '{}'::jsonb,                -- { "t", "ctx", "problem", "approach", "result" }
  sort int not null default 0
);

create table if not exists public.publications (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  authors text not null default '',
  venue text not null default '',
  year text not null default '',
  kind text not null default 'Journal',
  link text not null default '' check (link = '' or link like 'https://%'),
  abstract text not null default '',
  sort int not null default 0
);

-- ---------- Row Level Security: publik hanya membaca, hanya admin yang menulis ----------
-- (select private.is_admin()) dievaluasi sekali per query, bukan per baris (rekomendasi performa Supabase)
do $$
declare t text;
begin
  foreach t in array array['profile','skill_categories','skills','experiences','projects','case_studies','publications','certificates'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "public read" on public.%I', t);
    execute format('drop policy if exists "admin write" on public.%I', t);
    execute format('drop policy if exists "admin insert" on public.%I', t);
    execute format('drop policy if exists "admin update" on public.%I', t);
    execute format('drop policy if exists "admin delete" on public.%I', t);
    if t = 'projects' then
      -- project yang disembunyikan (published = false) tidak bisa dibaca pengunjung
      execute 'create policy "public read" on public.projects for select using (published or (select private.is_admin()))';
    else
      execute format('create policy "public read" on public.%I for select using (true)', t);
    end if;
    execute format('create policy "admin insert" on public.%I for insert to authenticated with check ((select private.is_admin()))', t);
    execute format('create policy "admin update" on public.%I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', t);
    execute format('create policy "admin delete" on public.%I for delete to authenticated using ((select private.is_admin()))', t);
  end loop;
end $$;

create index if not exists skills_category_id_idx on public.skills (category_id);

-- ---------- Storage: bucket publik untuk foto, logo & CV ----------
-- Bucket "public" → file bisa dibuka lewat URL publik tanpa policy SELECT.
-- Policy SELECT hanya untuk admin, supaya pengunjung TIDAK bisa mendaftar (list) seluruh isi bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portfolio', 'portfolio', true, 10485760,
        array['image/jpeg','image/png','image/webp','image/svg+xml','application/pdf'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "portfolio public read" on storage.objects;
drop policy if exists "portfolio admin read" on storage.objects;
create policy "portfolio admin read" on storage.objects for select to authenticated using (bucket_id = 'portfolio' and (select private.is_admin()));
drop policy if exists "portfolio admin insert" on storage.objects;
create policy "portfolio admin insert" on storage.objects for insert to authenticated with check (bucket_id = 'portfolio' and (select private.is_admin()));
drop policy if exists "portfolio admin update" on storage.objects;
create policy "portfolio admin update" on storage.objects for update to authenticated using (bucket_id = 'portfolio' and (select private.is_admin()));
drop policy if exists "portfolio admin delete" on storage.objects;
create policy "portfolio admin delete" on storage.objects for delete to authenticated using (bucket_id = 'portfolio' and (select private.is_admin()));

-- ---------- Log aktivitas: tidak ada policy UPDATE/DELETE → tidak bisa diubah/dihapus lewat API ----------
create table if not exists public.activity_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  actor text not null default 'sistem',
  action text not null,
  entity text not null,
  entity_id text,
  label text
);
create index if not exists activity_log_created_at_idx on public.activity_log (created_at desc);
alter table public.activity_log enable row level security;
drop policy if exists "admin read log" on public.activity_log;
create policy "admin read log" on public.activity_log for select to authenticated using ((select private.is_admin()));
-- panel admin hanya boleh menulis event sesi/akun miliknya sendiri; perubahan konten dicatat oleh trigger
drop policy if exists "admin insert session events" on public.activity_log;
create policy "admin insert session events" on public.activity_log for insert to authenticated
  with check ((select private.is_admin()) and user_id = (select auth.uid()) and action in ('login', 'logout', 'logout_all', 'password', 'reorder'));

create or replace function private.log_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare rec jsonb; act text;
begin
  rec := to_jsonb(coalesce(new, old));
  act := lower(tg_op);
  -- perubahan yang hanya menggeser urutan tidak dicatat per baris (panel admin mencatat 1 event "reorder")
  if tg_op = 'UPDATE' and (to_jsonb(new) - 'sort' - 'updated_at') = (to_jsonb(old) - 'sort' - 'updated_at') then
    return null;
  end if;
  insert into public.activity_log (user_id, actor, action, entity, entity_id, label)
  values (auth.uid(), coalesce(auth.jwt() ->> 'email', 'sistem'), act, tg_table_name, rec ->> 'id',
          left(coalesce(rec ->> 'title', rec ->> 'role', rec ->> 'name', rec ->> 'cat', case when tg_table_name = 'profile' then 'Profil & kontak' end), 160));
  return null;
end $$;
revoke all on function private.log_change() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['profile','skill_categories','skills','experiences','projects','case_studies','publications','certificates'] loop
    execute format('drop trigger if exists log_change on public.%I', t);
    execute format('create trigger log_change after insert or update or delete on public.%I for each row execute function private.log_change()', t);
  end loop;
end $$;

-- ---------- Pesan dari formulir kontak ----------
-- Pengunjung TIDAK bisa menulis langsung ke tabel ini. Pesan masuk hanya lewat endpoint server /api/contact,
-- yang memanggil public.submit_message() dengan kunci rahasia (CONTACT_SECRET di Vercel; database hanya menyimpan hash-nya).
-- Fungsi itu juga membatasi jumlah kiriman per pengirim & total per jam (anti-spam).
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (char_length(email) <= 200 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  message text not null check (char_length(message) between 10 and 4000),
  read boolean not null default false,
  ip_hash text
);
create index if not exists messages_created_at_idx on public.messages (created_at desc);
create index if not exists messages_ip_hash_idx on public.messages (ip_hash, created_at desc);
alter table public.messages enable row level security;
drop policy if exists "admin read messages" on public.messages;
create policy "admin read messages" on public.messages for select to authenticated using ((select private.is_admin()));
drop policy if exists "admin update messages" on public.messages;
create policy "admin update messages" on public.messages for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists "admin delete messages" on public.messages;
create policy "admin delete messages" on public.messages for delete to authenticated using ((select private.is_admin()));

-- pengaturan rahasia (skema private tidak terekspos ke API)
create table if not exists private.settings (key text primary key, value text not null);
revoke all on private.settings from public, anon, authenticated;
-- isi hash kunci (sekali, lewat SQL Editor — JANGAN taruh kunci aslinya di file ini):
-- insert into private.settings values ('contact_secret_sha256', encode(sha256(convert_to('KUNCI-RAHASIA', 'UTF8')), 'hex'))
--   on conflict (key) do update set value = excluded.value;

create or replace function public.submit_message(p_secret text, p_name text, p_email text, p_message text, p_ip_hash text)
returns void language plpgsql security definer set search_path = '' as $$
declare h text;
begin
  select value into h from private.settings where key = 'contact_secret_sha256';
  if h is null or encode(sha256(convert_to(coalesce(p_secret, ''), 'UTF8')), 'hex') <> h then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if (select count(*) from public.messages where ip_hash = p_ip_hash and created_at > now() - interval '10 minutes') >= 3
     or (select count(*) from public.messages where ip_hash = p_ip_hash and created_at > now() - interval '1 day') >= 10
     or (select count(*) from public.messages where created_at > now() - interval '1 hour') >= 30 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into public.messages (name, email, message, ip_hash) values (btrim(p_name), btrim(p_email), btrim(p_message), p_ip_hash);
end $$;
revoke all on function public.submit_message(text, text, text, text, text) from public, authenticated;
grant execute on function public.submit_message(text, text, text, text, text) to anon;

-- hapus pesan tercatat di log aktivitas (masuk/dibaca tidak dicatat agar log tidak penuh)
drop trigger if exists log_change on public.messages;
create trigger log_change after delete on public.messages for each row execute function private.log_change();

-- ---------- Statistik pengunjung (tanpa cookie, tanpa data pribadi) ----------
-- Dicatat lewat endpoint server /api/track → public.track_event() (butuh kunci server yang sama dengan formulir kontak).
-- "visitor" = hash harian (berganti tiap hari) dari IP + browser, sehingga pengunjung unik bisa dihitung
-- tanpa menyimpan IP dan tanpa bisa melacak orang yang sama antar hari.
create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null check (name in ('pageview', 'section', 'cv', 'pdf', 'linkedin', 'github', 'email', 'project', 'contact')),
  target text check (char_length(target) <= 120),
  path text check (char_length(path) <= 200),
  source text check (char_length(source) <= 60),
  ref_host text check (char_length(ref_host) <= 120),
  device text check (device in ('mobile', 'tablet', 'desktop')),
  country text check (char_length(country) <= 2),
  visitor text check (char_length(visitor) <= 40)
);
create index if not exists analytics_events_created_at_idx on public.analytics_events (created_at desc);
create index if not exists analytics_events_visitor_idx on public.analytics_events (visitor, created_at desc);
alter table public.analytics_events enable row level security;
drop policy if exists "admin read analytics" on public.analytics_events;
create policy "admin read analytics" on public.analytics_events for select to authenticated using ((select private.is_admin()));
drop policy if exists "admin delete analytics" on public.analytics_events;
create policy "admin delete analytics" on public.analytics_events for delete to authenticated using ((select private.is_admin()));

create or replace function private.server_key_ok(p_secret text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select value from private.settings where key = 'contact_secret_sha256')
                  = encode(sha256(convert_to(coalesce(p_secret, ''), 'UTF8')), 'hex'), false);
$$;
revoke all on function private.server_key_ok(text) from public, anon, authenticated;

create or replace function public.track_event(p_secret text, p_name text, p_target text, p_path text, p_source text,
  p_ref_host text, p_device text, p_country text, p_visitor text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.server_key_ok(p_secret) then raise exception 'unauthorized' using errcode = '42501'; end if;
  -- batas wajar: 300 event / pengunjung / hari, 20.000 event / hari total
  if (select count(*) from public.analytics_events where visitor = p_visitor and created_at > now() - interval '1 day') >= 300
     or (select count(*) from public.analytics_events where created_at > now() - interval '1 day') >= 20000 then
    return;
  end if;
  insert into public.analytics_events (name, target, path, source, ref_host, device, country, visitor)
  values (p_name, left(p_target, 120), left(p_path, 200), left(p_source, 60), left(p_ref_host, 120), p_device, left(upper(p_country), 2), p_visitor);
  -- simpan 13 bulan terakhir saja
  if random() < 0.01 then delete from public.analytics_events where created_at < now() - interval '13 months'; end if;
end $$;
revoke all on function public.track_event(text, text, text, text, text, text, text, text, text) from public, authenticated;
grant execute on function public.track_event(text, text, text, text, text, text, text, text, text) to anon;

-- ringkasan untuk panel admin (hanya admin; dihitung di database agar cepat)
create or replace function public.analytics_summary(p_days int default 30, p_tz text default 'Asia/Jakarta')
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare since timestamptz := date_trunc('day', now() at time zone p_tz) at time zone p_tz - make_interval(days => greatest(p_days, 1) - 1);
declare prev timestamptz := since - make_interval(days => greatest(p_days, 1));
begin
  if not (select private.is_admin()) then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'since', since,
    'totals', (select jsonb_build_object(
        'views', count(*) filter (where name = 'pageview'),
        'visitors', count(distinct visitor) filter (where name = 'pageview'),
        'cv', count(*) filter (where name = 'cv'), 'pdf', count(*) filter (where name = 'pdf'),
        'contact', count(*) filter (where name = 'contact'), 'project', count(*) filter (where name = 'project'))
      from public.analytics_events where created_at >= since),
    'prev', (select jsonb_build_object('views', count(*) filter (where name = 'pageview'), 'visitors', count(distinct visitor) filter (where name = 'pageview'))
      from public.analytics_events where created_at >= prev and created_at < since),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('d', d, 'views', v, 'visitors', u) order by d), '[]'::jsonb) from (
        select g.d::date as d, count(e.id) as v, count(distinct e.visitor) as u
        from generate_series((since at time zone p_tz)::date, (now() at time zone p_tz)::date, interval '1 day') g(d)
        left join public.analytics_events e on e.name = 'pageview' and (e.created_at at time zone p_tz)::date = g.d::date
        group by g.d) x),
    'sources', (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc), '[]'::jsonb) from (
        select coalesce(source, 'Langsung') k, count(distinct visitor) n from public.analytics_events
        where name = 'pageview' and created_at >= since group by 1 order by 2 desc limit 8) x),
    'devices', (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc), '[]'::jsonb) from (
        select coalesce(device, 'desktop') k, count(distinct visitor) n from public.analytics_events
        where name = 'pageview' and created_at >= since group by 1) x),
    'countries', (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc), '[]'::jsonb) from (
        select coalesce(country, '??') k, count(distinct visitor) n from public.analytics_events
        where name = 'pageview' and created_at >= since group by 1 order by 2 desc limit 8) x),
    'sections', (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc), '[]'::jsonb) from (
        select target k, count(distinct visitor) n from public.analytics_events
        where name = 'section' and created_at >= since group by 1) x),
    'projects', (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc), '[]'::jsonb) from (
        select target k, count(*) n from public.analytics_events
        where name = 'project' and created_at >= since group by 1 order by 2 desc limit 8) x),
    'actions', (select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc), '[]'::jsonb) from (
        select name k, count(*) n from public.analytics_events
        where name in ('cv', 'pdf', 'linkedin', 'github', 'email', 'contact') and created_at >= since group by 1) x)
  );
end $$;
revoke all on function public.analytics_summary(int, text) from public, anon;
grant execute on function public.analytics_summary(int, text) to authenticated;

-- ---------- Setelah membuat akun admin (Authentication → Users → Add user), daftarkan sebagai admin: ----------
-- insert into public.admins (user_id) select id from auth.users where email = 'EMAIL-ADMIN-ANDA';

-- Uji RLS: anon & user biasa → hanya baca (project tersembunyi tidak terlihat), insert/update/delete ditolak; admin → berhasil.
