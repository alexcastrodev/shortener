import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import { submitFormResponse } from './submit-form-response.service';
import type {
  SubmitFormReceipt,
  SubmitFormResponseError,
  SubmitFormResponseParams,
} from './submit-form-response.types';

export function useSubmitFormResponse(
  mutationProps?: UseMutationOptions<
    SubmitFormReceipt,
    SubmitFormResponseError,
    SubmitFormResponseParams,
    unknown
  >
) {
  return useMutation({ mutationFn: submitFormResponse, ...mutationProps });
}
