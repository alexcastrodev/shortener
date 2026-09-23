export type AbuseSignalKind = 'same_text' | 'same_links';
export type AbuseSignalStatus = 'open' | 'dismissed';

export interface AbuseSignal {
  id: number;
  kind: AbuseSignalKind;
  status: AbuseSignalStatus;
  first_seen_at: string;
  last_seen_at: string;
  users: { id: number; email: string; active: boolean; created_at: string }[];
  pages: {
    id: number;
    slug: string;
    display_title: string | null;
    user_id: number;
    published: boolean;
    deleted: boolean;
  }[];
}

export interface AdminAbuseSignalsResponse {
  abuse_signal: AbuseSignal[];
}
