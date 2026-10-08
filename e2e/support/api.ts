import { API_URL } from './env.ts';
import { tokenFor, type Role } from './auth.ts';

export type ApiResult<T = any> = { status: number; body: T };

export class Api {
  constructor(private readonly role: Role | null) {}

  async call<T = any>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (this.role) headers.Authorization = `Bearer ${tokenFor(this.role)}`;
    const response = await fetch(API_URL + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let parsed: unknown = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = { raw: text.slice(0, 200) };
    }
    return { status: response.status, body: parsed as T };
  }

  get<T = any>(path: string) {
    return this.call<T>('GET', path);
  }

  post<T = any>(path: string, body?: unknown) {
    return this.call<T>('POST', path, body ?? {});
  }

  patch<T = any>(path: string, body: unknown) {
    return this.call<T>('PATCH', path, body);
  }

  delete<T = any>(path: string) {
    return this.call<T>('DELETE', path);
  }
}

export const owner = new Api('owner');
export const client = new Api('client');
export const waiter = new Api('waiter');
export const anonymous = new Api(null);
