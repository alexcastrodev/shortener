import type { PageTemplateItem, PageTheme } from '../../types/Page';

export type AdminPageTemplatesStatus = 'reported' | 'hidden' | 'public';

export interface AdminPageTemplate {
  id: number;
  name: string;
  description: string | null;
  theme: PageTheme;
  items: PageTemplateItem[];
  public_items: PageTemplateItem[];
  author_label: string | null;
  author_slug: string | null;
  owner_email: string;
  owner_id: number;
  uses_count: number;
  reports_count: number;
  reasons: Record<string, number>;
  hidden: boolean;
  published_at: string | null;
}

export interface AdminPageTemplatesResponse {
  page_template: AdminPageTemplate[];
}
