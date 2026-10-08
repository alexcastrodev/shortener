import { Button } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import type { Form } from '@internal/core/types/Form';
import { publishBlockMessage } from '../../../modules/forms/form-errors';

export function PublishChecklist({
  form,
  adding,
  onAddEmail,
  onSelect,
}: {
  form: Form;
  adding: boolean;
  onAddEmail: (required: boolean) => void;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation('forms');
  const blocks = form.publish_blocks.filter(({ code }) => code !== 'no_questions');
  const booking = form.fields.find(field => field.type === 'booking');
  const tip =
    !!booking &&
    !booking.rules?.verify_email &&
    !form.fields.some(field => field.type === 'email');

  if (blocks.length === 0 && !tip) return null;

  const action = (code: string) => {
    if (code === 'no_email')
      return { label: t('ed_checklist_add_email'), run: () => onAddEmail(true) };
    if ((code === 'no_service' || code === 'service_incomplete') && booking)
      return { label: t('ed_checklist_open_booking'), run: () => onSelect(booking.id) };
    return null;
  };

  return (
    <div role="status" className="mb-5 space-y-3">
      {blocks.length > 0 && (
        <section className="rounded-xl border border-primary/50 bg-primary/10 p-4">
          <h3 className="text-sm font-semibold">{t('ed_checklist_title')}</h3>
          <ul className="mt-2 space-y-2">
            {blocks.map(block => {
              const act = action(block.code);
              return (
                <li
                  key={`${block.code}-${block.name ?? ''}`}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <span className="min-w-0 flex-1">{publishBlockMessage(block)}</span>
                  {act && (
                    <Button
                      size="xs"
                      variant="default"
                      disabled={adding}
                      onClick={act.run}
                    >
                      {act.label}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {tip && (
        <section className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-4 text-sm">
          <span className="min-w-0 flex-1 text-muted-foreground">{t('ed_checklist_tip')}</span>
          <Button size="xs" variant="default" disabled={adding} onClick={() => onAddEmail(false)}>
            {t('ed_checklist_add_optional')}
          </Button>
        </section>
      )}
    </div>
  );
}
