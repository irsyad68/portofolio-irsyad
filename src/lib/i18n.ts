/* =====================================================================
   Teks antarmuka dua bahasa (EN / ID).
   Halaman dirender server dengan KEDUA bahasa (komponen <T>), lalu CSS menyembunyikan yang tidak aktif
   berdasarkan <html data-lang>. Mengganti bahasa = mengganti satu atribut → instan, tanpa render ulang.
   Atribut (placeholder, aria-label) & pesan dari skrip memakai t() di src/scripts/site.ts.
   ===================================================================== */
export type Lang = "en" | "id";

const en = {
  "nav.about": "About", "nav.skills": "Skills", "nav.experience": "Experience", "nav.projects": "Projects",
  "nav.cases": "Case studies", "nav.pubs": "Publications", "nav.certs": "Certificates", "nav.contact": "Contact",
  "nav.talk": "Let’s talk", "nav.menuOpen": "Open menu", "nav.menuClose": "Close menu", "nav.theme": "Toggle theme",
  "nav.lang": "Ganti ke Bahasa Indonesia", "nav.skip": "Skip to content",

  "hero.label": "Engineering Portfolio", "hero.focused": "focused on", "hero.view": "View projects",
  "hero.cv": "Download CV", "hero.pdf": "Portfolio PDF", "hero.photo": "Profile photo", "hero.cvSoon": "CV will be available soon",
  "hero.gpa": "GPA", "hero.projects": "Projects", "hero.experience": "Experience",

  "about.title": "About me", "about.desc": "Who I am and where I studied.",
  "about.faculty": "Faculty", "about.focus": "Focus", "about.courses": "Courses", "about.thesis": "Thesis",

  "skills.title": "Technical skills", "skills.desc": "Methods, laboratory instruments and tools I work with.",
  "skills.count": "skills · scroll the wheel", "skills.prev": "Previous category", "skills.next": "Next category",
  "skills.wheel": "Skill categories — scroll to turn the wheel",

  "xp.title": "Experience", "xp.desc": "Select a row to see details and documentation.",
  "xp.Work": "Work", "xp.Organization": "Organization & volunteer", "xp.empty": "No entries yet.",
  "xp.soon": "Details coming soon.", "xp.photos": "photos", "xp.photo": "photo", "xp.type": "Experience type",

  "proj.title": "Projects & research", "proj.desc": "An index of research, internship work and case studies. Select a row for details.",
  "proj.all": "All", "proj.search": "Search projects or methods", "proj.no": "No.", "proj.project": "Project",
  "proj.category": "Category", "proj.year": "Year", "proj.empty": "No projects match your search.",
  "proj.view": "View details", "proj.docs": "Documentation", "proj.photos": "photos", "proj.demo": "Live demo", "proj.repo": "Source code",

  "cases.title": "Case studies", "cases.desc": "Selected problems worked through from challenge to result.",
  "cases.problem": "Challenge", "cases.approach": "Approach", "cases.result": "Result", "cases.photos": "Documentation",

  "pubs.title": "Publications", "pubs.desc": "Journals, conference papers and articles.",
  "pubs.read": "Read", "pubs.abstract": "Abstract",

  "certs.title": "Certificates", "certs.desc": "Training and competition certificates.", "certs.empty": "No certificates yet.",
  "certs.image": "Certificate image", "certs.verify": "Verify", "certs.drag": "Swipe or drag to see more", "certs.list": "Certificates, scroll horizontally",

  "contact.label": "Contact", "contact.h1": "Let’s get", "contact.h2": "in touch.", "contact.open": "Open to opportunities in",
  "contact.copy": "Email · click to copy", "contact.cv": "Curriculum vitae", "contact.pdfSmall": "Portfolio · page by page", "contact.pdf": "Download PDF",
  "contact.send": "Send a message", "contact.reply": "I usually reply within 1–2 days.", "contact.name": "Name", "contact.email": "Email",
  "contact.message": "Message", "contact.namePh": "Your name", "contact.msgPh": "Hi, I’d like to talk about…",
  "contact.privacy": "Your email is only used to reply to you.", "contact.submit": "Send message", "contact.built": "Built with Astro · Hosted on Vercel",

  "js.copied": "Email copied", "js.sending": "Sending…", "js.sent": "Message sent",
  "js.ok": "Thank you! Your message has been sent — I’ll get back to you soon.",
  "js.errName": "Please enter your name.", "js.errEmail": "Please enter a valid email address.",
  "js.errMsg": "Your message is a bit short — at least 10 characters.", "js.errNet": "No connection. Please check your internet and try again.",
  "js.errGeneric": "Sorry, something went wrong. Please email me directly.",
  "ui.close": "Close", "ui.closePhoto": "Close photo", "ui.prevPhoto": "Previous photo", "ui.nextPhoto": "Next photo", "ui.top": "Back to top",
};

