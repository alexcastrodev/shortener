import type { Form } from '../../types/Form';
import type { PageTheme } from '../../types/Page';

export interface UpdateFormRequestBody {
  title?: string;
  description?: string | null;
  thank_you_message?: string | null;
  theme?: PageTheme;
}

export interface UpdateFormParams {
  id: number | string;
  data: UpdateFormRequestBody;
}

export interface UpdateFormResponse {
  form: Form;
}
