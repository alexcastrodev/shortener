import { api } from '../api';
import type { GetAgendaResponse } from './get-agenda.types';

export async function getAgenda(
  from: string,
  to: string
): Promise<GetAgendaResponse> {
  const response = await api.get<GetAgendaResponse>('/api/me/agenda', {
    params: { from, to },
  });
  return response.data;
}