const id: Record<keyof typeof en, string> = {
  "nav.about": "Tentang", "nav.skills": "Keahlian", "nav.experience": "Pengalaman", "nav.projects": "Proyek",
  "nav.cases": "Studi kasus", "nav.pubs": "Publikasi", "nav.certs": "Sertifikat", "nav.contact": "Kontak",
  "nav.talk": "Hubungi saya", "nav.menuOpen": "Buka menu", "nav.menuClose": "Tutup menu", "nav.theme": "Ganti tema",
  "nav.lang": "Switch to English", "nav.skip": "Langsung ke konten",

  "hero.label": "Portofolio Teknik", "hero.focused": "berfokus pada", "hero.view": "Lihat proyek",
  "hero.cv": "Unduh CV", "hero.pdf": "PDF Portofolio", "hero.photo": "Foto profil", "hero.cvSoon": "CV akan segera tersedia",
  "hero.gpa": "IPK", "hero.projects": "Proyek", "hero.experience": "Pengalaman",

  "about.title": "Tentang saya", "about.desc": "Siapa saya dan di mana saya belajar.",
  "about.faculty": "Fakultas", "about.focus": "Fokus", "about.courses": "Mata kuliah", "about.thesis": "Skripsi",

  "skills.title": "Keahlian teknis", "skills.desc": "Metode, instrumen laboratorium, dan perangkat yang saya kuasai.",
  "skills.count": "keahlian · putar rodanya", "skills.prev": "Kategori sebelumnya", "skills.next": "Kategori berikutnya",
  "skills.wheel": "Kategori keahlian — scroll untuk memutar roda",

  "xp.title": "Pengalaman", "xp.desc": "Pilih baris untuk melihat detail dan dokumentasi.",
  "xp.Work": "Kerja", "xp.Organization": "Organisasi & relawan", "xp.empty": "Belum ada data.",
  "xp.soon": "Detail segera hadir.", "xp.photos": "foto", "xp.photo": "foto", "xp.type": "Jenis pengalaman",

  "proj.title": "Proyek & penelitian", "proj.desc": "Indeks penelitian, pekerjaan magang, dan studi kasus. Pilih baris untuk detail.",
  "proj.all": "Semua", "proj.search": "Cari proyek atau metode", "proj.no": "No.", "proj.project": "Proyek",
  "proj.category": "Kategori", "proj.year": "Tahun", "proj.empty": "Tidak ada proyek yang cocok.",
  "proj.view": "Lihat detail", "proj.docs": "Dokumentasi", "proj.photos": "foto", "proj.demo": "Demo langsung", "proj.repo": "Kode sumber",

  "cases.title": "Studi kasus", "cases.desc": "Masalah terpilih yang saya kerjakan dari tantangan hingga hasil.",
  "cases.problem": "Tantangan", "cases.approach": "Pendekatan", "cases.result": "Hasil", "cases.photos": "Dokumentasi",

  "pubs.title": "Publikasi", "pubs.desc": "Jurnal, makalah konferensi, dan artikel.",
  "pubs.read": "Baca", "pubs.abstract": "Abstrak",

  "certs.title": "Sertifikat", "certs.desc": "Sertifikat pelatihan dan kompetisi.", "certs.empty": "Belum ada sertifikat.",
  "certs.image": "Gambar sertifikat", "certs.verify": "Verifikasi", "certs.drag": "Geser untuk melihat lainnya", "certs.list": "Sertifikat, geser ke samping",

  "contact.label": "Kontak", "contact.h1": "Mari", "contact.h2": "terhubung.", "contact.open": "Terbuka untuk peluang di bidang",
  "contact.copy": "Email · klik untuk menyalin", "contact.cv": "Curriculum vitae", "contact.pdfSmall": "Portofolio · per halaman", "contact.pdf": "Unduh PDF",
  "contact.send": "Kirim pesan", "contact.reply": "Biasanya saya membalas dalam 1–2 hari.", "contact.name": "Nama", "contact.email": "Email",
  "contact.message": "Pesan", "contact.namePh": "Nama Anda", "contact.msgPh": "Halo, saya ingin membicarakan…",
  "contact.privacy": "Email Anda hanya dipakai untuk membalas.", "contact.submit": "Kirim pesan", "contact.built": "Dibuat dengan Astro · Di-host di Vercel",

  "js.copied": "Email disalin", "js.sending": "Mengirim…", "js.sent": "Pesan terkirim",
  "js.ok": "Terima kasih! Pesan Anda sudah terkirim — saya akan segera membalas.",
  "js.errName": "Mohon isi nama Anda.", "js.errEmail": "Mohon isi alamat email yang valid.",
  "js.errMsg": "Pesan terlalu singkat — minimal 10 karakter.", "js.errNet": "Tidak ada koneksi. Periksa internet Anda lalu coba lagi.",
  "js.errGeneric": "Maaf, terjadi kesalahan. Silakan kirim email langsung.",
  "ui.close": "Tutup", "ui.closePhoto": "Tutup foto", "ui.prevPhoto": "Foto sebelumnya", "ui.nextPhoto": "Foto berikutnya", "ui.top": "Kembali ke atas",
};

export const UI = { en, id };
export type Key = keyof typeof en;
