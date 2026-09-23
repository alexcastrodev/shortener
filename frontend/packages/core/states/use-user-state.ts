import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types/User';

// Only the user profile is kept here, for rendering. The session token lives
// in an httpOnly cookie that page scripts cannot read.
interface UserState {
  user: User | null;
  setUser: (user: User) => void;
  clear: () => void;
}

// v1 persisted the session token itself in localStorage; drop it.
if (typeof window !== 'undefined') {
  try {
    window.localStorage.removeItem('v1-user-storage');
  } catch {
    // Storage unavailable (private mode, blocked site data).
  }
}

export const useUserState = create<UserState>()(
  persist<UserState>(
    set => ({
      user: null,
      setUser: (user: User) => set({ user }),
      clear: () => set({ user: null }),
    }),
    {
      name: 'v2-user-storage',
    }
  )
);
