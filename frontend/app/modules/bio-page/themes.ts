import type { PageTheme } from '@internal/core/types/Page';

export interface BioTheme {
  name: string;
  page: string;
  avatar: string;
  title: string;
  bio: string;
  button: string;
  footer: string;
  swatch: string;
}

// A fixed set of presets instead of free-form colors: every combination
// here was picked to keep text and buttons readable (WCAG AA contrast).
// Only "default" follows the visitor's light/dark preference; the others
// are the page owner's look and stay the same for everyone.
export const BIO_THEMES: Record<PageTheme, BioTheme> = {
  default: {
    name: 'Default',
    page: 'bg-background text-foreground',
    avatar: 'bg-primary text-primary-foreground',
    title: 'text-foreground',
    bio: 'text-muted-foreground',
    // Edge from the text color (works in light and dark) plus a soft
    // shadow: the app's border token is too faint to outline a button.
    button:
      'border border-foreground/20 bg-card text-card-foreground shadow-sm hover:bg-accent hover:text-accent-foreground',
    footer: 'text-muted-foreground hover:text-foreground',
    swatch: 'bg-background border border-border',
  },
  midnight: {
    name: 'Midnight',
    page: 'bg-[#0f172a] text-[#f8fafc]',
    avatar: 'bg-[#6366f1] text-white',
    title: 'text-[#f8fafc]',
    bio: 'text-[#cbd5e1]',
    button:
      'border border-[#475569] bg-[#1e293b] text-[#f8fafc] hover:bg-[#334155]',
    footer: 'text-[#94a3b8] hover:text-[#f8fafc]',
    swatch: 'bg-[#0f172a]',
  },
  sunset: {
    name: 'Sunset',
    page: 'bg-gradient-to-b from-[#fde68a] via-[#fdba74] to-[#f9a8d4] text-[#431407]',
    avatar: 'bg-[#431407] text-[#fff7ed]',
    title: 'text-[#431407]',
    bio: 'text-[#7c2d12]',
    button:
      'border border-[#431407]/15 bg-white/80 text-[#431407] shadow-sm hover:bg-white',
    footer: 'text-[#7c2d12] hover:text-[#431407]',
    swatch: 'bg-gradient-to-b from-[#fde68a] via-[#fdba74] to-[#f9a8d4]',
  },
  forest: {
    name: 'Forest',
    // Deep forest greens; buttons are moss with a sage border (3.3:1
    // against the page, so their edges stay visible).
    page: 'bg-gradient-to-b from-[#0b2418] to-[#0f3221] text-[#e9f5ec]',
    avatar: 'bg-[#8fc9a3] text-[#0b2418]',
    title: 'text-[#e9f5ec]',
    bio: 'text-[#a9c7b4]',
    button: 'border border-[#3f8a5e] bg-[#1a4530] text-[#e9f5ec] hover:bg-[#215638]',
    footer: 'text-[#86a894] hover:text-[#e9f5ec]',
    swatch: 'bg-gradient-to-b from-[#0b2418] to-[#0f3221]',
  },
  ocean: {
    name: 'Ocean',
    page: 'bg-gradient-to-b from-[#0369a1] to-[#1e3a8a] text-white',
    avatar: 'bg-white text-[#1e3a8a]',
    title: 'text-white',
    bio: 'text-[#e0f2fe]',
    button: 'bg-white text-[#1e3a8a] hover:bg-[#e0f2fe]',
    footer: 'text-[#bae6fd] hover:text-white',
    swatch: 'bg-gradient-to-b from-[#0369a1] to-[#1e3a8a]',
  },
  paper: {
    name: 'Paper',
    page: 'bg-[#fafaf9] text-[#1c1917]',
    avatar: 'bg-[#1c1917] text-[#fafaf9]',
    title: 'text-[#1c1917]',
    bio: 'text-[#57534e]',
    button: 'bg-[#1c1917] text-[#fafaf9] hover:bg-[#44403c]',
    footer: 'text-[#78716c] hover:text-[#1c1917]',
    swatch: 'bg-[#fafaf9] border border-[#d6d3d1]',
  },
};

export function getBioTheme(theme: string | undefined): BioTheme {
  return BIO_THEMES[theme as PageTheme] ?? BIO_THEMES.default;
}
