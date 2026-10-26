/* =====================================================================
   Data awal portofolio (dipindah dari mockup/js/data.js).
   Dipakai jika Supabase belum dihubungkan, dan sebagai isi awal database (supabase/seed.sql).
   ===================================================================== */
import type { PortfolioData } from "../lib/types";

export const SIMPLE_ICONS_CDN = "https://cdn.jsdelivr.net/npm/simple-icons@16.30.0/icons/";

/* gambar contoh untuk galeri pengalaman (diganti foto asli lewat admin) */
export function samplePhoto(label: string, shade: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
<rect width="800" height="600" fill="${shade}"/>
<g fill="none" stroke="#71717A" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" transform="translate(340 220)">
<rect x="0" y="0" width="120" height="96" rx="14"/><circle cx="40" cy="34" r="12"/><path d="m120 70-30-30L20 96"/></g>
<text x="400" y="380" text-anchor="middle" font-family="Arial,sans-serif" font-size="30" fill="#52525B">${label}</text>
<text x="400" y="420" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" fill="#71717A">contoh — ganti lewat panel admin</text></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

export const DATA_VERSION = 2;

export const DEFAULT_DATA: PortfolioData = {
  version: DATA_VERSION,
  /* CONTOH untuk mockup — project, pengalaman & skill di bawah belum data asli Irsyad; ganti lewat panel admin */
  profile: {
    name: "Irsyad Ghibran, S.T.",
    first: "Irsyad", last: "Ghibran, S.T.",
    title: "Metallurgical Engineer",                  // "Metallurgical Engineer focused on …"
    roles: ["Process Engineering", "Extractive Metallurgy", "Process Analysis", "Laboratory Analysis"],
    headline: "Process Engineer | Extractive Metallurgist | Laboratory Analyst",
    openToWork: true,
    status: "Open to opportunities",
    location: "Surabaya, Indonesia",
    highlight: "",                                     // label kecil di foto hero
    photo: "",                                         // foto profil (upload di admin)
    logo: "",                                          // logo/ikon website — favicon & navbar (upload di admin)
    email: "",
    linkedin: "",
    github: "",
    cv: { src: "", name: "" },                         // file PDF upload (data:) atau link https://
    lead: "Metallurgical Engineering graduate of UPN \"Veteran\" Yogyakarta with research and internship experience in extractive metallurgy.",
    about: "I bring strong analytical skills, precision, and a willingness to keep learning and adapting, so I can contribute to the metallurgical industry.",
    education: {
      school: "UPN \"Veteran\" Yogyakarta", faculty: "Faculty of Mineral Technology",
      degree: "Bachelor of Metallurgical Engineering", years: "", gpa: "3.xx / 4.00",   // CONTOH — ganti dengan IPK asli
      focus: "Extractive Metallurgy",
      /* CONTOH — ganti dengan mata kuliah & judul skripsi asli lewat admin */
      courses: "Extractive Metallurgy, Hydrometallurgy, Pyrometallurgy, Mineral Processing, Physical Metallurgy, Thermodynamics of Materials, Corrosion Engineering",
      thesis: "Effect of Sulfuric Acid Concentration and Temperature on Nickel Recovery from Laterite Ore by Atmospheric Leaching",
      logo: ""                                         // logo universitas (upload di admin); kosong = ikon toga
    },
    /* versi Bahasa Indonesia (mode ID) — kosongkan untuk memakai teks bahasa Inggris */
    tr: {
      title: "Sarjana Teknik Metalurgi",
      status: "Terbuka untuk peluang kerja",
      lead: "Lulusan Teknik Metalurgi UPN \"Veteran\" Yogyakarta dengan pengalaman penelitian dan magang di bidang extractive metallurgy.",
      about: "Saya memiliki kemampuan analitis, ketelitian, serta kemauan untuk terus belajar dan beradaptasi guna berkontribusi dalam industri metalurgi.",
      focus: "Metalurgi Ekstraksi",
      courses: "Metalurgi Ekstraksi, Hidrometalurgi, Pirometalurgi, Pengolahan Mineral, Metalurgi Fisik, Termodinamika Material, Teknik Korosi",
      thesis: "Pengaruh Konsentrasi Asam Sulfat dan Temperatur terhadap Perolehan Nikel dari Bijih Laterit dengan Pelindian Atmosferik"
    }
  },
  skills: [
    { id: "extractive", cat: "Extractive Metallurgy", ic: "flame", wide: false, items: [
      { name: "Hydrometallurgy", logo: "ic:flask" }, { name: "Pyrometallurgy", logo: "ic:flame" },
      { name: "Leaching", logo: "ic:flask" }, { name: "Mineral Processing", logo: "ic:layers" } ] },
    { id: "lab", cat: "Laboratory Analysis", ic: "microscope", wide: false, items: [
      { name: "XRD", logo: "ic:microscope" }, { name: "XRF", logo: "ic:microscope" },
      { name: "SEM-EDS", logo: "ic:microscope" }, { name: "AAS", logo: "ic:microscope" } ] },
    { id: "process", cat: "Process Engineering", ic: "factory", wide: true, items: [
      { name: "Mass & Energy Balance", logo: "ic:gauge" }, { name: "Process Analysis", logo: "ic:chart" },
      { name: "Quality Control", logo: "ic:check" }, { name: "Technical Reporting", logo: "ic:fileText" } ] },
    { id: "software", cat: "Software", ic: "code", wide: false, items: [
      { name: "Python", logo: "si:python" }, { name: "Spreadsheet Modelling", logo: "ic:chart" } ] }
  ],
  experience: [
    { id: "x1", type: "Work", role: "Internship — Extractive Metallurgy", org: "Company name (example)", date: "2025",
      desc: "Example entry. Describe the process unit you worked on, the analyses you ran, and the result of your work.",
      photos: [ { src: samplePhoto("Internship photo", "#F7F0F1"), caption: "Example: plant visit" } ],
      tr: { role: "Magang — Metalurgi Ekstraksi", desc: "Contoh. Jelaskan unit proses yang kamu tangani, analisis yang dilakukan, dan hasil kerjamu." } },
    { id: "x2", type: "Organization", role: "Laboratory Assistant", org: "Metallurgy Laboratory, UPN \"Veteran\" Yogyakarta (example)", date: "2024",
      desc: "Example entry. Describe the practicums you assisted and the instruments you handled.", photos: [],
      tr: { role: "Asisten Laboratorium", desc: "Contoh. Jelaskan praktikum yang kamu dampingi dan instrumen yang kamu tangani." } }
  ],
  projects: [
    { id: "p1", t: "Atmospheric Leaching of Nickel Laterite", s: "Hydrometallurgy · Final research", c: "Research", y: 2025, ic: "flask", pub: true, demo: "", repo: "", photos: [], tags: ["Leaching","Nickel","AAS"], d: "Studied the effect of acid concentration, temperature, and time on nickel recovery from laterite ore, with metal content measured by AAS.",
      tr: { s: "Hidrometalurgi · Penelitian akhir", d: "Meneliti pengaruh konsentrasi asam, temperatur, dan waktu terhadap perolehan nikel dari bijih laterit, dengan kadar logam diukur menggunakan AAS." } },
    { id: "p2", t: "Ore Characterization with XRD & XRF", s: "Mineralogy · Laboratory analysis", c: "Research", y: 2024, ic: "microscope", pub: true, demo: "", repo: "", photos: [], tags: ["XRD","XRF","Mineralogy"], d: "Identified the mineral phases and elemental composition of ore samples to recommend a suitable extraction route.",
      tr: { s: "Mineralogi · Analisis laboratorium", d: "Mengidentifikasi fasa mineral dan komposisi unsur sampel bijih untuk merekomendasikan jalur ekstraksi yang sesuai." } },
    { id: "p3", t: "Smelter Process Efficiency Review", s: "Internship project", c: "Internship", y: 2025, ic: "factory", pub: true, demo: "", repo: "", photos: [], tags: ["Pyrometallurgy","Process Data"], d: "Reviewed furnace operating data to find losses in energy use and metal recovery, and proposed practical improvements.",
      tr: { s: "Proyek magang", d: "Meninjau data operasi tungku untuk menemukan kehilangan energi dan perolehan logam, lalu mengusulkan perbaikan praktis." } },
    { id: "p4", t: "Mass Balance of a Copper Concentrate Circuit", s: "Process analysis", c: "Case Study", y: 2024, ic: "gauge", pub: true, demo: "", repo: "", photos: [], tags: ["Mass Balance","Copper","Spreadsheet"], d: "Built a mass balance model of a flotation circuit to trace copper losses between stages and test what-if scenarios.",
      tr: { s: "Analisis proses", d: "Membangun model neraca massa sirkuit flotasi untuk menelusuri kehilangan tembaga antar tahap dan menguji skenario perubahan." } }
  ],
  cases: [
    { id: "cs1", t: "Raising Nickel Recovery in Atmospheric Leaching", ctx: "Final research · Hydrometallurgy lab", y: 2025, ic: "flask", tags: ["Leaching", "Design of Experiments", "AAS"],
      problem: "Nickel recovery from low-grade laterite stayed below 60% at standard leaching conditions, making the route uneconomical.",
      approach: "Ran a factorial experiment on acid concentration, temperature and time, measured dissolved Ni with AAS, and checked residues with XRD.",
      result: "Identified the condition window that lifted recovery to about 85% (example figure) while limiting iron co-dissolution.",
      photos: [],
      tr: { t: "Meningkatkan Perolehan Nikel pada Pelindian Atmosferik", ctx: "Penelitian akhir · Lab hidrometalurgi",
        problem: "Perolehan nikel dari laterit kadar rendah tetap di bawah 60% pada kondisi pelindian standar sehingga jalurnya tidak ekonomis.",
        approach: "Menjalankan eksperimen faktorial untuk konsentrasi asam, temperatur, dan waktu; mengukur Ni terlarut dengan AAS; memeriksa residu dengan XRD.",
        result: "Menemukan rentang kondisi yang menaikkan perolehan menjadi sekitar 85% (angka contoh) sambil membatasi ikut larutnya besi." } },
    { id: "cs2", t: "Tracing Copper Losses in a Flotation Circuit", ctx: "Case study · Process analysis", y: 2024, ic: "gauge", tags: ["Mass Balance", "Flotation"],
      problem: "Plant data showed copper recovery dropping without a clear source between rougher, cleaner and scavenger stages.",
      approach: "Reconciled assay and flow data into a stage-by-stage mass balance and compared scenarios in a spreadsheet model.",
      result: "Located the largest loss at the scavenger tailings and proposed a regrind step (example outcome).",
      photos: [],
      tr: { t: "Menelusuri Kehilangan Tembaga di Sirkuit Flotasi", ctx: "Studi kasus · Analisis proses",
        problem: "Data pabrik menunjukkan perolehan tembaga turun tanpa sumber yang jelas di antara tahap rougher, cleaner, dan scavenger.",
        approach: "Merekonsiliasi data assay dan aliran menjadi neraca massa per tahap, lalu membandingkan skenario di model spreadsheet.",
        result: "Menemukan kehilangan terbesar di tailing scavenger dan mengusulkan tahap regrind (hasil contoh)." } }
  ],
  pubs: [
    { id: "pb1", t: "Effect of Sulfuric Acid Concentration on Nickel Laterite Leaching (example)", authors: "I. Ghibran, Co-author", venue: "Journal name (example)", y: "2025", kind: "Journal", link: "", abs: "" },
    { id: "pb2", t: "Ore Characterization Using XRD and XRF for Process Selection (example)", authors: "I. Ghibran", venue: "Seminar / conference name (example)", y: "2024", kind: "Conference", link: "", abs: "" }
  ],
  certs: [1, 2, 3].map(n => ({ id: "c" + n, t: "Certificate name " + n, o: "Issuer", y: "", img: "", link: "" }))
};

/* nilai bawaan tiap jenis item — dipakai store.js untuk melengkapi data lama (migrasi) */
export const ITEM_DEFAULTS = {
  project:    { s: "", c: "Project", y: "", ic: "folder", pub: true, tags: [], d: "", photos: [], demo: "", repo: "", tr: {} },
  experience: { type: "Work", role: "", org: "", date: "", desc: "", photos: [], tr: {} },
  caseStudy:  { t: "", ctx: "", y: "", ic: "flask", tags: [], problem: "", approach: "", result: "", photos: [], tr: {} },
  pub:        { t: "", authors: "", venue: "", y: "", kind: "Journal", link: "", abs: "" },
  cert:       { t: "", o: "", y: "", img: "", link: "" },
  skillCat:   { cat: "", ic: "code", wide: false, items: [] }
};
