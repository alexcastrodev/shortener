import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { reorderPageLinks } from './reorder-page-links.service';
import type { ReorderPageLinksParams } from './reorder-page-links.types';
import type { PageLink } from '../../types/Page';

export function useReorderPageLinks(
  mutationProps?: UseMutationOptions<
    PageLink[],
    ResponseError,
    ReorderPageLinksParams,
    unknown
  >
) {
  return useMutation({ mutationFn: reorderPageLinks, ...mutationProps });
}
