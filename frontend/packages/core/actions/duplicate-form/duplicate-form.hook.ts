import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { duplicateForm } from './duplicate-form.service';
import type { DuplicateFormParams } from './duplicate-form.types';
import type { Form } from '../../types/Form';

export function useDuplicateForm(
  mutationProps?: UseMutationOptions<Form, ResponseError, DuplicateFormParams, unknown>
) {
  return useMutation({ mutationFn: duplicateForm, ...mutationProps });
}
