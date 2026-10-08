import { ActionIcon, Button, Group, Select, Stack } from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';
import { modals } from '@mantine/modals';
import { IconX } from '@tabler/icons-react';
import { useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MAX_CATEGORIES,
  isGrouped,
  newCategoryId,
  removeCategory,
  type Values,
} from '../../../modules/forms/booking-config.ts';

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

const keepEnter = (event: KeyboardEvent<HTMLInputElement>) => {
  if (event.key === 'Enter') event.preventDefault();
};

export function CategoriesSection({
  form,
}: {
  form: UseFormReturnType<Values>;
}) {
  const { t } = useTranslation('booking');
  const [draft, setDraft] = useState('');
  const { categories } = form.values;
  const errors = categories
    .map((_, index) => form.errors[`categories.${index}.name`])
    .filter(Boolean);

  const add = () => {
    const name = draft.trim();
    setDraft('');
    if (!name || categories.length >= MAX_CATEGORIES) return;
    const values = form.getValues();
    const id = newCategoryId();
    const first = values.categories[0]?.id ?? id;
    form.setValues({
      categories: [...values.categories, { id, name }],
      services: values.services.map(service =>
        values.categories.some(item => item.id === service.categoryId)
          ? service
          : { ...service, categoryId: first }
      ),
    });
  };

  const remove = (id: string) => {
    const values = form.getValues();
    if (values.categories.length === 1) {
      form.setValues({
        categories: [],
        services: values.services.map(service => ({
          ...service,
          categoryId: '',
        })),
      });
      return;
    }
    modals.open({
      title: t('category_remove_title'),
      centered: true,
      children: (
        <MoveAndRemove
          options={values.categories
            .filter(item => item.id !== id)
            .map(item => ({
              value: item.id,
              label: item.name || t('category_new'),
            }))}
          onConfirm={moveTo =>
            form.setValues(removeCategory(form.getValues(), id, moveTo))
          }
        />
      ),
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {t('categories_label')}
        </span>
        {categories.map((category, index) => (
          <div
            key={category.id}
            className={`flex max-w-full items-center rounded-full border py-0.5 pl-3 pr-1 focus-within:border-primary ${
              form.errors[`categories.${index}.name`]
                ? 'border-red-500'
                : 'border-border'
            }`}
          >
            <input
              aria-label={t('category_name')}
              aria-invalid={Boolean(form.errors[`categories.${index}.name`])}
              className="min-w-0 bg-transparent text-sm outline-none"
              size={Math.max(category.name.length, 4)}
              maxLength={60}
              value={category.name}
              onKeyDown={keepEnter}
              onChange={event =>
                form.setFieldValue(
                  `categories.${index}.name`,
                  event.currentTarget.value
                )
              }
            />
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              radius="xl"
              aria-label={t('category_remove', {
                name: category.name || t('category_new'),
              })}
              onClick={() => remove(category.id)}
            >
              <IconX size={12} />
            </ActionIcon>
          </div>
        ))}
        {categories.length < MAX_CATEGORIES && (
          <input
            aria-label={t('category_new')}
            placeholder={`+ ${t('category_new')}`}
            className="w-40 max-w-full rounded-full border border-dashed border-border bg-transparent px-3 py-1 text-sm outline-none focus:border-primary"
            maxLength={60}
            value={draft}
            onChange={event => setDraft(event.currentTarget.value)}
            onKeyDown={event => {
              keepEnter(event);
              if (event.key === 'Enter') add();
            }}
            onBlur={add}
          />
        )}
      </div>
      {errors.length > 0 && (
        <p className="mt-1 text-xs text-red-500">{errors[0]}</p>
      )}
      {isGrouped(form.values) && (
        <p className="mt-1 text-xs text-muted-foreground">
          {t('categories_hint')}
        </p>
      )}
    </div>
  );
}
