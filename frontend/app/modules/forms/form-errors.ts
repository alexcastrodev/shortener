import i18n from '../../i18n';

export function formErrorMessage(error: unknown) {
  const body = error as
    | { error?: string; errors?: Record<string, string[] | string> }
    | undefined;
  if (body?.error === 'forms_daily_limit') {
    return i18n.t('forms:ed_daily_limit');
  }
  if (body?.errors) {
    return Object.entries(body.errors)
      .map(([key, value]) => `${key} ${[value].flat().join(', ')}`)
      .join('; ');
  }
  return i18n.t('forms:ed_generic_error');
}
