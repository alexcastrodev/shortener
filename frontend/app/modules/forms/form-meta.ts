import type { PublicForm } from '@internal/core/types/Form';
import { SITE_URL, ogImageMeta } from '../seo/index.ts';
import { publicCoverUrl } from './form-cover-url.ts';

export const DESCRIPTION_MAX = 160;

const NO_INDEX = { name: 'robots', content: 'noindex, nofollow' };

export type FormMetaText = (
  key: 'meta_booking' | 'meta_answer',
  options: { title: string }
) => string;

type FormMetaInput = {
  form: Pick<PublicForm, 'title' | 'description' | 'fields' | 'cover_token'> | null | undefined;
  publicId: string;
  apiBase: string;
  t: FormMetaText;
};

const oneLine = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();

export function clipAtWord(text: string, max = DESCRIPTION_MAX) {
  if (text.length <= max) return text;
  const head = text.slice(0, max - 1).replace(/[\uD800-\uDBFF]$/, '');
  const space = head.lastIndexOf(' ');
  const kept = space > max / 2 ? head.slice(0, space) : head;
  return `${kept.replace(/[\s,;:.\-–—]+$/, '')}…`;
}

export function formMeta({ form, publicId, apiBase, t }: FormMetaInput) {
  const title = oneLine(form?.title);
  if (!form || !title) return [{ title: 'Form - Kurz' }, NO_INDEX];

  const booking = form.fields.some(field => field.type === 'booking');
  const description =
    clipAtWord(oneLine(form.description)) || t(booking ? 'meta_booking' : 'meta_answer', { title });
  const url = `${SITE_URL}/f/${encodeURIComponent(publicId)}`;
  const path = publicCoverUrl(publicId, form.cover_token, apiBase);
  const cover = path && new URL(path, SITE_URL).href;
  const image = cover
    ? [
        { property: 'og:image', content: cover },
        { property: 'og:image:type', content: 'image/webp' },
        { property: 'og:image:alt', content: title },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:image', content: cover },
        { name: 'twitter:image:alt', content: title },
      ]
    : ogImageMeta();

  return [
    { title },
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: url },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    ...image,
    NO_INDEX,
  ];
}
