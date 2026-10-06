import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import { readNotification } from './read-notification.service';

export function useReadNotification(
  mutationProps?: UseMutationOptions<void, unknown, number, unknown>
) {
  return useMutation({ mutationFn: readNotification, ...mutationProps });
}
