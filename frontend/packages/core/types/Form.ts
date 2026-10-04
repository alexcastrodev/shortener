import type { PageTheme } from './Page';

export type FormFieldType =
  | 'short_text'
  | 'long_text'
  | 'email'
  | 'number'
  | 'single_choice'
  | 'multiple_choice'
  | 'yes_no'
  | 'rating'
  | 'date';

export type FormChoice = { id: string; label: string };

export type FormField = {
  id: string;
  type: FormFieldType;
  label: string;
  help?: string;
  required?: boolean;
  choices?: FormChoice[];
  max_choices?: number;
  scale?: 5 | 10;
  min?: number;
  max?: number;
};

export type Form = {
  id: number;
  public_id: string;
  title: string;
  description: string | null;
  thank_you_message: string | null;
  theme: PageTheme;
  published: boolean;
  fields: FormField[];
  responses_count: number;
  public_url: string;
  created_at: string;
  updated_at: string;
};

export type FormTemplate = {
  id: string;
  name: string;
  description: string;
  theme: PageTheme;
  questions: number;
};
