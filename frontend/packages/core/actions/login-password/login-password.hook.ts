import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { loginWithPassword } from './login-password.service';
import type { LoginPasswordBody } from './login-password.types';
import type { LoginVerifyResponse } from '../login-verify/login-verify.types';

export function useLoginPassword(
  mutationProps?: UseMutationOptions<
    LoginVerifyResponse,
    ResponseError,
    LoginPasswordBody,
    unknown
  >
) {
  return useMutation({ mutationFn: loginWithPassword, ...mutationProps });
}
