import { useTranslation } from 'react-i18next';
import { ItemsSection } from '../../items-section';
import type { FlowProps } from '../editor-mode';
import { CategoriesSection } from './categories-section';

export function ServicesFlow(props: FlowProps) {
  const { t } = useTranslation('booking');

  return (
    <ItemsSection
      {...props}
      title={t('services_title')}
      count={t('category_count', { count: props.form.values.services.length })}
      empty={t('no_services')}
      addLabel={t('service_add')}
      before={<CategoriesSection form={props.form} />}
    />
  );
}
