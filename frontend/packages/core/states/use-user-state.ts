import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types/User';

interface UserState {
  token: string | null;
  user: User | null;
  setToken: (token: string) => void;
  setUser: (user: User) => void;
  clear: () => void;
  setup: (token: string, user: User) => void;
}

export const useUserState = create<UserState>()(
  persist<UserState>(
    set => ({
      token: null,
      user: null,
      setToken: (token: string) => set({ token }),
      setUser: (user: User) => set({ user }),
      clear: () => {
        localStorage.removeItem('token');
        set({ token: null, user: null });
      },
      setup: (token: string, user: User) => set({ token, user }),
    }),
    {
      name: 'v1-user-storage',
    }
  )
);
