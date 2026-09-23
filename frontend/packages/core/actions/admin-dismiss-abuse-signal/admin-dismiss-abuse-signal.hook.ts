import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { dismissAbuseSignal } from './admin-dismiss-abuse-signal.service';

export function useDismissAbuseSignal(
  mutationProps?: UseMutationOptions<void, ResponseError, number, unknown>
) {
  return useMutation({ mutationFn: dismissAbuseSignal, ...mutationProps });
}
