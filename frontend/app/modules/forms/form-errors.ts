import i18n from '../../i18n';
import type { PublishBlock } from '@internal/core/types/Form';

const PUBLISH_BLOCKS = {
  no_questions: 'forms:err_publish_no_questions',
  no_service: 'forms:err_publish_no_service',
  service_incomplete: 'forms:err_publish_service_incomplete',
  waitlist_questions: 'forms:err_publish_waitlist',
  no_email: 'forms:err_publish_no_email',
} as const;

const isKnown = (code: string): code is keyof typeof PUBLISH_BLOCKS => code in PUBLISH_BLOCKS;

export const publishBlockMessage = ({ code, name }: PublishBlock) =>
  i18n.t(PUBLISH_BLOCKS[code as keyof typeof PUBLISH_BLOCKS], { name });

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
    return body.blocks.map(publishBlockMessage).join(' ');
  }
  if (body?.errors) {
    return Object.entries(body.errors)
      .map(([key, value]) => `${key} ${[value].flat().join(', ')}`)
      .join('; ');
  }
  return i18n.t('forms:ed_generic_error');
}
