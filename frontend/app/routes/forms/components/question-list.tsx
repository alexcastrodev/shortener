import { ActionIcon, Badge, Button, Group, Menu, Modal } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconArrowDown,
  IconArrowUp,
  IconPencil,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
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
  FormFieldType,
} from '@internal/core/types/Form';
import { FIELD_TYPES, fieldTypeLabel } from '../../../modules/forms/field-types';
import { formErrorMessage } from '../../../modules/forms/form-errors';
import { QuestionEditor } from './question-editor';

type Editing =
  | { mode: 'new'; type: FormFieldType }
  | { mode: 'edit'; field: FormField };

export function QuestionList({ form }: { form: Form }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Editing | null>(null);

  const onSuccess = (updated: Form) => {
    queryClient.setQueryData(getFormKey(form.id), updated);
    queryClient.invalidateQueries({ queryKey: getFormsKey });
  };
  const onError = (error: unknown) =>
    notifications.show({
      title: 'Error',
      message: formErrorMessage(error),
      color: 'red',
    });

  const { mutate: create, isPending: isCreating } = useCreateFormField({
    onSuccess: updated => {
      onSuccess(updated);
      setEditing(null);
    },
    onError,
  });
  const { mutate: update, isPending: isUpdating } = useUpdateFormField({
    onSuccess: updated => {
      onSuccess(updated);
      setEditing(null);
    },
    onError,
  });
  const { mutate: remove } = useDeleteFormField({ onSuccess, onError });
  const { mutate: reorder, isPending: isReordering } = useReorderFormFields({
    onSuccess,
    onError,
  });

  const move = (index: number, offset: -1 | 1) => {
    const ids = form.fields.map(field => field.id);
    [ids[index], ids[index + offset]] = [ids[index + offset], ids[index]];
    reorder({ formId: form.id, ids });
  };

  const confirmRemove = (field: FormField) => {
    modals.openConfirmModal({
      title: 'Remove question',
      centered: true,
      children: <p className="text-sm">“{field.label}” will be removed from the form.</p>,
      labels: { confirm: 'Remove', cancel: 'Keep it' },
      confirmProps: { color: 'red' },
      onConfirm: () => remove({ formId: form.id, fieldId: field.id }),
    });
  };

  const editingType = editing?.mode === 'edit' ? editing.field.type : editing?.type;

  return (
    <Card className="max-w-2xl p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="font-semibold">Questions</h2>
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <Button size="xs" color="brand" leftSection={<IconPlus size={14} />}>
              Add question
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            {FIELD_TYPES.map(item => (
              <Menu.Item
                key={item.type}
                onClick={() => setEditing({ mode: 'new', type: item.type })}
              >
                <span className="block text-sm">{item.label}</span>
                <span className="block text-xs text-muted-foreground">{item.hint}</span>
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      </div>

      {form.fields.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No questions yet. Add the first one to be able to publish.
        </p>
      )}

      <ol className="space-y-2">
        {form.fields.map((field, index) => (
          <li
            key={field.id}
            className="flex items-center gap-3 rounded-lg border border-border p-3"
          >
            <span className="w-5 text-center text-xs text-muted-foreground">{index + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {field.label}
                {field.required && <span className="text-red-500"> *</span>}
              </p>
              <Badge size="xs" variant="light" color="gray" mt={2}>
                {fieldTypeLabel(field.type)}
              </Badge>
            </div>
            <Group gap={2} wrap="nowrap">
              <ActionIcon
                variant="subtle"
                color="gray"
                aria-label={`Move question ${index + 1} up`}
                disabled={index === 0 || isReordering}
                onClick={() => move(index, -1)}
              >
                <IconArrowUp size={16} />
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                color="gray"
                aria-label={`Move question ${index + 1} down`}
                disabled={index === form.fields.length - 1 || isReordering}
                onClick={() => move(index, 1)}
              >
                <IconArrowDown size={16} />
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                color="gray"
                aria-label={`Edit question ${index + 1}`}
                onClick={() => setEditing({ mode: 'edit', field })}
              >
                <IconPencil size={16} />
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                color="red"
                aria-label={`Remove question ${index + 1}`}
                onClick={() => confirmRemove(field)}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          </li>
        ))}
      </ol>

      <Modal
        opened={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.mode === 'edit' ? 'Edit question' : 'New question'}
        centered
      >
        {editing && editingType && (
          <QuestionEditor
            key={editing.mode === 'edit' ? editing.field.id : `new-${editingType}`}
            type={editingType}
            field={editing.mode === 'edit' ? editing.field : undefined}
            loading={isCreating || isUpdating}
            onCancel={() => setEditing(null)}
            onSubmit={input =>
              editing.mode === 'edit'
                ? update({ formId: form.id, fieldId: editing.field.id, data: input })
                : create({ formId: form.id, data: input })
            }
          />
        )}
      </Modal>
    </Card>
  );
}
