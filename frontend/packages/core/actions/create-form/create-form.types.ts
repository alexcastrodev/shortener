import type { Form } from '../../types/Form';
import type { PageTheme } from '../../types/Page';

export interface CreateFormRequestBody {
  title: string;
  description?: string;
  thank_you_message?: string;
  theme?: PageTheme;
  template?: string;
  locale?: string;
}

export interface CreateFormResponse {
  form: Form;
}
