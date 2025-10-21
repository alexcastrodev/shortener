import type { Shortlink } from '../../types/Shortlink';

export interface AdminGetShortlinksResponse {
  shortlink: Shortlink[];
  total: number;
}
