import { isAxiosError } from 'axios';
import { api, publicApi } from '../api';

export interface WaitlistState {
  waitlist: {
    form_title: string;
    service: string | null;
    starts_at: string;
    status: 'waiting' | 'offered' | 'claimed' | 'expired' | 'left';
    offered_until: string | null;
    time_zone: string;
  };
  result?:
    | 'claimed'
    | 'not_offered'
    | 'expired'
    | 'unavailable'
    | 'left'
    | 'already_closed';
}

export interface JoinWaitlistParams {
  service: string;
  date: string;
  time: string;
  name: string;
  email: string;
}

export type JoinWaitlistError =
  | 'not_full'
  | 'waitlist_full'
  | 'too_many_waitlists'
  | 'invalid'
  | 'unavailable'
  | 'captcha_failed'
  | 'rate_limited'
  | 'unknown';

export async function joinWaitlist(
  publicId: string,
  params: JoinWaitlistParams & {
    turnstile_token?: string | null;
    website?: string;
    client_locale?: string;
    client_time_zone?: string;
  }
): Promise<void> {
  try {
    await publicApi.post(
      `/api/public/forms/${encodeURIComponent(publicId)}/waitlist`,
      params
    );
  } catch (error) {
    const code = isAxiosError(error)
      ? (error.response?.data as { error?: string } | undefined)?.error
      : undefined;
    throw (code ?? 'unknown') as JoinWaitlistError;
  }
}

const path = (token: string) =>
  `/api/public/waitlist/${encodeURIComponent(token)}`;

export async function getWaitlistEntry(
  token: string
): Promise<WaitlistState | null> {
  try {
    return (await publicApi.get<WaitlistState>(path(token))).data;
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) return null;
    throw error;
  }
}

export async function claimWaitlist(token: string): Promise<WaitlistState> {
  return (await publicApi.post<WaitlistState>(`${path(token)}/claim`)).data;
}

export async function leaveWaitlist(token: string): Promise<WaitlistState> {
  return (await publicApi.post<WaitlistState>(`${path(token)}/leave`)).data;
}

export interface OwnerWaitlistRow {
  id: number;
  service_id: string;
  starts_at: string;
  name: string;
  email: string;
  status: 'waiting' | 'offered';
  offered_until: string | null;
}

export async function getFormWaitlist(
  formId: number | string
): Promise<OwnerWaitlistRow[]> {
  return (
    await api.get<{ waitlist: OwnerWaitlistRow[] }>(
      `/api/me/forms/${formId}/waitlist`
    )
  ).data.waitlist;
}
