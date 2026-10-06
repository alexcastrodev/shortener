import {
  Button,
  FileButton,
  Group,
  Loader,
  Stack,
  Switch,
  TextInput,
  Textarea,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useEffect, useState } from 'react';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconCalendarTime,
  IconExternalLink,
  IconPhoto,
  IconChartBar,
  IconQrcode,
  IconTemplate,
  IconTrash,
} from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { z } from 'zod/v4';
import type { TFunction } from 'i18next';
import { Alert, Card, PageContainer } from '@internal/ui';
import {
  getPageKey,
  useGetPage,
} from '@internal/core/actions/get-page/get-page.hook';
import { getPagesKey } from '@internal/core/actions/get-pages/get-pages.hook';
import { useUpdatePage } from '@internal/core/actions/update-page/update-page.hook';
import { useDeletePage } from '@internal/core/actions/delete-page/delete-page.hook';
import { useUploadPageAvatar } from '@internal/core/actions/upload-page-avatar/upload-page-avatar.hook';
import { useDeletePageAvatar } from '@internal/core/actions/delete-page-avatar/delete-page-avatar.hook';
import {
  PAGE_THEMES,
  type Page,
} from '@internal/core/types/Page';
import { PhoneFrame, ThemePicker } from '../../modules/bio-page';
import { openQrCodeModal } from '../../modules/qr-code';
import {
  dateTimeLocalToIso,
  isFutureDateTimeLocal,
  isoToDateTimeLocal,
} from '../../utils/datetime-local';
import type { Route } from './+types/$id';
import { PageContentEditor } from './components/page-content-editor';
import { openTemplateGallery } from './components/template-gallery';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Edit bio page - Kurz' },
    { name: 'description', content: 'Edit your bio link page' },
  ];
}

export const ssr = false;

const makePageSchema = (t: TFunction<'pages'>) =>
  z.object({
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9][a-z0-9_.-]{1,28}[a-z0-9]$/, t('slug_rule')),
    display_title: z.string().max(80),
    bio: z.string().max(300),
    theme: z.enum(PAGE_THEMES),
    custom_colors: z
      .object({ background: z.string(), text: z.string(), accent: z.string() })
      .nullable(),
    published: z.boolean(),
    expires_at: z.string().refine(isFutureDateTimeLocal, t('edit_expires_future')),
  });

function errorMessage(error: unknown) {
  const errors = (error as { errors?: unknown } | undefined)?.errors;
  if (Array.isArray(errors)) return errors.join(', ');
  if (errors && typeof errors === 'object') {
    return Object.entries(errors)
      .map(([key, value]) => `${key} ${value}`)
      .join(', ');
  }
  return i18n.t('pages:generic_error');
}

function showError(error: unknown) {
  notifications.show({
    title: i18n.t('pages:edit_error_title'),
    message: errorMessage(error),
    color: 'red',
  });
}

export default function PageEditor() {
  const { t } = useTranslation('pages');
  const { id = '' } = useParams();
  const { data: page, isLoading, error } = useGetPage(id);

  if (error) {
    return (
      <PageContainer>
        <Alert title={t('edit_load_failed_title')}>
          {t('edit_load_failed_body')}
        </Alert>
      </PageContainer>
    );
  }

  if (isLoading || !page) {
    return (
      <PageContainer>
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded-md bg-muted" />
          <div className="h-48 rounded-lg bg-muted" />
        </div>
      </PageContainer>
    );
  }

  return <Editor page={page} />;
}

