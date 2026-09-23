import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { updatePage } from './update-page.service';
import type { UpdatePageParams } from './update-page.types';
import type { Page } from '../../types/Page';

export function useUpdatePage(
  mutationProps?: UseMutationOptions<
    Page,
    ResponseError,
    UpdatePageParams,
    unknown
  >
) {
  return useMutation({ mutationFn: updatePage, ...mutationProps });
}
