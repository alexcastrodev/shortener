import { AxiosError, type AxiosResponse } from 'axios';
import { api } from '../api';
import type {
  DiscardFormDraftParams,
  DiscardFormDraftResponse,
} from './discard-form-draft.types';
import type { Form } from '../../types/Form';

export async function discardFormDraft({ id }: DiscardFormDraftParams): Promise<Form> {
  try {
    const response: AxiosResponse<DiscardFormDraftResponse> = await api.post(
      `/api/me/forms/${id}/discard`
    );
    return response.data.form;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw error.response?.data;
    }
    throw error;
  }
}
