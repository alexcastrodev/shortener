import type { Shortlink } from '../../types/Shortlink';

export interface AdminGetShortlinksParams {
  status?: 'active' | 'inactive';
  q?: string;
}

export interface AdminGetShortlinksResponse {
  shortlink: Shortlink[];
  meta: { total: number };
}
