import { useQuery } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { getPushConfig, type PushConfig } from './get-push-config.service';

export const getPushConfigKey = ['get-push-config'];

export function useGetPushConfig(enabled: boolean) {
  return useQuery<PushConfig, ResponseError>({
    queryKey: getPushConfigKey,
    queryFn: getPushConfig,
    enabled,
    retry: false,
  });
}
