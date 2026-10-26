/* Dark mode: tombol [data-theme-toggle], disimpan di localStorage("theme").
   Tema awal di-set skrip inline di Base.astro agar tidak berkedip. */
const root = document.documentElement;
const sys = matchMedia("(prefers-color-scheme: dark)");
const reduce = matchMedia("(prefers-reduced-motion: reduce)");
const listeners: ((t: string) => void)[] = [];
const read = () => { try { return localStorage.getItem("theme"); } catch { return null; } };
const save = (t: string) => { try { localStorage.setItem("theme", t); } catch {} };

function apply(t: string) {
  root.dataset.theme = t;
  document.querySelectorAll("[data-theme-toggle]").forEach(b => {
    b.setAttribute("aria-label", t === "dark" ? "Switch to light mode" : "Switch to dark mode");
    b.setAttribute("aria-pressed", String(t === "dark"));
  });
  listeners.forEach(fn => fn(t));
}

/* lingkaran yang meluas dari tombol (View Transitions API); fallback langsung ganti */
function set(t: string, x: number, y: number) {
  save(t);
  const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
  if (!doc.startViewTransition || reduce.matches || document.hidden) return apply(t);
  doc.startViewTransition(() => apply(t)).ready.then(() => {
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 550, easing: "cubic-bezier(.2,.8,.2,1)", pseudoElement: "::view-transition-new(root)" });
  }).catch(() => {});
}

export function onThemeChange(fn: (t: string) => void) { listeners.push(fn); }

export function initTheme() {
  apply(root.dataset.theme || "light");
  document.querySelectorAll<HTMLElement>("[data-theme-toggle]").forEach(b => b.addEventListener("click", () => {
    const r = b.getBoundingClientRect();
    set(root.dataset.theme === "dark" ? "light" : "dark", r.left + r.width / 2, r.top + r.height / 2);
  }));
  sys.addEventListener("change", e => { if (!read()) apply(e.matches ? "dark" : "light"); });
}
