import {
  Badge,
  Button,
  Group,
  Stack,
  Switch,
  TextInput,
  Textarea,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconTrash } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useNavigate, useParams } from 'react-router';
import { z } from 'zod/v4';
import { Alert, Card, PageContainer } from '@internal/ui';
import {
  getFormKey,
  useGetForm,
} from '@internal/core/actions/get-form/get-form.hook';
import { getFormsKey } from '@internal/core/actions/get-forms/get-forms.hook';
import { useUpdateForm } from '@internal/core/actions/update-form/update-form.hook';
import { useSetFormPublished } from '@internal/core/actions/set-form-published/set-form-published.hook';
import { useDeleteForm } from '@internal/core/actions/delete-form/delete-form.hook';
import { PAGE_THEMES } from '@internal/core/types/Page';
import type { Form } from '@internal/core/types/Form';
import { ThemePicker } from '../../modules/bio-page';
import { formErrorMessage } from '../../modules/forms/form-errors';
import type { Route } from './+types/$id';

export function meta({}: Route.MetaArgs) {
  return [{ title: 'Edit form - Kurz' }];
}

export const ssr = false;

const schema = z.object({
  title: z.string().trim().min(1, 'Give your form a title').max(120),
  description: z.string().max(1000),
  thank_you_message: z.string().max(500),
  theme: z.enum(PAGE_THEMES),
});

function showError(error: unknown) {
  notifications.show({
    title: 'Error',
    message: formErrorMessage(error),
    color: 'red',
  });
}

export default function FormBuilder() {
  const { id = '' } = useParams();
  const { data: form, isLoading, error } = useGetForm(id);

  if (error) {
    return (
      <PageContainer>
        <Alert title="Failed to load form">
          We could not load this form. Please try again later.
        </Alert>
      </PageContainer>
    );
  }

  if (isLoading || !form) {
    return (
      <PageContainer>
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded-md bg-muted" />
          <div className="h-48 rounded-lg bg-muted" />
        </div>
      </PageContainer>
    );
  }

  return <Builder form={form} />;
}

function Builder({ form: current }: { form: Form }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getFormKey(current.id) });
    queryClient.invalidateQueries({ queryKey: getFormsKey });
  };

  const serverValues = {
    title: current.title,
    description: current.description ?? '',
    thank_you_message: current.thank_you_message ?? '',
    theme: current.theme,
  };

  const form = useForm({
    mode: 'controlled',
    initialValues: serverValues,
    validate: zod4Resolver(schema),
  });

  const serverKey = JSON.stringify(serverValues);
  useEffect(() => {
    if (form.isDirty()) return;
    form.setValues(serverValues);
    form.resetDirty(serverValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverKey]);

  const { mutate: save, isPending: isSaving } = useUpdateForm({
    onSuccess: () => {
      refresh();
      form.resetDirty();
      notifications.show({ message: 'Form saved', color: 'green' });
    },
    onError: showError,
  });

  const { mutate: setPublished, isPending: isPublishing } = useSetFormPublished({
    onSuccess: () => refresh(),
    onError: showError,
  });

  const { mutate: remove } = useDeleteForm({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getFormsKey });
      navigate('/app/forms');
    },
    onError: showError,
  });

  const confirmDelete = () => {
    modals.openConfirmModal({
      title: 'Delete form',
      centered: true,
      children: (
        <p className="text-sm">
          “{current.title}” and its {current.responses_count}{' '}
          {current.responses_count === 1 ? 'response' : 'responses'} will be
          deleted for good. This cannot be undone.
        </p>
      ),
      labels: { confirm: 'Delete form', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => remove(current.id),
    });
  };

  return (
    <PageContainer className="pb-24 sm:pb-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="subtle"
          color="gray"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate('/app/forms')}
        >
          Forms
        </Button>
        <Group gap="xs">
          <Badge variant="light" color={current.published ? 'teal' : 'gray'}>
            {current.published ? 'Published' : 'Draft'}
          </Badge>
          <Switch
            label="Published"
            checked={current.published}
            disabled={isPublishing}
            onChange={event =>
              setPublished({ id: current.id, published: event.currentTarget.checked })
            }
          />
        </Group>
      </div>

      <Card className="max-w-2xl p-5 sm:p-6">
        <h2 className="mb-4 font-semibold">Form</h2>
        <form onSubmit={form.onSubmit(values => save({ id: current.id, data: values }))}>
          <Stack gap="md">
            <TextInput
              label="Title"
              key={form.key('title')}
              {...form.getInputProps('title')}
              required
            />
            <Textarea
              label="Description"
              description="Shown on the first screen."
              autosize
              minRows={2}
              maxLength={1000}
              key={form.key('description')}
              {...form.getInputProps('description')}
            />
            <Textarea
              label="Thank you message"
              description="Shown after the form is submitted."
              autosize
              minRows={2}
              maxLength={500}
              key={form.key('thank_you_message')}
              {...form.getInputProps('thank_you_message')}
            />
            <ThemePicker
              value={form.values.theme}
              onChange={theme => form.setFieldValue('theme', theme)}
            />
            <Group justify="space-between">
              <Button
                variant="subtle"
                color="red"
                leftSection={<IconTrash size={16} />}
                onClick={confirmDelete}
              >
                Delete form
              </Button>
              <Button type="submit" loading={isSaving} color="brand">
                Save
              </Button>
            </Group>
          </Stack>
        </form>
      </Card>
    </PageContainer>
  );
}
