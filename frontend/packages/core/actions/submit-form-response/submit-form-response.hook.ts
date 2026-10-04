import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import { submitFormResponse } from './submit-form-response.service';
import type {
  SubmitFormResponseError,
  SubmitFormResponseParams,
} from './submit-form-response.types';

export function useSubmitFormResponse(
  mutationProps?: UseMutationOptions<
    void,
    SubmitFormResponseError,
    SubmitFormResponseParams,
    unknown
  >
) {
  return useMutation({ mutationFn: submitFormResponse, ...mutationProps });
}
