import type { Form, FormFieldInput } from '../../types/Form';

export interface CreateFormFieldParams {
  formId: number | string;
  data: FormFieldInput;
}

export interface CreateFormFieldResponse {
  form: Form;
}
