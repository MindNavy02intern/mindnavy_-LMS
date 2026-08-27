// Applies the admin-configured brand primary color as CSS custom properties
// on :root, so buttons/sidebar/links (styled via var(--color-primary) in
// brand.css) update without a reload. Falls back to the default brand blue
// (--mn-blue-500) when no color is set yet or the value is malformed.

const DEFAULT_PRIMARY = '#0ea5e9';

function hexToRgba(hex: string, alpha: number): string {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!match) return `rgba(14, 165, 233, ${alpha})`;
  const n = parseInt(match[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function applyPrimaryColor(color: string | null | undefined): void {
  const hex = color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : DEFAULT_PRIMARY;
  const root = document.documentElement.style;
  root.setProperty('--color-primary', hex);
  root.setProperty('--color-primary-glow', hexToRgba(hex, 0.14));
}

// Sidebar logo <img data-brand-logo> — updated on load and right after a
// Branding tab upload, so the change is visible without a reload.
const DEFAULT_LOGO = '/brand/logowhite.png';

export function applyLogo(url: string | null | undefined): void {
  const img = document.querySelector<HTMLImageElement>('[data-brand-logo]');
  if (img) img.src = url || DEFAULT_LOGO;
}

// index.html's <link rel="icon">, same live-update treatment as the logo.
const DEFAULT_FAVICON = '/favicon.svg';

export function applyFavicon(url: string | null | undefined): void {
  const link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (link) link.href = url || DEFAULT_FAVICON;
}
