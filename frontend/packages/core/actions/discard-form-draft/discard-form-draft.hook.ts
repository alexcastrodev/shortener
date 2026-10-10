import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { discardFormDraft } from './discard-form-draft.service';
import type { DiscardFormDraftParams } from './discard-form-draft.types';
import type { Form } from '../../types/Form';

export function useDiscardFormDraft(
  mutationProps?: UseMutationOptions<Form, ResponseError, DiscardFormDraftParams, unknown>
) {
  return useMutation({ mutationFn: discardFormDraft, ...mutationProps });
}
