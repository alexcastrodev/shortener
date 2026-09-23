import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { resetPassword } from './password-reset.service';
import type { PasswordResetBody } from './password-reset.types';
import type { LoginVerifyResponse } from '../login-verify/login-verify.types';

export function usePasswordReset(
  mutationProps?: UseMutationOptions<
    LoginVerifyResponse,
    ResponseError,
    PasswordResetBody,
    unknown
  >
) {
  return useMutation({ mutationFn: resetPassword, ...mutationProps });
}
