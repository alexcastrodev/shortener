import type { Form } from '../../types/Form';

export interface DuplicateFormParams {
  id: number | string;
}

export interface DuplicateFormResponse {
  form: Form;
}
