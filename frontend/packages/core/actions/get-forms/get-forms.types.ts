import type { Form } from '../../types/Form';

export type FormsStatus = 'all' | 'live' | 'draft';
export type FormsSort = 'edited' | 'name' | 'responses';

export interface GetFormsParams {
  q?: string;
  status?: FormsStatus;
  sort?: FormsSort;
}

export interface FormsMeta {
  total: number;
  live: number;
  draft: number;
  responses: number;
}

export interface GetFormsResponse {
  form: Form[];
  meta: FormsMeta;
}
