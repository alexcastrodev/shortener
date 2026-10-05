import { api } from '../api';
import type { DeleteAccountBody, DeleteAccountResponse } from './delete-account.types';

export async function deleteAccount(data: DeleteAccountBody): Promise<DeleteAccountResponse> {
  const response = await api.delete<DeleteAccountResponse>('/api/me', { data });
  return response.data;
}
