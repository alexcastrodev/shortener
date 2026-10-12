import { useTranslation } from 'react-i18next';
import { availabilityRequired, scheduleSummary } from '@internal/booking';
import { ItemsSection } from '../../items-section';
import { ScheduleFields } from '../../schedule-fields';
import type { FlowProps } from '../editor-mode';

export function IndividualFlow(props: FlowProps) {
  const { t } = useTranslation('booking');
  const { form, dayLabels } = props;
  const { services, availability } = form.values;
  const availabilitySummary = scheduleSummary(availability, {
    times: count => t('summary_times', { count }),
    ownTimes: days => t('summary_own_times', { days }),
    day: day => dayLabels[day],
  });

  return (
    <>
      <section
        aria-labelledby="booking-availability-title"
        className="flex flex-col gap-4 border-t border-border pt-6"
      >
        <div>
          <h3 id="booking-availability-title" className="text-sm font-medium">
            {t('availability_title')}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t('availability_hint')}
          </p>
          {services.length > 0 && !availabilityRequired(services) && (
            <p className="text-xs text-muted-foreground">
              {t('availability_optional')}
            </p>
          )}
          <p className="break-words text-xs text-muted-foreground">
            {availabilitySummary}
          </p>
        </div>
        <ScheduleFields
          form={form}
          path="availability"
          duration={Number(services[0]?.duration) || 60}
          dayLabels={dayLabels}
        />
      </section>
      <ItemsSection
        {...props}
        title={t('lessons_title')}
        count={t('lesson_count', { count: services.length })}
        empty={t('no_lessons')}
        addLabel={t('lesson_add')}
      />
    </>
  );
}
