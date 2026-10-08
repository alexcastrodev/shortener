import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from '@hello-pangea/dnd';
import { ActionIcon, Group } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconArrowDown,
  IconArrowUp,
  IconCopy,
  IconGripVertical,
  IconTrash,
} from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../../i18n';
import { Card } from '@internal/ui';
import { getFormKey } from '@internal/core/actions/get-form/get-form.hook';
import { getFormsKey } from '@internal/core/actions/get-forms/get-forms.hook';
import { useCreateFormField } from '@internal/core/actions/create-form-field/create-form-field.hook';
import { useUpdateFormField } from '@internal/core/actions/update-form-field/update-form-field.hook';
import { useDeleteFormField } from '@internal/core/actions/delete-form-field/delete-form-field.hook';
import { useReorderFormFields } from '@internal/core/actions/reorder-form-fields/reorder-form-fields.hook';
import type {
  Form,
  FormField,
  FormFieldInput,
  FormFieldType,
} from '@internal/core/types/Form';
import {
  FIELD_GROUPS,
  FIELD_ICONS,
  fieldTypeHint,
  fieldTypeLabel,
  isChoiceType,
  isSection,
} from '../../../modules/forms/field-types';
import {
  blankService,
  initialValues,
  toBookingInput,
} from '../../../modules/forms/booking-config.ts';
import { formErrorMessage } from '../../../modules/forms/form-errors';
import { PublishChecklist } from './publish-checklist';
import { QuestionEditor } from './question-editor';

const bookingServices = () => {
  const values = initialValues();
  values.services = [blankService(i18n.t('booking:service_default'))];
  return toBookingInput(values, true).services;
};

const defaultsFor = (type: FormFieldType): FormFieldInput => ({
  type,
  label:
    type === 'section'
      ? i18n.t('forms:ed_new_section')
      : type === 'booking'
        ? i18n.t('forms:ed_new_booking')
        : i18n.t('forms:ed_new_question'),
  ...(isChoiceType(type)
    ? { choices: [1, 2, 3].map(n => ({ label: i18n.t('forms:ed_new_option', { n }) })) }
    : {}),
  ...(type === 'rating' ? { scale: 5 as const } : {}),
  ...(type === 'booking' ? { services: bookingServices() } : {}),
});

const copyOf = (field: FormField): FormFieldInput => ({
  type: field.type,
  label: i18n.t('forms:ed_copy_suffix', { label: field.label }).slice(0, 300),
  help: field.help,
  required: field.required,
  max_choices: field.max_choices,
  scale: field.scale,
  min: field.min,
  max: field.max,
  choices: field.choices?.map(({ label }) => ({ label })),
});

