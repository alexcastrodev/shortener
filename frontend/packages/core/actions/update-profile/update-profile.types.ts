import type { User } from '../../types/User';

export interface UpdateProfileRequestBody {
  locale?: string | null;
  time_zone?: string;
}

export interface UpdateProfileResponse {
  user: User;
}
