import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { updateFormField } from './update-form-field.service';
import type { UpdateFormFieldParams } from './update-form-field.types';
import type { Form } from '../../types/Form';

export function useUpdateFormField(
  mutationProps?: UseMutationOptions<Form, ResponseError, UpdateFormFieldParams, unknown>
) {
  return useMutation({ mutationFn: updateFormField, ...mutationProps });
}
