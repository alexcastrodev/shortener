import {
  ActionIcon,
  Button,
  Group,
  SegmentedControl,
  Select,
  Stack,
  Tabs,
  TextInput,
} from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';
import { modals } from '@mantine/modals';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MAX_CATEGORIES,
  blankService,
  isGrouped,
  newCategoryId,
  removeCategory,
  splitIntoCategories,
  type ServiceValues,
  type Values,
} from '../../../modules/forms/booking-config.ts';

type Props = {
  form: UseFormReturnType<Values>;
  renderService: (service: ServiceValues, index: number) => ReactNode;
};

function MoveAndRemove({
  options,
  onConfirm,
}: {
  options: { value: string; label: string }[];
  onConfirm: (moveTo: string) => void;
}) {
  const { t } = useTranslation('booking');
  const [moveTo, setMoveTo] = useState<string | null>(
    options[0]?.value ?? null
  );
  return (
    <Stack gap="sm">
      <p className="text-sm">{t('category_remove_body')}</p>
      <Select
        label={t('category_move_to')}
        allowDeselect={false}
        data={options}
        value={moveTo}
        onChange={setMoveTo}
      />
      <Group justify="flex-end" gap="xs">
        <Button variant="default" onClick={() => modals.closeAll()}>
          {t('category_remove_cancel')}
        </Button>
        <Button
          color="red"
          disabled={!moveTo}
          onClick={() => {
            if (moveTo) onConfirm(moveTo);
            modals.closeAll();
          }}
        >
          {t('category_remove_confirm')}
        </Button>
      </Group>
    </Stack>
  );
}

export function CategoriesSection({ form, renderService }: Props) {
  const { t } = useTranslation('booking');
  const [view, setView] = useState<'sections' | 'tabs'>('sections');
  const [active, setActive] = useState<string | null>(null);
  const { services, categories } = form.values;
  const grouped = isGrouped(form.values);

  const addService = (categoryId: string) =>
    form.insertListItem('services', blankService(t('service_new'), categoryId));

  const confirmRemove = (id: string) => {
    const options = categories
      .filter(item => item.id !== id)
      .map(item => ({ value: item.id, label: item.name || t('category_new') }));
    modals.open({
      title: t('category_remove_title'),
      centered: true,
      children: (
        <MoveAndRemove
          options={options}
          onConfirm={moveTo => {
            form.setValues(removeCategory(form.values, id, moveTo));
            setActive(null);
          }}
        />
      ),
    });
  };

  const addCategory = () => {
    const id = newCategoryId();
    form.insertListItem('categories', { id, name: t('category_new') });
    setActive(id);
  };

  const list = (categoryId: string | null) => {
    const own = services
      .map((service, index) => ({ service, index }))
      .filter(
        entry => categoryId === null || entry.service.categoryId === categoryId
      );
    return own.map(entry => renderService(entry.service, entry.index));
  };

  const header = (index: number) => {
    const category = categories[index];
    const count = services.filter(
      item => item.categoryId === category.id
    ).length;
    return (
      <Group gap="xs" wrap="nowrap" align="flex-end">
        <TextInput
          className="flex-1"
          label={t('category_name')}
          {...form.getInputProps(`categories.${index}.name`)}
        />
        <p className="pb-2 text-xs text-muted-foreground">
          {t('category_count', { count })}
        </p>
        <ActionIcon
          variant="subtle"
          color="red"
          size="lg"
          aria-label={t('category_remove', {
            name: category.name || t('category_new'),
          })}
          onClick={() => confirmRemove(category.id)}
        >
          <IconTrash size={16} />
        </ActionIcon>
      </Group>
    );
  };

  const body = (index: number) => {
    const category = categories[index];
    return (
      <Stack gap="md" className="rounded-lg border border-border p-4">
        {header(index)}
        {list(category.id)}
        <div>
          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => addService(category.id)}
          >
            {t('service_add_in', {
              name: category.name || t('category_new'),
            })}
          </Button>
        </div>
      </Stack>
    );
  };

  if (!grouped) {
    return (
      <>
        {services.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            {t('no_services')}
          </p>
        )}
        {list(null)}
        <Group gap="xs">
          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => addService(categories[0]?.id ?? '')}
          >
            {t('service_add')}
          </Button>
          <Button
            variant="subtle"
            size="xs"
            color="gray"
            onClick={() =>
              form.setValues(
                splitIntoCategories(form.values, [
                  t('category_first'),
                  t('category_second'),
                ])
              )
            }
          >
            {t('categories_separate')}
          </Button>
        </Group>
      </>
    );
  }

  const current = categories.some(item => item.id === active)
    ? active
    : categories[0].id;

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <p className="text-xs text-muted-foreground">{t('categories_hint')}</p>
        <SegmentedControl
          size="xs"
          aria-label={t('categories_view')}
          value={view}
          onChange={value => setView(value as 'sections' | 'tabs')}
          data={[
            { value: 'sections', label: t('categories_view_sections') },
            { value: 'tabs', label: t('categories_view_tabs') },
          ]}
        />
      </Group>
      {view === 'sections' ? (
        categories.map((category, index) => (
          <div key={category.id}>{body(index)}</div>
        ))
      ) : (
        <Tabs value={current} onChange={setActive}>
          <Tabs.List>
            {categories.map(category => (
              <Tabs.Tab key={category.id} value={category.id}>
                {category.name || t('category_new')}
              </Tabs.Tab>
            ))}
          </Tabs.List>
          {categories.map((category, index) => (
            <Tabs.Panel key={category.id} value={category.id} pt="sm">
              {body(index)}
            </Tabs.Panel>
          ))}
        </Tabs>
      )}
      {categories.length < MAX_CATEGORIES && (
        <div>
          <Button
            variant="default"
            size="xs"
            style={{ borderStyle: 'dashed' }}
            leftSection={<IconPlus size={14} />}
            onClick={addCategory}
          >
            {t('category_add')}
          </Button>
        </div>
      )}
    </Stack>
  );
}
