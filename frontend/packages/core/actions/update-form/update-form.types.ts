import type { Form, FormLayout } from '../../types/Form';
import type { CustomColors, PageTheme } from '../../types/Page';

export interface UpdateFormRequestBody {
  title?: string;
  description?: string | null;
  thank_you_message?: string | null;
  theme?: PageTheme;
  custom_colors?: CustomColors | null;
  layout?: FormLayout;
  cover_position?: number;
  intro_enabled?: boolean;
  start_label?: string | null;
}

export interface UpdateFormParams {
  id: number | string;
  data: UpdateFormRequestBody;
}

export interface UpdateFormResponse {
  form: Form;
}
