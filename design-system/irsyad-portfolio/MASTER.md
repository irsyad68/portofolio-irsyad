# Design System — Irsyad Portfolio

Sumber keputusan: brief Irsyad (2026-10-26) — minimalis, profesional, cocok untuk engineer; warna burgundy #4D0011; hindari hijau & ornamen berlebih; font tegas; animasi interaktif; satu halaman panjang; mode terang (putih) + gelap.

## Warna (token di `src/styles/global.css`)

| Token | Terang | Gelap | Dipakai untuk |
|---|---|---|---|
| `--bg` | `#FFFFFF` | `#0F0809` | latar halaman |
| `--surface` / `--card` | `#FCF9F9` / `#FFFFFF` | `#140B0D` / `#1A0F12` | kartu, panel |
| `--muted` | `#F7F1F2` | `#261619` | thumbnail, chip |
| `--border` / `--border-strong` | `#EEE4E6` / `#DCCBCF` | `#331F24` / `#4A2E35` | garis |
| `--fg` / `--fg-2` / `--fg-muted` | `#1A0B0E` / `#3F2A2F` / `#6E585D` | `#F8F1F2` / `#E0D2D5` / `#AE979C` | teks |
| `--primary` (tombol utama) | `#4D0011` | `#8E1A33` | tombol, logo |
| `--accent` (teks/garis aksen) | `#4D0011` | `#D4566F` | nama belakang, role, nomor section, garis nav, badge |
| `--accent-soft` | `#F6E8EB` | `#2E1419` | latar badge kategori |
| `--inv` | `#4D0011` | `#7A1229` | blok terbalik (hover kartu project, accordion) |

Catatan: `#4D0011` hampir hitam di atas latar gelap, jadi mode gelap memakai burgundy lebih terang. Semua teks ≥ 4.5:1. Hijau tidak dipakai di halaman publik (titik "open to work" memakai aksen burgundy); `--ok` hijau hanya untuk status di panel admin.

## Tipografi

- Heading: **Sora** 600–800 (tegas, geometris)
- Body: **Plus Jakarta Sans** 400–700
- Skala & spasi mengikuti project asal (Tailwind, `html` 90% di desktop / 100% di HP).

## Gerak

Sama seperti project asal: grid titik reaktif di hero (warna `--dot`), nama naik saat dimuat, role bergilir, tombol magnetik, reveal saat scroll, hover kartu. Semua dimatikan bila `prefers-reduced-motion`.

## Layout (pembeda dari portofolio Azriel — revisi ke-4, 2026-10-26)

| Bagian | Azriel | Irsyad |
|---|---|---|
| Hero | teks kiri + foto besar kanan, grid titik | muat satu layar desktop; grid 2 baris: [nama ≤5.75rem | foto 14rem] lalu [peran + tombol (View projects · **Download CV** · Portfolio PDF) | lembar data ringkas **GPA · Projects · Experience** di bawah foto] — garis tebal kedua kolom **sejajar**; latar **kisi kristal heksagonal** |
| Judul section | kolom kiri menempel (sticky) | judul besar + nomor kecil di kiri, keterangan di kanan, garis tebal di bawah |
| About | satu kolom | dua kolom: kalimat pembuka · kartu pendidikan (format sama: Faculty, Focus, dst.) |
| Skills | kartu + marquee logo berjalan otomatis | **kartu kategori = roda** (diputar scroll / panah / indeks di kiri), kartu tengah **disorot** burgundy; hover skill → pratinjau logo + kategori muncul di atas kursor |
| Projects | grid kartu 2 kolom bergambar | **daftar indeks** (No · Project · Category · Year); hover: baris terisi burgundy dari bawah + pratinjau gambar/ikon mengikuti kursor |
| Studi kasus | — (tidak ada) | kartu lebar: kepala (ikon, nomor, judul, konteks, tags) lalu 3 kolom **Tantangan → Pendekatan → Hasil** dengan panah di antaranya; "Hasil" berwarna aksen; deretan foto opsional |
| Publikasi | — (tidak ada) | daftar bergaya daftar pustaka: tahun (aksen) · judul (link) · penulis · venue · badge jenis; abstrak bisa dibuka (`<details>`) |
| Bahasa | hanya EN | tombol **EN / ID** di navbar (huruf aktif berwarna aksen); kedua bahasa dirender server, CSS menyembunyikan yang tidak aktif |
| Foto hero | label kota di atas foto | tanpa label |
| Kartu pendidikan | ikon toga | **logo universitas** (upload di admin), fallback ikon toga |
| Menu | desktop mulai 1024px | desktop mulai **1280px** (7 link) |

## Catatan performa

Pratinjau yang mengikuti kursor (Projects & Skills) memakai **satu elemen `position: fixed`** per section; posisinya ditulis lewat `translate3d` di `requestAnimationFrame` dengan lerp ringan. Tidak ada `getBoundingClientRect` per gerakan mouse dan tidak ada transisi CSS pada posisi (penyebab tersendat di versi sebelumnya). Foto pratinjau dimuat & di-decode lebih dulu saat kursor masuk ke daftar project.
