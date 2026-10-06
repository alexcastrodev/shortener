import {
  useMutation,
  useQuery,
  type UseMutationOptions,
} from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import {
  createCalendarFeed,
  deleteCalendarFeed,
  getCalendarFeed,
  type CalendarFeedState,
} from './calendar-feed.service';

export const getCalendarFeedKey = ['calendar-feed'];

export function useGetCalendarFeed() {
  return useQuery<CalendarFeedState, ResponseError>({
    queryKey: getCalendarFeedKey,
    queryFn: getCalendarFeed,
    retry: false,
  });
}

export function useCreateCalendarFeed(
  props?: UseMutationOptions<{ url: string }, ResponseError, void, unknown>
) {
  return useMutation({ mutationFn: createCalendarFeed, ...props });
}

export function useDeleteCalendarFeed(
  props?: UseMutationOptions<void, ResponseError, void, unknown>
) {
  return useMutation({ mutationFn: deleteCalendarFeed, ...props });
}
