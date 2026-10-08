import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import { createBookingManageLink } from './create-booking-manage-link.service';
import type { CreateBookingManageLinkResponse } from './create-booking-manage-link.types';

export function useCreateBookingManageLink(
  mutationProps?: UseMutationOptions<
    CreateBookingManageLinkResponse,
    unknown,
    string,
    unknown
  >
) {
  return useMutation({
    mutationFn: createBookingManageLink,
    ...mutationProps,
  });
}
