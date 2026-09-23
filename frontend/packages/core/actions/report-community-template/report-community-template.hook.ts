import {
  useMutation,
  type QueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { reportCommunityTemplate } from './report-community-template.service';
import type { ReportCommunityTemplateParams } from './report-community-template.types';

export function useReportCommunityTemplate(
  mutationProps?: UseMutationOptions<
    void,
    ResponseError,
    ReportCommunityTemplateParams,
    unknown
  >,
  queryClient?: QueryClient
) {
  return useMutation(
    { mutationFn: reportCommunityTemplate, ...mutationProps },
    queryClient
  );
}