export function QuestionList({
  form,
  selectedId,
  onSelect,
}: {
  form: Form;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const { t } = useTranslation('forms');
  const queryClient = useQueryClient();
  const [openService, setOpenService] = useState<{ id: string } | null>(null);
  const select = (id: string | null, serviceId?: string) => {
    setOpenService(serviceId ? { id: serviceId } : null);
    onSelect(id);
  };
  const hasBooking = form.fields.some(field => field.type === 'booking');
  const groups = FIELD_GROUPS.map(group => ({
    ...group,
    types: group.types.filter(type => type !== 'booking' || !hasBooking),
  })).filter(group => group.types.length > 0);

  const onSuccess = (updated: Form) => {
    queryClient.setQueryData(getFormKey(form.id), updated);
    queryClient.invalidateQueries({ queryKey: getFormsKey });
  };
  const onError = (error: unknown) =>
    notifications.show({
      title: t('ed_error_title'),
      message: formErrorMessage(error),
      color: 'red',
    });

  const { mutate: create, isPending: isCreating } = useCreateFormField({
    onSuccess: updated => {
      onSuccess(updated);
      select(updated.fields.at(-1)?.id ?? null);
    },
    onError,
  });
  const { mutate: update, isPending: isUpdating } = useUpdateFormField({
    onSuccess: updated => {
      onSuccess(updated);
      notifications.show({ message: t('ed_changes_saved'), color: 'green' });
    },
    onError,
  });
  const { mutate: remove } = useDeleteFormField({ onSuccess, onError });
  const { mutate: reorder, isPending: isReordering } = useReorderFormFields({
    onSuccess,
    onError,
  });

  const applyOrder = (ids: string[]) => {
    const previous = form;
    const byId = new Map(form.fields.map(field => [field.id, field]));
    queryClient.setQueryData(getFormKey(form.id), {
      ...form,
      fields: ids.map(id => byId.get(id)!),
    });
    reorder(
      { formId: form.id, ids },
      { onError: () => queryClient.setQueryData(getFormKey(form.id), previous) }
    );
  };

  const move = (index: number, offset: -1 | 1) => {
    const ids = form.fields.map(field => field.id);
    [ids[index], ids[index + offset]] = [ids[index + offset], ids[index]];
    applyOrder(ids);
  };

  const onDragEnd = ({ source, destination }: DropResult) => {
    if (!destination || destination.index === source.index) return;
    const ids = form.fields.map(field => field.id);
    const [moved] = ids.splice(source.index, 1);
    ids.splice(destination.index, 0, moved);
    applyOrder(ids);
  };

  const confirmRemove = (field: FormField) => {
    modals.openConfirmModal({
      title: t('ed_remove_title'),
      centered: true,
      children: <p className="text-sm">{t('ed_remove_body', { label: field.label })}</p>,
      labels: { confirm: t('ed_remove_confirm'), cancel: t('ed_keep') },
      confirmProps: { color: 'red' },
      onConfirm: () => remove({ formId: form.id, fieldId: field.id }),
    });
  };

  const numbers = form.fields.reduce<number[]>(
    (acc, field) => [...acc, (acc.at(-1) ?? 0) + (isSection(field) ? 0 : 1)],
    []
  );

  const addEmail = (required: boolean) =>
    create({
      formId: form.id,
      data: {
        ...defaultsFor('email'),
        label: t('ed_checklist_email_label'),
        required,
      },
    });

  return (
    <Card className="p-5 sm:p-6">
      <PublishChecklist
        form={form}
        adding={isCreating}
        onAddEmail={addEmail}
        onSelect={select}
      />
      {form.fields.length === 0 && (
        <p className="mb-4 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {t('ed_no_questions')}
        </p>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="questions">
          {provided => (
            <ol
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="space-y-2"
            >
              {form.fields.map((field, index) => {
                const open = field.id === selectedId;
                return (
                  <Draggable key={field.id} draggableId={field.id} index={index}>
                    {(drag, snapshot) => (
                      <li
                        ref={drag.innerRef}
                        {...drag.draggableProps}
                        className={`rounded-lg border bg-card ${
                          open ? 'border-primary' : 'border-border'
                        } ${snapshot.isDragging ? 'shadow-2xl' : ''}`}
                      >
                        <div className="flex items-center gap-3 p-3">
                          <span
                            {...drag.dragHandleProps}
                            aria-label={t('ed_drag', { label: field.label })}
                            className="flex h-8 w-5 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground active:cursor-grabbing"
                          >
                            <IconGripVertical size={16} />
                          </span>
                          <span className="w-5 text-center font-mono text-xs text-muted-foreground">
                            {isSection(field)
                              ? '§'
                              : String(numbers[index]).padStart(2, '0')}
                          </span>
                          <button
                            type="button"
                            aria-expanded={open}
                            onClick={() => select(open ? null : field.id)}
                            className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
                          >
                            <span
                              className={`truncate text-sm ${
                                isSection(field) ? 'font-bold' : 'font-medium'
                              }`}
                            >
                              {field.label}
                              {field.required && <span className="text-red-500"> *</span>}
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {fieldTypeLabel(field.type)}
                            </span>
                          </button>
                          <Group gap={2} wrap="nowrap">
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              aria-label={t('ed_move_up', { n: index + 1 })}
                              disabled={index === 0 || isReordering}
                              onClick={() => move(index, -1)}
                            >
                              <IconArrowUp size={16} />
                            </ActionIcon>
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              aria-label={t('ed_move_down', { n: index + 1 })}
                              disabled={index === form.fields.length - 1 || isReordering}
                              onClick={() => move(index, 1)}
                            >
                              <IconArrowDown size={16} />
                            </ActionIcon>
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              aria-label={t('ed_duplicate_n', { n: index + 1 })}
                              disabled={isCreating || field.type === 'booking'}
                              onClick={() => create({ formId: form.id, data: copyOf(field) })}
                            >
                              <IconCopy size={16} />
                            </ActionIcon>
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              aria-label={t('ed_remove_n', { n: index + 1 })}
                              onClick={() => confirmRemove(field)}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Group>
                        </div>
                        {open && (
                          <div className="border-t border-border p-4">
                            <QuestionEditor
                              key={field.id}
                              type={field.type}
                              field={field}
                              loading={isUpdating}
                              openService={openService}
                              onCancel={() => select(null)}
                              onSubmit={data =>
                                update({ formId: form.id, fieldId: field.id, data })
                              }
                            />
                          </div>
                        )}
                      </li>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </ol>
          )}
        </Droppable>
      </DragDropContext>

      <div className="mt-5 rounded-xl border border-border p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-semibold">{t('ed_q_add_question')}</h3>
          <span className="text-xs text-muted-foreground">{t('ed_add_at_end')}</span>
        </div>
        {groups.map(group => (
          <section key={group.label()} className="mt-3">
            <h4 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {group.label()}
            </h4>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-2">
              {group.types.map(type => {
                const Icon = FIELD_ICONS[type];
                return (
                  <button
                    key={type}
                    type="button"
                    disabled={isCreating}
                    title={fieldTypeHint(type)}
                    onClick={() => create({ formId: form.id, data: defaultsFor(type) })}
                    className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2 text-left text-[13px] hover:border-primary focus-visible:border-primary focus-visible:outline-none disabled:opacity-50"
                  >
                    <Icon size={16} className="shrink-0 text-primary" />
                    <span className="truncate">{fieldTypeLabel(type)}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </Card>
  );
}
