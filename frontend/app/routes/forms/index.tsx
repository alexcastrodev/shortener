import { Button, Select, Stack, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconTrash } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod/v4';
import { Card, PageContainer } from '@internal/ui';
import {
  getFormsKey,
  useGetForms,
} from '@internal/core/actions/get-forms/get-forms.hook';
import { useGetFormTemplates } from '@internal/core/actions/get-form-templates/get-form-templates.hook';
import { useCreateForm } from '@internal/core/actions/create-form/create-form.hook';
import { useDeleteForm } from '@internal/core/actions/delete-form/delete-form.hook';
import type { Route } from './+types/index';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Forms - Kurz' },
    { name: 'description', content: 'Create forms and read the answers' },
  ];
}

export const ssr = false;

const schema = z.object({
  title: z.string().trim().min(1, 'Give your form a title').max(120),
  template: z.string().optional(),
});

function errorMessage(error: unknown) {
  const body = error as
    | { error?: string; errors?: Record<string, string[]> }
    | undefined;
  if (body?.error === 'forms_daily_limit') {
    return 'You reached the limit of 20 new forms per day. Try again tomorrow.';
  }
  if (body?.errors) {
    return Object.entries(body.errors)
      .map(([key, value]) => `${key} ${[value].flat().join(', ')}`)
      .join('; ');
  }
  return 'Something went wrong, please try again later.';
}

export default function FormsIndex() {
  const queryClient = useQueryClient();
  const { data: forms, isLoading } = useGetForms();
  const { data: templates } = useGetFormTemplates();

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: { title: '', template: '' },
    validate: zod4Resolver(schema),
  });

  const { mutate: create, isPending } = useCreateForm({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getFormsKey });
      form.reset();
      notifications.show({ message: 'Form created', color: 'teal' });
    },
    onError: error => {
      notifications.show({
        title: 'Could not create form',
        message: errorMessage(error),
        color: 'red',
      });
    },
  });

  const { mutate: remove } = useDeleteForm({
    onSuccess: () => queryClient.invalidateQueries({ queryKey: getFormsKey }),
    onError: error => {
      notifications.show({
        title: 'Could not delete form',
        message: errorMessage(error),
        color: 'red',
      });
    },
  });

  const confirmDelete = (id: number, title: string, responses: number) => {
    modals.openConfirmModal({
      title: 'Delete this form?',
      centered: true,
      children: (
        <Text size="sm">
          “{title}” and its {responses} {responses === 1 ? 'response' : 'responses'} will be
          deleted for good. This cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete form', cancel: 'Keep it' },
      confirmProps: { color: 'red' },
      onConfirm: () => remove(id),
    });
  };

  return (
    <PageContainer className="pb-24 sm:pb-10">
      <div className="mb-6">
        <p className="text-sm font-medium text-muted-foreground">Forms</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          Your forms
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          {isLoading && <div className="h-24 animate-pulse rounded-lg bg-muted" />}

          {!isLoading && forms?.length === 0 && (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              No forms yet. Start from a template or a blank form.
            </Card>
          )}

          {forms?.map(item => (
            <Card key={item.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-foreground">{item.title}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {item.fields.length} {item.fields.length === 1 ? 'question' : 'questions'} ·{' '}
                  {item.responses_count} {item.responses_count === 1 ? 'response' : 'responses'}
                  {item.published ? ' · Published' : ' · Draft'}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Delete ${item.title}`}
                onClick={() => confirmDelete(item.id, item.title, item.responses_count)}
                className="text-muted-foreground hover:text-red-500"
              >
                <IconTrash size={18} />
              </button>
            </Card>
          ))}
        </div>

        <Card className="p-5 lg:sticky lg:top-4 lg:self-start">
          <h2 className="mb-4 font-semibold">New form</h2>
          <form
            onSubmit={form.onSubmit(values =>
              create({ title: values.title, template: values.template || undefined })
            )}
          >
            <Stack gap="md">
              <TextInput
                label="Title"
                placeholder="Customer feedback"
                key={form.key('title')}
                {...form.getInputProps('title')}
                required
              />
              <Select
                label="Start from"
                placeholder="Blank form"
                clearable
                data={(templates ?? []).map(template => ({
                  value: template.id,
                  label: `${template.name} · ${template.questions} questions`,
                }))}
                key={form.key('template')}
                {...form.getInputProps('template')}
              />
              <Button type="submit" fullWidth loading={isPending} color="brand">
                Create form
              </Button>
            </Stack>
          </form>
        </Card>
      </div>
    </PageContainer>
  );
}
