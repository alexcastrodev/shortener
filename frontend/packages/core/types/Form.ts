import type { CustomColors, PageTheme } from './Page';

export type FormFieldType =
  | 'short_text'
  | 'long_text'
  | 'email'
  | 'number'
  | 'single_choice'
  | 'multiple_choice'
  | 'yes_no'
  | 'rating'
  | 'date'
  | 'image'
  | 'booking'
  | 'section';

export type BookingAnswer = {
  service: string;
  sessions: { date: string; time: string }[];
};

export const FORM_LAYOUTS = ['page', 'one_at_a_time', 'steps'] as const;
export type FormLayout = (typeof FORM_LAYOUTS)[number];

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
  custom_colors?: CustomColors | null;
  layout: FormLayout;
  published: boolean;
  fields: FormField[];
  responses_count: number;
  public_url: string;
  shortlink_id: number | null;
  short_url: string | null;
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

export type FormFieldInput = {
  type?: FormFieldType;
  label?: string;
  help?: string | null;
  required?: boolean;
  choices?: { id?: string; label: string }[];
  max_choices?: number | null;
  scale?: 5 | 10;
  min?: number | null;
  max?: number | null;
};

export type PublicForm = Pick<
  Form,
  'title' | 'description' | 'thank_you_message' | 'theme' | 'custom_colors' | 'layout' | 'fields'
>;

export type FormResponseAnswer = {
  id: string;
  label: string;
  type: FormFieldType;
  value: string | number | boolean | string[] | BookingAnswer | null;
};

export type FormResponse = {
  id: number;
  country: string | null;
  platform: string | null;
  browser: string | null;
  source: string | null;
  submitted_at: string;
  answers: FormResponseAnswer[];
};

export type FormSummaryBucket = { name: string; count: number };

export type FormFieldSummary = {
  id: string;
  type: FormFieldType;
  label: string;
  answered: number;
  samples?: string[];
  min?: number;
  max?: number;
  average?: number | null;
  yes?: number;
  no?: number;
  first?: string;
  last?: string;
  choices?: { id: string | null; label: string; count: number }[];
  distribution?: { rating: number; count: number }[];
};

export type FormSummary = {
  period_days: number | 'all';
  funnel: {
    views: number;
    unique_views: number;
    starts: number;
    completions: number;
    completion_rate: number | null;
  };
  timeline: { date: string; views: number; responses: number }[];
  audience: {
    sources: FormSummaryBucket[];
    devices: FormSummaryBucket[];
    browsers: FormSummaryBucket[];
    countries: FormSummaryBucket[];
  };
  fields: FormFieldSummary[];
};

export type FormSummaryPeriod = 7 | 30 | 90 | 'all';
