import type { Form, FormFieldInput } from '../../types/Form';

export interface UpdateFormFieldParams {
  formId: number | string;
  fieldId: string;
  data: FormFieldInput;
}

export interface UpdateFormFieldResponse {
  form: Form;
}
