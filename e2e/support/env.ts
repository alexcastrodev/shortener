export const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000';
export const APP_URL = process.env.E2E_APP_URL ?? 'http://localhost:3001';
export const REDIS_URL = process.env.E2E_REDIS_URL ?? process.env.REDIS_URL ?? 'redis://localhost:6379/0';
export const TOKENS_FILE = new URL('../.auth/tokens.json', import.meta.url);
export const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://localhost:8025';
