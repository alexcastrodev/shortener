import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { setFormPublished } from './set-form-published.service';
import type { SetFormPublishedParams } from './set-form-published.types';
import type { Form } from '../../types/Form';

export function useSetFormPublished(
  mutationProps?: UseMutationOptions<Form, ResponseError, SetFormPublishedParams, unknown>
) {
  return useMutation({ mutationFn: setFormPublished, ...mutationProps });
}
