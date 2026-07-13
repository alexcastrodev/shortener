export type User = {
  id: string;
  email: string;
  shortlinks_count: number;
  admin: boolean;
  deactivated_at: string | null;
  created_at: string;
};
