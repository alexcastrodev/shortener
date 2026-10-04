import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { createFormField } from './create-form-field.service';
import type { CreateFormFieldParams } from './create-form-field.types';
import type { Form } from '../../types/Form';

export function useCreateFormField(
  mutationProps?: UseMutationOptions<Form, ResponseError, CreateFormFieldParams, unknown>
) {
  return useMutation({ mutationFn: createFormField, ...mutationProps });
}
