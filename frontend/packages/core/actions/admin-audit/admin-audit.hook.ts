import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { getAdminAudits } from './admin-audit.service';
import type {
  AdminGetAuditsParams,
  AdminGetAuditsResponse,
} from './admin-audit.types';

export function adminGetAuditsKey(params?: AdminGetAuditsParams) {
  return ['admin-get-audits', params ?? {}];
}

export function useAdminGetAudits(
  params?: AdminGetAuditsParams,
  queryProps?: UseQueryOptions<AdminGetAuditsResponse, ResponseError>
) {
  return useQuery<AdminGetAuditsResponse, ResponseError>({
    queryKey: adminGetAuditsKey(params),
    queryFn: () => getAdminAudits(params),
    ...queryProps,
  });
}
