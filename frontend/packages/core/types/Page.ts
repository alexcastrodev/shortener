export const PAGE_THEMES = [
  'default',
  'midnight',
  'sunset',
  'forest',
  'ocean',
  'paper',
] as const;

export type PageTheme = (typeof PAGE_THEMES)[number];

// link: a button; social: an icon in the row under the page title;
// header: a section title (no URL) grouping the items below it.
export type PageLinkKind = 'link' | 'social' | 'header';

export type PageLink = {
  id: number;
  kind: PageLinkKind;
  label: string;
  url: string | null;
  icon?: string | null;
  position: number;
  active: boolean;
  clicks_count: number;
  // false when Safe Browsing flagged the URL; hidden from visitors
  safe: boolean;
};

export type Page = {
  id: number;
  slug: string;
  display_title?: string | null;
  bio?: string | null;
  theme: PageTheme;
  published: boolean;
  expires_at?: string | null;
  public_url: string;
  avatar_url?: string | null;
  // A new avatar is being optimized server-side; avatar_url still points at
  // the previous one until then.
  avatar_processing?: boolean;
  links?: PageLink[];
  created_at: string;
  updated_at: string;
};

export type PublicPageLink = {
  id: number;
  kind: PageLinkKind;
  label: string;
  url: string | null;
  icon?: string | null;
};

export type PublicPage = {
  slug: string;
  display_title?: string | null;
  bio?: string | null;
  theme: PageTheme;
  avatar_url?: string | null;
  links: PublicPageLink[];
};

export type PageTemplateItem = {
  kind: PageLinkKind;
  label: string;
  url: string | null;
  icon?: string | null;
  active?: boolean;
};

export type PageTemplateVisibility = 'private' | 'public';

// "by Title · @slug"; slug is null while the author's page is not public.
export type PageTemplateAuthor = {
  label: string;
  slug: string | null;
};

export type PageTemplate = {
  // Built-in key ("creator"), "custom-<id>" for the user's own, or
  // "community-<id>" for someone else's published one.
  id: string;
  name: string;
  description?: string | null;
  theme: PageTheme;
  built_in: boolean;
  items: PageTemplateItem[];
  // Own templates only: the placeholder version the Community gets.
  public_items?: PageTemplateItem[];
  visibility?: PageTemplateVisibility;
  hidden?: boolean;
  uses_count?: number;
  author?: PageTemplateAuthor | null;
  community?: boolean;
  // A Community template published by the current user.
  mine?: boolean;
};

export type PageTemplateReportReason =
  'spam' | 'offensive' | 'impersonation' | 'other';
