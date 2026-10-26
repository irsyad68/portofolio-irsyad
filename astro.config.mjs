// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  // alamat produksi (Vercel) — dipakai untuk <link rel="canonical">. Ganti jika memakai domain sendiri.
  site: 'https://portofolio-irsyad.vercel.app',
  // Astro 7 default 'jsx' menghapus spasi di antara elemen inline (mis. "Computer Engineer␣focused on").
  compressHTML: true,
  devToolbar: { enabled: false },
  server: { port: 4322, host: false },
  vite: {
    plugins: [tailwindcss()]
  },
  adapter: vercel()
});
