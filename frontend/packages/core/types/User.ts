export type User = {
  id: string;
  email: string;
  shortlinks_count: number;
  admin: boolean;
  deactivated_at: string | null;
  // false for accounts that only sign in with emailed codes.
  has_password?: boolean;
  google_connected?: boolean;
  created_at: string;
};
