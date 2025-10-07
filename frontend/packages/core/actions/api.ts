import axios from 'axios';
import { useUserState } from '../states/use-user-state';

export const api = axios.create({
  baseURL: import.meta.env.VITE_BASE_URL,
});

api.interceptors.request.use((config: any) => {
  config.headers.set('Content-Type', 'application/json');
  const token = useUserState.getState().token;
  if (token) config.headers.set('Authorization', `Bearer ${token}`);

  return config;
});
