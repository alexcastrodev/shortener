import type { PageTemplateVisibility } from '../../types/Page';

export interface PublishPageTemplateParams {
  id: string;
  visibility: PageTemplateVisibility;
  description?: string | null;
  author_page_id?: number | null;
}
