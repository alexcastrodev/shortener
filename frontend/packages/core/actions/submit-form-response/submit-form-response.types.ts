export interface SubmitFormResponseParams {
  publicId: string;
  answers: Record<string, unknown>;
  idempotencyKey: string;
  turnstileToken?: string | null;
  website?: string;
  referer?: string;
  clientTimeZone?: string;
  clientLocale?: string;
}

export interface SubmitFormReceipt {
  manage_url?: string;
  email_delivery?: 'queued' | 'none';
}

export interface SubmitFormResponseError {
  status?: number;
  error?: string;
  errors?: { answers?: Record<string, string[]> | string[] };
}
