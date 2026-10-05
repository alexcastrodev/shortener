import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { deleteAccount } from './delete-account.service';
import type { DeleteAccountBody, DeleteAccountResponse } from './delete-account.types';

export function useDeleteAccount(
  mutationProps?: UseMutationOptions<DeleteAccountResponse, ResponseError, DeleteAccountBody, unknown>
) {
  return useMutation({ mutationFn: deleteAccount, ...mutationProps });
}
