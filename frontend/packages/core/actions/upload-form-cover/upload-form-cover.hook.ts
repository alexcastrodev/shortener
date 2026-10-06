import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { uploadFormCover } from './upload-form-cover.service';
import type { Form } from '../../types/Form';

export function useUploadFormCover(
  mutationProps?: UseMutationOptions<
    Form,
    ResponseError,
    { id: number | string; file: File },
    unknown
  >
) {
  return useMutation({ mutationFn: uploadFormCover, ...mutationProps });
}
