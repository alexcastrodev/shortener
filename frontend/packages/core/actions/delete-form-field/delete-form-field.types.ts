import type { Form } from '../../types/Form';

export interface DeleteFormFieldParams {
  formId: number | string;
  fieldId: string;
}

export interface DeleteFormFieldResponse {
  form: Form;
}
