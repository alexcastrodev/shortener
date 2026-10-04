import type { Form } from '../../types/Form';

export interface SetFormPublishedParams {
  id: number | string;
  published: boolean;
}

export interface SetFormPublishedResponse {
  form: Form;
}
