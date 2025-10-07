import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { loginVerifyRequest } from './login-verify.service';
import type { LoginVerifyRequestBody, LoginVerifyResponse } from './login-verify.types';

export function useLoginVerifyRequest(
  mutationProps?: UseMutationOptions<
    LoginVerifyResponse,
    ResponseError,
    LoginVerifyRequestBody,
    unknown
  >
) {
  return useMutation({
    mutationFn: loginVerifyRequest,
    ...mutationProps,
  });
}
