import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { getManageUsers } from './get-manage-users.service';
import type { GetManageUsersResponse } from './get-manage-users.types';

export const getManageUsersKey = ['get-manage-users'];

export function useGetManageUsers(
  queryProps?: UseQueryOptions<GetManageUsersResponse, ResponseError>
) {
  return useQuery<GetManageUsersResponse, ResponseError>({
    queryKey: getManageUsersKey,
    queryFn: getManageUsers,
    ...queryProps,
  });
}
