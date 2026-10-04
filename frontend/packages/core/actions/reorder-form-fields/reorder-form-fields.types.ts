import type { Form } from '../../types/Form';

export interface ReorderFormFieldsParams {
  formId: number | string;
  ids: string[];
}

export interface ReorderFormFieldsResponse {
  form: Form;
}
