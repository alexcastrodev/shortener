import type { Form } from '../../types/Form';

export interface DiscardFormDraftParams {
  id: number | string;
}

export interface DiscardFormDraftResponse {
  form: Form;
}
