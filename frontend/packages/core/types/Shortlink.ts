export type Shortlink = {
  id: number;
  original_url: string;
  title?: string;
  events_count: number;
  last_accessed_at?: string;
  short_code: string;
  short_url: string;
  safe?: boolean;
  safe_checked_at?: string | null;
};
