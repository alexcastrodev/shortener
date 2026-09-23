// The site-wide social preview (public/og.png, source in og-image/og.html).
// Absolute URLs: crawlers do not resolve relative ones.
export const SITE_URL = 'https://kurz.fyi';

export const OG_IMAGE = {
  url: `${SITE_URL}/og.png`,
  width: 1200,
  height: 630,
  alt: 'Kurz: short links, bio pages and click analytics',
};

export function ogImageMeta() {
  return [
    { property: 'og:image', content: OG_IMAGE.url },
    { property: 'og:image:type', content: 'image/png' },
    { property: 'og:image:width', content: String(OG_IMAGE.width) },
    { property: 'og:image:height', content: String(OG_IMAGE.height) },
    { property: 'og:image:alt', content: OG_IMAGE.alt },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:image', content: OG_IMAGE.url },
    { name: 'twitter:image:alt', content: OG_IMAGE.alt },
  ];
}
