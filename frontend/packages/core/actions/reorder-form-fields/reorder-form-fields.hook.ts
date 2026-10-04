import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { reorderFormFields } from './reorder-form-fields.service';
import type { ReorderFormFieldsParams } from './reorder-form-fields.types';
import type { Form } from '../../types/Form';

export function useReorderFormFields(
  mutationProps?: UseMutationOptions<Form, ResponseError, ReorderFormFieldsParams, unknown>
) {
  return useMutation({ mutationFn: reorderFormFields, ...mutationProps });
}
