import axios from 'axios';
import { useUserState } from '../states/use-user-state';

// Authenticated calls: the browser attaches the httpOnly session cookie.
export const api = axios.create({
  baseURL: import.meta.env.VITE_BASE_URL,
  withCredentials: true,
});

// Anonymous calls; requests that must send or receive the session cookie
// (login, logout, "who am I") opt in with withCredentials per request.
export const publicApi = axios.create({
  baseURL: import.meta.env.VITE_BASE_URL,
});

[api, publicApi].forEach(i =>
  i.interceptors.request.use(config => {
    // Multipart uploads (FormData) need the browser-generated boundary.
    if (!(config.data instanceof FormData)) {
      config.headers.set('Content-Type', 'application/json');
    }
    // Required by the API for cookie-authenticated writes (CSRF defense).
    config.headers.set('X-Requested-With', 'XMLHttpRequest');

    return config;
  })
);

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      useUserState.getState().clear();
      window.location.replace('/login');
    }
    if (error.response?.status === 403) {
      const message = error.response?.data?.message;
      if (message === 'Your account has been deactivated') {
        useUserState.getState().clear();
        window.location.replace('/login?deactivated=true');
      }
    }
    return Promise.reject(error);
  }
);
