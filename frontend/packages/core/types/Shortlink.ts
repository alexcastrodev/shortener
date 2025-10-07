export type Shortlink = {
  id: number;
  original_url: string;
  title?: string | null;
  click_count: number;
  last_accessed_at?: string | null;
  short_code: string;
};
