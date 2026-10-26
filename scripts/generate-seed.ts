/* Membuat supabase/seed.sql dari src/data/default.ts (data awal portofolio).
   Jalankan: npm run seed   → lalu tempel isi supabase/seed.sql di Supabase SQL Editor.
   Foto contoh (SVG "contoh") TIDAK ikut dimasukkan — upload foto asli lewat admin. */
import { writeFileSync } from "node:fs";
import { DEFAULT_DATA } from "../src/data/default.ts";

const q = (v: unknown) => (v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const json = (v: unknown) => `${q(JSON.stringify(v))}::jsonb`;
const arr = (a: string[]) => `array[${a.map(q).join(",")}]::text[]`;
const realPhotos = (ph: { src: string; caption?: string }[]) => ph.filter(p => /^https:\/\//.test(p.src));

const D = DEFAULT_DATA;
const lines: string[] = [
  "-- Data awal portofolio — DIBUAT OTOMATIS oleh scripts/generate-seed.ts, jangan diedit manual.",
  "-- Jalankan SETELAH schema.sql. Menghapus isi tabel konten lalu mengisi ulang.",
  "begin;",
  "delete from public.skills; delete from public.skill_categories; delete from public.experiences; delete from public.projects; delete from public.case_studies; delete from public.publications; delete from public.certificates;",
  `insert into public.profile (id, data) values (1, ${json(D.profile)}) on conflict (id) do update set data = excluded.data, updated_at = now();`,
];
D.skills.forEach((c, i) => {
  lines.push(`insert into public.skill_categories (id, cat, ic, wide, sort) values (${q(c.id)}, ${q(c.cat)}, ${q(c.ic)}, ${c.wide ? "true" : "false"}, ${i});`);
  c.items.forEach((s, j) => lines.push(`insert into public.skills (category_id, name, logo, sort) values (${q(c.id)}, ${q(s.name)}, ${q(s.logo)}, ${j});`));
});
D.experience.forEach((x, i) => lines.push(
  `insert into public.experiences (id, type, role, org, period, description, photos, tr, sort) values (${q(x.id)}, ${q(x.type)}, ${q(x.role)}, ${q(x.org)}, ${q(x.date)}, ${q(x.desc)}, ${json(realPhotos(x.photos))}, ${json(x.tr ?? {})}, ${i});`));
D.projects.forEach((p, i) => lines.push(
  `insert into public.projects (id, title, subtitle, category, year, icon, published, tags, description, demo_url, repo_url, photos, tr, sort) values (${q(p.id)}, ${q(p.t)}, ${q(p.s)}, ${q(p.c)}, ${Number(p.y) || "null"}, ${q(p.ic)}, ${p.pub !== false}, ${arr(p.tags)}, ${q(p.d)}, ${q(p.demo)}, ${q(p.repo)}, ${json(realPhotos(p.photos))}, ${json(p.tr ?? {})}, ${i});`));
D.cases.forEach((c, i) => lines.push(
  `insert into public.case_studies (id, title, context, year, icon, tags, problem, approach, result, photos, tr, sort) values (${q(c.id)}, ${q(c.t)}, ${q(c.ctx)}, ${Number(c.y) || "null"}, ${q(c.ic)}, ${arr(c.tags)}, ${q(c.problem)}, ${q(c.approach)}, ${q(c.result)}, ${json(realPhotos(c.photos))}, ${json(c.tr ?? {})}, ${i});`));
D.pubs.forEach((p, i) => lines.push(
  `insert into public.publications (id, title, authors, venue, year, kind, link, abstract, sort) values (${q(p.id)}, ${q(p.t)}, ${q(p.authors)}, ${q(p.venue)}, ${q(p.y)}, ${q(p.kind)}, ${q(p.link)}, ${q(p.abs)}, ${i});`));
D.certs.forEach((c, i) => lines.push(
  `insert into public.certificates (id, title, issuer, year, image_url, link, sort) values (${q(c.id)}, ${q(c.t)}, ${q(c.o)}, ${q(c.y)}, ${q(c.img)}, ${q(c.link)}, ${i});`));
lines.push("commit;");

writeFileSync(new URL("../supabase/seed.sql", import.meta.url), lines.join("\n") + "\n", "utf8");
console.log(`supabase/seed.sql dibuat: ${lines.length - 5} pernyataan insert.`);
