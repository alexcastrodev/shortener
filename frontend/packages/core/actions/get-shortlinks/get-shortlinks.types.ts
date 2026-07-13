import type { Shortlink } from '../../types/Shortlink';

export interface GetShortlinksParams {
  page?: number;
  per_page?: number;
}

export interface GetShortlinksResponse {
  shortlink: Shortlink[];
  meta: {
    total: number;
    page: number;
    per_page: number;
  };
}
