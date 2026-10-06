import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import type { GetNotificationPreferencesResponse } from '../get-notification-preferences/get-notification-preferences.types';
import { updateNotificationPreferences } from './update-notification-preferences.service';
import type { UpdateNotificationPreferencesParams } from './update-notification-preferences.types';

export function useUpdateNotificationPreferences(
  mutationProps?: UseMutationOptions<
    GetNotificationPreferencesResponse,
    ResponseError,
    UpdateNotificationPreferencesParams,
    unknown
  >
) {
  return useMutation({
    mutationFn: updateNotificationPreferences,
    ...mutationProps,
  });
}
