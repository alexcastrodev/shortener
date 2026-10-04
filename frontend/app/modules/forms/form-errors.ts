export function formErrorMessage(error: unknown) {
  const body = error as
    | { error?: string; errors?: Record<string, string[] | string> }
    | undefined;
  if (body?.error === 'forms_daily_limit') {
    return 'You reached the limit of 20 new forms per day. Try again tomorrow.';
  }
  if (body?.errors) {
    return Object.entries(body.errors)
      .map(([key, value]) => `${key} ${[value].flat().join(', ')}`)
      .join('; ');
  }
  return 'Something went wrong, please try again later.';
}
