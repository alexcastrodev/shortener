import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { getManageUsers } from './get-manage-users.service';
import type {
  GetManageUsersParams,
  GetManageUsersResponse,
} from './get-manage-users.types';

export function getManageUsersKey(params?: GetManageUsersParams) {
  return ['get-manage-users', params ?? {}];
}

export function useGetManageUsers(
  params?: GetManageUsersParams,
  queryProps?: UseQueryOptions<GetManageUsersResponse, ResponseError>
) {
  return useQuery<GetManageUsersResponse, ResponseError>({
    queryKey: getManageUsersKey(params),
    queryFn: () => getManageUsers(params),
    ...queryProps,
  });
}
