/* Mode bahasa EN / ID: tombol [data-lang-toggle], disimpan di localStorage("lang").
   Bahasa awal di-set skrip inline di Base.astro (tanpa kedip). Teks halaman sudah dirender dalam dua bahasa
   (komponen <T>) — di sini hanya mengganti <html data-lang>, placeholder & aria-label ([data-i18n-ph] / [data-i18n-aria]). */
import { UI, type Key, type Lang } from "../lib/i18n";

const root = document.documentElement;
const listeners: ((l: Lang) => void)[] = [];

export const lang = (): Lang => (root.dataset.lang === "id" ? "id" : "en");
export const t = (k: Key) => UI[lang()][k];
export function onLangChange(fn: (l: Lang) => void) { listeners.push(fn); }

function applyAttrs() {
  document.querySelectorAll<HTMLInputElement>("[data-i18n-ph]").forEach(el => { el.placeholder = t(el.dataset.i18nPh as Key); });
  document.querySelectorAll<HTMLElement>("[data-i18n-aria]").forEach(el => el.setAttribute("aria-label", t(el.dataset.i18nAria as Key)));
}

function set(l: Lang) {
  root.dataset.lang = l; root.lang = l;
  try { localStorage.setItem("lang", l); } catch {}
  applyAttrs(); listeners.forEach(fn => fn(l));
}

export function initLang() {
  applyAttrs();
  document.querySelectorAll("[data-lang-toggle]").forEach(b => b.addEventListener("click", () => set(lang() === "en" ? "id" : "en")));
}
