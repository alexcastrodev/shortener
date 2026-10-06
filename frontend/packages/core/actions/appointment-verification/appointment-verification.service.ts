import { isAxiosError } from 'axios';
import { publicApi } from '../api';

export interface VerificationResponse {
  appointment: {
    form_title: string;
    service: string;
    status: string;
    expires_at: string | null;
    time_zone: string;
    sessions: { starts_at: string }[];
  };
  result?: 'verified' | 'already_done' | 'expired';
}

const path = (token: string) =>
  `/api/public/appointment_verifications/${encodeURIComponent(token)}`;

export async function getVerification(token: string): Promise<VerificationResponse | null> {
  try {
    return (await publicApi.get<VerificationResponse>(path(token))).data;
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) return null;
    throw error;
  }
}

export async function confirmVerification(token: string): Promise<VerificationResponse> {
  return (await publicApi.post<VerificationResponse>(path(token))).data;
}
