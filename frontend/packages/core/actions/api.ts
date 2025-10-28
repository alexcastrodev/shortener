import axios from 'axios';
import { useUserState } from '../states/use-user-state';

export const api = axios.create({
  baseURL: import.meta.env.VITE_BASE_URL,
});

export const publicApi = axios.create({
  baseURL: import.meta.env.VITE_BASE_URL,
});

[api, publicApi].forEach(i =>
  i.interceptors.request.use((config: any) => {
    config.headers.set('Content-Type', 'application/json');
    const token = useUserState.getState().token;
    if (token) config.headers.set('Authorization', `Bearer ${token}`);

    return config;
  })
);

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      useUserState.getState().clear();
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
