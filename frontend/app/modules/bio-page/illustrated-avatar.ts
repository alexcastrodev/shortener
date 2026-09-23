interface AvatarPalette {
  background: [string, string];
  skin: string;
  hair: string;
  shirt: string;
}

// Small inline SVG portraits for sample pages (homepage showcase): no
// network request, no stock photos, and they scale to any size.
export function illustratedAvatar({
  background,
  skin,
  hair,
  shirt,
}: AvatarPalette): string {
  const id = background.join('').replace(/#/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
<defs><linearGradient id="g${id}" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="${background[0]}"/><stop offset="1" stop-color="${background[1]}"/>
</linearGradient></defs>
<rect width="96" height="96" fill="url(#g${id})"/>
<path d="M14 96c2-19 16-30 34-30s32 11 34 30z" fill="${shirt}"/>
<rect x="41" y="52" width="14" height="16" rx="6" fill="${skin}"/>
<circle cx="48" cy="40" r="17" fill="${skin}"/>
<path d="M30 42c-2-16 8-26 19-26 12 0 21 9 18 25-3-8-9-12-18-13-7 5-13 8-19 14z" fill="${hair}"/>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
