import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { updateForm } from './update-form.service';
import type { UpdateFormParams } from './update-form.types';
import type { Form } from '../../types/Form';

export function useUpdateForm(
  mutationProps?: UseMutationOptions<Form, ResponseError, UpdateFormParams, unknown>
) {
  return useMutation({ mutationFn: updateForm, ...mutationProps });
}
