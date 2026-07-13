import type { User } from '../../types/User';

export interface GetManageUsersParams {
  status?: 'active' | 'inactive';
  q?: string;
}

export interface GetManageUsersResponse {
  user: User[];
  meta: { total: number };
}