function Editor({ page }: { page: Page }) {
  const { t } = useTranslation('pages');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const links = page.links ?? [];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getPageKey(page.id) });
    queryClient.invalidateQueries({ queryKey: getPagesKey });
  };

  // Controlled so the phone preview follows every keystroke.
  const form = useForm({
    mode: 'controlled',
    initialValues: {
      slug: page.slug,
      display_title: page.display_title ?? '',
      bio: page.bio ?? '',
      theme: page.theme,
      custom_colors: page.custom_colors ?? null,
      published: page.published,
      expires_at: isoToDateTimeLocal(page.expires_at),
    },
    validate: zod4Resolver(makePageSchema(t)),
  });

  // The server can change the page behind the form (e.g. applying a
  // template sets its theme). Take the new values unless the user has
  // unsaved edits, so a later Save does not write stale values back.
  const serverValues = {
    slug: page.slug,
    display_title: page.display_title ?? '',
    bio: page.bio ?? '',
    theme: page.theme,
    custom_colors: page.custom_colors ?? null,
    published: page.published,
    expires_at: isoToDateTimeLocal(page.expires_at),
  };
  const serverKey = JSON.stringify(serverValues);
  useEffect(() => {
    if (form.isDirty()) return;
    form.setValues(serverValues);
    form.resetDirty(serverValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverKey]);

  const { mutate: updatePage, isPending: isSaving } = useUpdatePage({
    onSuccess: () => {
      refresh();
      form.resetDirty();
      notifications.show({ message: t('edit_saved'), color: 'green' });
    },
    onError: showError,
  });

  const { mutate: deletePage } = useDeletePage({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getPagesKey });
      navigate('/app/pages');
    },
    onError: showError,
  });

  function confirmDelete() {
    modals.openConfirmModal({
      title: t('edit_delete_title'),
      children: <p className="text-sm">{t('edit_delete_body', { slug: page.slug })}</p>,
      labels: { confirm: t('edit_delete_confirm'), cancel: t('edit_cancel') },
      confirmProps: { color: 'red' },
      onConfirm: () => deletePage(page.id),
    });
  }

  return (
    <PageContainer className="pb-24 sm:pb-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="subtle"
          color="gray"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate('/app/pages')}
        >
          {t('edit_back')}
        </Button>
        <Group gap="xs">
          <Button
            variant="default"
            leftSection={<IconTemplate size={16} />}
            onClick={() => openTemplateGallery({ page, onApplied: refresh })}
          >
            {t('edit_templates')}
          </Button>
          <Button
            variant="default"
            leftSection={<IconChartBar size={16} />}
            onClick={() => navigate(`/app/pages/${page.id}/stats`)}
          >
            {t('edit_statistics')}
          </Button>
          <Button
            variant="default"
            leftSection={<IconQrcode size={16} />}
            onClick={() =>
              openQrCodeModal({
                resource: 'pages',
                id: page.id,
                url: page.public_url,
                filename: `kurz-${page.slug}.svg`,
              })
            }
          >
            {t('edit_qr')}
          </Button>
          <Button
            component="a"
            href={`/u/${page.slug}`}
            target="_blank"
            rel="noreferrer"
            variant="default"
            rightSection={<IconExternalLink size={16} />}
          >
            {t('edit_view')}
          </Button>
        </Group>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Card className="p-5 sm:p-6">
            <h2 className="mb-4 font-semibold">{t('edit_page_card')}</h2>
            <form
              onSubmit={form.onSubmit(values =>
                updatePage({
                  id: page.id,
                  data: {
                    ...values,
                    expires_at: dateTimeLocalToIso(values.expires_at),
                  },
                })
              )}
            >
              <Stack gap="md">
                <AvatarField page={page} onChange={refresh} />
                <TextInput
                  label={t('address')}
                  leftSection={<span className="pl-2 text-xs">/u/</span>}
                  leftSectionWidth={36}
                  key={form.key('slug')}
                  {...form.getInputProps('slug')}
                  required
                />
                <TextInput
                  label={t('edit_title')}
                  key={form.key('display_title')}
                  {...form.getInputProps('display_title')}
                />
                <Textarea
                  label={t('edit_bio')}
                  autosize
                  minRows={3}
                  maxLength={300}
                  key={form.key('bio')}
                  {...form.getInputProps('bio')}
                />
                <ThemePicker
                  value={form.values.theme}
                  colors={form.values.custom_colors}
                  onChange={theme => form.setFieldValue('theme', theme)}
                  onColorsChange={colors => form.setFieldValue('custom_colors', colors)}
                />
                <Switch
                  label={t('edit_published')}
                  key={form.key('published')}
                  {...form.getInputProps('published', { type: 'checkbox' })}
                />
                <TextInput
                  type="datetime-local"
                  label={t('edit_expires_label')}
                  description={t('edit_expires_hint')}
                  leftSection={<IconCalendarTime size={16} />}
                  key={form.key('expires_at')}
                  {...form.getInputProps('expires_at')}
                />
                <Group justify="space-between">
                  <Button
                    variant="subtle"
                    color="red"
                    leftSection={<IconTrash size={16} />}
                    onClick={confirmDelete}
                  >
                    {t('edit_delete_confirm')}
                  </Button>
                  <Button type="submit" loading={isSaving} color="brand">
                    {t('edit_save')}
                  </Button>
                </Group>
              </Stack>
            </form>
          </Card>
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <p className="mb-3 text-center text-sm font-medium text-muted-foreground">
            {t('edit_hint')}
            {form.isDirty() && ` · ${t('edit_unsaved')}`}
          </p>
          <PhoneFrame className="max-w-[360px]" screenClassName="lg:h-[680px]">
            <PageContentEditor
              pageId={page.id}
              header={{
                slug: form.values.slug || page.slug,
                display_title: form.values.display_title,
                bio: form.values.bio,
                theme: form.values.theme,
                custom_colors: form.values.custom_colors,
                avatar_url: page.avatar_url,
              }}
              links={links}
              onChange={refresh}
              onPickTemplate={() =>
                openTemplateGallery({ page, onApplied: refresh })
              }
            />
          </PhoneFrame>
        </div>
      </div>
    </PageContainer>
  );
}

