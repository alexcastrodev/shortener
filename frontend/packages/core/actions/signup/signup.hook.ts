import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { signUp } from './signup.service';
import type { SignupBody } from './signup.types';

export function useSignup(
  mutationProps?: UseMutationOptions<void, ResponseError, SignupBody, unknown>
) {
  return useMutation({ mutationFn: signUp, ...mutationProps });
}
