import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { getLoggedUser } from './get-logged-user.service';
import type { GetLoggedUserResponse } from './get-logged-user.types';

export const getLoggedUserKey = ['get-logged-user'];

export function useGetLoggedUser(
  queryProps?: UseQueryOptions<GetLoggedUserResponse, ResponseError>
) {
  return useQuery<GetLoggedUserResponse, ResponseError>({
    queryKey: getLoggedUserKey,
    queryFn: getLoggedUser,
    ...queryProps,
  });
}
