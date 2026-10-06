import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { getAgenda } from './get-agenda.service';
import type { GetAgendaResponse } from './get-agenda.types';

export const getAgendaKey = ['get-agenda'];

export function useGetAgenda(from: string, to: string) {
  return useQuery<GetAgendaResponse, ResponseError>({
    queryKey: [...getAgendaKey, from, to],
    queryFn: () => getAgenda(from, to),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
}
