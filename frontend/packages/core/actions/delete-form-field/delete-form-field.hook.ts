import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { deleteFormField } from './delete-form-field.service';
import type { DeleteFormFieldParams } from './delete-form-field.types';
import type { Form } from '../../types/Form';

export function useDeleteFormField(
  mutationProps?: UseMutationOptions<Form, ResponseError, DeleteFormFieldParams, unknown>
) {
  return useMutation({ mutationFn: deleteFormField, ...mutationProps });
}