// Mirrors Page::AVATAR_MAX_SIZE; checked here too so an oversized photo is
// refused before spending the upload.
const AVATAR_MAX_BYTES = 50 * 1024 * 1024;
// The server shrinks uploads in the background. Poll while it does, but
// give up after a couple of minutes (a stuck upload is cleaned up
// server-side within the hour).
const AVATAR_POLL_MS = 2000;
const AVATAR_POLL_LIMIT = 60;

function AvatarField({ page, onChange }: { page: Page; onChange: () => void }) {
  const { t } = useTranslation('pages');
  const queryClient = useQueryClient();
  const [pollGaveUp, setPollGaveUp] = useState(false);
  const { mutate: upload, isPending: isUploading } = useUploadPageAvatar({
    onSuccess: () => {
      setPollGaveUp(false);
      onChange();
    },
    onError: showError,
  });
  const { mutate: remove, isPending: isRemoving } = useDeletePageAvatar({
    onSuccess: onChange,
    onError: showError,
  });

  const isProcessing = !!page.avatar_processing;

  useEffect(() => {
    if (!isProcessing || pollGaveUp) return;

    let polls = 0;
    const timer = setInterval(() => {
      polls += 1;
      if (polls > AVATAR_POLL_LIMIT) {
        clearInterval(timer);
        setPollGaveUp(true);
        return;
      }
      queryClient.invalidateQueries({ queryKey: getPageKey(page.id) });
    }, AVATAR_POLL_MS);
    return () => clearInterval(timer);
  }, [isProcessing, pollGaveUp, page.id, queryClient]);

  const pickFile = (file: File | null) => {
    if (!file) return;
    if (file.size > AVATAR_MAX_BYTES) {
      showError({ errors: [t('edit_avatar_too_big')] });
      return;
    }
    upload({ pageId: page.id, file });
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-16 w-16 shrink-0">
        {page.avatar_url ? (
          <img
            src={page.avatar_url}
            alt={t('edit_avatar_alt')}
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <IconPhoto size={22} />
          </div>
        )}
        {isProcessing && !pollGaveUp && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
            <Loader size="sm" color="white" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <Group gap="xs">
          <FileButton
            accept="image/png,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif"
            onChange={pickFile}
          >
            {props => (
              <Button
                {...props}
                size="xs"
                variant="default"
                loading={isUploading}
                disabled={isProcessing && !pollGaveUp}
              >
                {page.avatar_url ? t('edit_avatar_change') : t('edit_avatar_upload')}
              </Button>
            )}
          </FileButton>
          {(page.avatar_url || isProcessing) && (
            <Button
              size="xs"
              variant="subtle"
              color="red"
              loading={isRemoving}
              onClick={() => remove(page.id)}
            >
              {t('edit_avatar_remove')}
            </Button>
          )}
        </Group>
        <span className="text-xs text-muted-foreground">
          {isUploading
            ? t('edit_avatar_uploading')
            : isProcessing
              ? pollGaveUp
                ? t('edit_avatar_stalled')
                : t('edit_avatar_processing')
              : t('edit_avatar_hint')}
        </span>
      </div>
    </div>
  );
}
