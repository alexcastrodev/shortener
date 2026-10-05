import {
  useMutation,
  type QueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { updateProfile } from './update-profile.service';
import type { UpdateProfileRequestBody } from './update-profile.types';
import type { User } from '../../types/User';

export function useUpdateProfile(
  mutationProps?: UseMutationOptions<
    User,
    ResponseError,
    UpdateProfileRequestBody,
    unknown
  >,
  queryClient?: QueryClient
) {
  return useMutation(
    {
      mutationFn: updateProfile,
      ...mutationProps,
    },
    queryClient
  );
}
