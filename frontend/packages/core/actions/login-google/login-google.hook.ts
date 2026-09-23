import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { loginWithGoogle } from './login-google.service';
import type { LoginGoogleBody } from './login-google.types';
import type { LoginVerifyResponse } from '../login-verify/login-verify.types';

export function useLoginGoogle(
  mutationProps?: UseMutationOptions<
    LoginVerifyResponse,
    ResponseError,
    LoginGoogleBody,
    unknown
  >
) {
  return useMutation({ mutationFn: loginWithGoogle, ...mutationProps });
}
