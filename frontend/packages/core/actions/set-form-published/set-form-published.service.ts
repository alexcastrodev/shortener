import { AxiosError, type AxiosResponse } from 'axios';
import { api } from '../api';
import type {
  SetFormPublishedParams,
  SetFormPublishedResponse,
} from './set-form-published.types';
import type { Form } from '../../types/Form';

export async function setFormPublished({
  id,
  published,
}: SetFormPublishedParams): Promise<Form> {
  try {
    const response: AxiosResponse<SetFormPublishedResponse> = await api.post(
      `/api/me/forms/${id}/${published ? 'publish' : 'unpublish'}`
    );
    return response.data.form;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw error.response?.data;
    }
    throw error;
  }
}
