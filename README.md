# Portfolio — Irsyad Ghibran

Website portofolio **Irsyad Ghibran, S.T.** (Teknik Metalurgi, UPN "Veteran" Yogyakarta) — process engineering, extractive metallurgy, analisis proses & laboratorium.

Dibuat dari salinan project portofolio Azriel (Astro 7 · Tailwind CSS 4 · Supabase · Vercel) dengan tampilan baru: minimalis, **burgundy #4D0011**, font Sora + Plus Jakarta Sans, mode terang & gelap, **dua bahasa (EN / ID)**. Acuan desain: `design-system/irsyad-portfolio/MASTER.md`.

| | |
|---|---|
| **Online** | 🌐 **https://portofolio-irsyad-one.vercel.app** · admin: **/admin** |
| **Repo** | https://github.com/irsyad68/portofolio-irsyad (deploy otomatis ke Vercel setiap push ke `main`) |
| **Database** | Supabase milik Irsyad (project `portofolio-irsyad`, Singapore) |

## Status

| | |
|---|---|
| ✅ | Tema burgundy (terang/gelap), layout khas Irsyad, kisi kristal interaktif di hero |
| ✅ | Mode bahasa **EN / ID** (tombol di navbar, tersimpan di browser) |
| ✅ | Bagian **Studi kasus** & **Publikasi** (tabel Supabase + halaman admin; disembunyikan bila kosong) |
| ✅ | Logo universitas bisa diupload (admin → Profil & Kontak → Pendidikan) |
| ✅ | Panel admin: semua halaman + mode uji lokal |
| ✅ | Akun GitHub, Supabase & Vercel milik Irsyad, website sudah online |
| ⏳ | Isi asli (foto, CV, IPK, fakultas, project, studi kasus, publikasi, pengalaman, sertifikat) — diisi Irsyad lewat `/admin` |
| ⏳ | Versi PDF (`/portfolio-pdf`) belum memuat Studi kasus & Publikasi |

> **Data di `src/data/default.ts` masih CONTOH** (IPK "3.xx", mata kuliah, skripsi, project, studi kasus, publikasi, pengalaman, skill). Jangan dipublikasikan sebelum diganti data asli.

## Menjalankan di komputer

Butuh Node.js ≥ 22.12.

```bash
npm install
npx astro dev --background   # http://localhost:4322  (port 4322 agar tidak bentrok dengan project Azriel di 4321)
npx astro dev stop
```

Atau klik 2× `jalankan-website.bat`. Perintah lain: `npm run build`, `npm run check`, `npm run seed` (buat `supabase/seed.sql` dari data awal).

## Panel admin

| Mode | Alamat | Login |
|---|---|---|
| **Uji lokal** (tanpa database, hanya saat `npm run dev`) | http://localhost:4322/admin?mock | email bebas, mis. `admin@irsyad.test` · password bebas (tidak boleh kosong). Untuk mencoba “ubah password”, password lama = `uji-lokal`. Data tersimpan sementara di tab browser. |
| **Produksi** (Supabase) | `/admin` | akun yang dibuat Irsyad di Supabase → Authentication → Users, lalu didaftarkan di tabel `admins` |

Halaman: Dashboard · Statistik · Pesan · Profil & Kontak (termasuk **versi Bahasa Indonesia**, **logo universitas**, CV) · Projects · **Studi kasus** · **Publikasi** · Experience · Skills · Certificates · Aktivitas · Akun.
Setiap form konten punya kotak lipat **“Versi Bahasa Indonesia (opsional)”** — kosong = teks bahasa Inggris dipakai di kedua mode.

## Dua bahasa — cara kerja

- Teks antarmuka ada di `src/lib/i18n.ts` (kunci `en` & `id`). Komponen `<T k="…" />` atau `<T en={…} id={…} />` merender **kedua** bahasa; CSS menyembunyikan yang tidak aktif berdasarkan `<html data-lang>`. Mengganti bahasa = mengganti satu atribut → instan.
- Placeholder & aria-label memakai atribut `data-i18n-ph` / `data-i18n-aria`, diganti oleh `src/scripts/lang.ts`.

## Setup Supabase & Vercel (nanti, di akun Irsyad)

1. Supabase → SQL Editor → jalankan `supabase/schema.sql` (aman diulang; sudah termasuk tabel `case_studies`, `publications` dan kolom `tr`), lalu `supabase/seed.sql` bila ingin mulai dari data contoh.
2. Buat user admin (Authentication → Users → Add user), daftarkan di tabel `admins` (perintah ada di akhir `schema.sql`).
3. Isi `.env` dari `.env.example`; hubungkan repo GitHub ke Vercel dan isi Environment Variables yang sama.
4. Ganti `site` di `astro.config.mjs` bila alamat Vercel berbeda.

## Catatan performa

Semua interaksi diuji otomatis di Chrome (frame ±16,9 ms / 60 fps saat mouse bergerak di hero, Projects, Skills, dan saat memutar roda): kisi kristal digambar dari lapisan statis yang disiapkan sekali, pratinjau kursor memakai satu elemen `fixed` + `translate3d` per frame, posisi section/kartu dibaca sekali (bukan tiap scroll).
