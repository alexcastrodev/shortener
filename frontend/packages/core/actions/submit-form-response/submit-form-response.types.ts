export interface SubmitFormResponseParams {
  publicId: string;
  answers: Record<string, unknown>;
  idempotencyKey: string;
  turnstileToken?: string | null;
  website?: string;
  referer?: string;
  clientTimeZone?: string;
  clientLocale?: string;
  confirmFieldId?: string | null;
}

export interface SubmitFormReceipt {
  manage_url?: string;
  email_delivery?: 'queued' | 'none';
  skipped?: string[];
  appointments?: { starts_at: string; service: string; status: string }[];
  price?: { total: number; currency: string; free_sessions?: number };
}

export interface SubmitFormResponseError {
  status?: number;
  error?: string;
  errors?: { answers?: Record<string, string[]> | string[] };
}
