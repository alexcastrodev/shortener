export interface SubmitFormResponseParams {
  publicId: string;
  answers: Record<string, unknown>;
  idempotencyKey: string;
  turnstileToken?: string | null;
  website?: string;
  referer?: string;
}

export interface SubmitFormResponseError {
  status?: number;
  error?: string;
  errors?: { answers?: Record<string, string[]> | string[] };
}
