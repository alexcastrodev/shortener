import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { updatePassword } from './update-password.service';
import type { UpdatePasswordBody } from './update-password.types';
import type { LoginVerifyResponse } from '../login-verify/login-verify.types';

export function useUpdatePassword(
  mutationProps?: UseMutationOptions<
    LoginVerifyResponse,
    ResponseError,
    UpdatePasswordBody,
    unknown
  >
) {
  return useMutation({ mutationFn: updatePassword, ...mutationProps });
}
