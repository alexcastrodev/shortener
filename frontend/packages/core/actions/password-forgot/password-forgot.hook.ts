import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { requestPasswordReset } from './password-forgot.service';
import type { PasswordForgotBody } from './password-forgot.types';

export function usePasswordForgot(
  mutationProps?: UseMutationOptions<
    void,
    ResponseError,
    PasswordForgotBody,
    unknown
  >
) {
  return useMutation({ mutationFn: requestPasswordReset, ...mutationProps });
}
