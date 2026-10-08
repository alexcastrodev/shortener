import i18n from '../../i18n';

const PUBLISH_BLOCKS = {
  no_questions: 'forms:err_publish_no_questions',
  no_service: 'forms:err_publish_no_service',
  service_incomplete: 'forms:err_publish_service_incomplete',
  waitlist_questions: 'forms:err_publish_waitlist',
  no_email: 'forms:err_publish_no_email',
  no_name: 'forms:err_publish_no_name',
} as const;

type PublishBlock = { code: string; name?: string };

const isKnown = (code: string): code is keyof typeof PUBLISH_BLOCKS => code in PUBLISH_BLOCKS;

export function formErrorMessage(error: unknown) {
  const body = error as
    | {
        error?: string;
        errors?: Record<string, string[] | string>;
        blocks?: PublishBlock[];
      }
    | undefined;
  if (body?.error === 'forms_daily_limit') {
    return i18n.t('forms:ed_daily_limit');
  }
  if (body?.blocks?.length && body.blocks.every(({ code }) => isKnown(code))) {
    return body.blocks
      .map(({ code, name }) => i18n.t(PUBLISH_BLOCKS[code as keyof typeof PUBLISH_BLOCKS], { name }))
      .join(' ');
  }
  if (body?.errors) {
    return Object.entries(body.errors)
      .map(([key, value]) => `${key} ${[value].flat().join(', ')}`)
      .join('; ');
  }
  return i18n.t('forms:ed_generic_error');
}
