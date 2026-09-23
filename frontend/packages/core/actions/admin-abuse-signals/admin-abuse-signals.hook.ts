import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { getAdminAbuseSignals } from './admin-abuse-signals.service';
import type {
  AbuseSignalStatus,
  AdminAbuseSignalsResponse,
} from './admin-abuse-signals.types';

export function adminAbuseSignalsKey(status?: AbuseSignalStatus) {
  return status ? ['admin-abuse-signals', status] : ['admin-abuse-signals'];
}

export function useAdminAbuseSignals(
  status: AbuseSignalStatus,
  queryProps?: Partial<
    UseQueryOptions<AdminAbuseSignalsResponse, ResponseError>
  >
) {
  return useQuery<AdminAbuseSignalsResponse, ResponseError>({
    queryKey: adminAbuseSignalsKey(status),
    queryFn: () => getAdminAbuseSignals(status),
    ...queryProps,
  });
}
