export type User = {
  id: string;
  email: string;
  shortlinks_count: number;
  admin: boolean;
  deactivated_at: string | null;
  // false for accounts that only sign in with emailed codes.
  has_password?: boolean;
  deletion_due_at?: string | null;
  google_connected?: boolean;
  locale?: string | null;
  time_zone?: string;
  created_at: string;
};
