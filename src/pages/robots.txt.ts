/* robots.txt — izinkan mesin pencari, kecuali panel admin & halaman cetak PDF */
import type { APIRoute } from "astro";

export const prerender = true;

export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL("/sitemap.xml", site).href;
  return new Response(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /portfolio-pdf\n\nSitemap: ${sitemap}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
