import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import { readAllNotifications } from './read-all-notifications.service';

export function useReadAllNotifications(
  mutationProps?: UseMutationOptions<void, unknown, void, unknown>
) {
  return useMutation({ mutationFn: readAllNotifications, ...mutationProps });
}
