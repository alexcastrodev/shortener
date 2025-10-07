export type Shortlink = {
  id: number;
  original_url: string;
  title?: string;
  click_count: number;
  last_accessed_at?: string;
  short_code: string;
  short_url: string;
};
