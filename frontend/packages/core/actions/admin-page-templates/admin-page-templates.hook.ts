import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { getAdminPageTemplates } from './admin-page-templates.service';
import type {
  AdminPageTemplatesResponse,
  AdminPageTemplatesStatus,
} from './admin-page-templates.types';

export function adminPageTemplatesKey(status?: AdminPageTemplatesStatus) {
  return status ? ['admin-page-templates', status] : ['admin-page-templates'];
}

export function useAdminPageTemplates(
  status: AdminPageTemplatesStatus,
  queryProps?: Partial<
    UseQueryOptions<AdminPageTemplatesResponse, ResponseError>
  >
) {
  return useQuery<AdminPageTemplatesResponse, ResponseError>({
    queryKey: adminPageTemplatesKey(status),
    queryFn: () => getAdminPageTemplates(status),
    ...queryProps,
  });
}
