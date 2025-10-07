import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import type { LoginRequestRequestBody } from './login-request.types';
import { loginRequest } from './login-request.service';

export function useLoginRequest(
  mutationProps?: UseMutationOptions<
    void,
    ResponseError,
    LoginRequestRequestBody,
    unknown
  >
) {
  return useMutation({
    mutationFn: loginRequest,
    ...mutationProps,
  });
}
