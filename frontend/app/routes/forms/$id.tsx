import {
  ActionIcon,
  Button,
  CopyButton,
  Group,
  SegmentedControl,
  Stack,
  Switch,
  TextInput,
  Textarea,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconChartBar,
  IconDeviceDesktop,
  IconDeviceMobile,
  IconCheck,
  IconCopy,
  IconExternalLink,
  IconQrcode,
  IconListDetails,
  IconPointer,
  IconScript,
  IconRefresh,
  IconTrash,
} from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useTranslation } from 'react-i18next';
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
import { FORM_LAYOUTS, type Form, type FormLayout } from '@internal/core/types/Form';
import { PhoneFrame, ThemePicker } from '../../modules/bio-page';
import { openQrCodeModal } from '../../modules/qr-code';
import { FormRenderer } from '../../modules/forms/form-renderer';
import i18n from '../../i18n';
import { formErrorMessage } from '../../modules/forms/form-errors';
import { isSection } from '../../modules/forms/field-types';
import { QuestionList } from './components/question-list';
import { CoverSettings } from './components/cover-settings';
import { getFormCover } from '@internal/core/actions/get-form-cover/get-form-cover.service';
import type { Route } from './+types/$id';

export function meta({}: Route.MetaArgs) {
  return [{ title: 'Edit form - Kurz' }];
}

export const ssr = false;

const schema = z.object({
  title: z.string().trim().min(1, i18n.t('forms:ed_title_required')).max(120),
  description: z.string().max(1000),
  thank_you_message: z.string().max(500),
  theme: z.enum(PAGE_THEMES),
  custom_colors: z
    .object({ background: z.string(), text: z.string(), accent: z.string() })
    .nullable(),
  layout: z.enum(FORM_LAYOUTS),
  cover_position: z.number().int().min(0).max(100),
  intro_enabled: z.boolean(),
  start_label: z.string().max(40),
});

const toRequest = (values: z.infer<typeof schema>) => ({
  ...values,
  start_label: values.start_label.trim() || null,
});

function showError(error: unknown) {
  notifications.show({
    title: i18n.t('forms:ed_error_title'),
    message: formErrorMessage(error),
    color: 'red',
  });
}

export default function FormBuilder() {
  const { t } = useTranslation('forms');
  const { id = '' } = useParams();
  const { data: form, isLoading, error } = useGetForm(id);

  if (error) {
    return (
      <PageContainer>
        <Alert title={t('ed_load_failed_title')}>{t('ed_load_failed_body')}</Alert>
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
  const { t } = useTranslation('forms');
  const layoutOptions = [
    { value: 'page', label: t('ed_layout_page'), hint: t('ed_layout_page_hint'), icon: IconScript },
    { value: 'one_at_a_time', label: t('ed_layout_one'), hint: t('ed_layout_one_hint'), icon: IconPointer },
    { value: 'steps', label: t('ed_layout_steps'), hint: t('ed_layout_steps_hint'), icon: IconListDetails },
  ] as const;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [device, setDevice] = useState<'mobile' | 'desktop'>('mobile');
  const [restarts, setRestarts] = useState(0);
  const [tab, setTab] = useState<'questions' | 'settings'>('questions');
  const { data: coverBlob } = useQuery({
    queryKey: ['form-cover', current.id, current.cover_token],
    queryFn: () => getFormCover(current.id),
    enabled: Boolean(current.cover_token),
    staleTime: Infinity,
  });
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!coverBlob) {
      setCoverUrl(null);
      return;
    }
    const url = URL.createObjectURL(coverBlob);
    setCoverUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [coverBlob]);
  const shareUrl = current.short_url ?? current.public_url;
  const sectionCount = current.fields.filter(isSection).length;
  const questionCount = current.fields.length - sectionCount;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getFormKey(current.id) });
    queryClient.invalidateQueries({ queryKey: getFormsKey });
  };

  const serverValues = {
    title: current.title,
    description: current.description ?? '',
    thank_you_message: current.thank_you_message ?? '',
    theme: current.theme,
    custom_colors: current.custom_colors ?? null,
    layout: current.layout,
    cover_position: current.cover_position ?? 50,
    intro_enabled: current.intro_enabled ?? false,
    start_label: current.start_label ?? '',
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
      notifications.show({ message: t('ed_saved'), color: 'green' });
    },
    onError: showError,
  });

  const { mutate: setAccepting, isPending: isTogglingAccepting } = useUpdateForm({
    onSuccess: () => refresh(),
    onError: showError,
  });

  const {
    mutate: setPublished,
    isPending: isChangingPublished,
    variables: publishing,
  } = useSetFormPublished({
    onSuccess: () => refresh(),
    onError: showError,
  });
  const isPublishing = isChangingPublished && publishing?.published === true;
  const isUnpublishing = isChangingPublished && publishing?.published === false;

  const { mutate: remove } = useDeleteForm({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getFormsKey });
      navigate('/app/forms');
    },
    onError: showError,
  });

  const confirmRepublish = () => {
    const version = current.published_version + 1;
    modals.openConfirmModal({
      title: t('ed_republish_title', { version }),
      centered: true,
      children: <p className="text-sm">{t('ed_republish_body', { url: shareUrl })}</p>,
      labels: { confirm: t('ed_republish_confirm', { version }), cancel: t('ed_cancel') },
      confirmProps: { color: 'brand' },
      onConfirm: () => setPublished({ id: current.id, published: true }),
    });
  };

  const confirmUnpublish = () => {
    modals.openConfirmModal({
      title: t('ed_unpublish_title'),
      centered: true,
      children: <p className="text-sm">{t('ed_unpublish_body', { url: shareUrl })}</p>,
      labels: { confirm: t('ed_unpublish'), cancel: t('ed_cancel') },
      onConfirm: () => setPublished({ id: current.id, published: false }),
    });
  };

  const confirmDelete = () => {
    modals.openConfirmModal({
      title: t('delete_confirm'),
      centered: true,
      children: (
        <p className="text-sm">
          {t('delete_body', { title: current.title, count: current.responses_count })}
        </p>
      ),
      labels: { confirm: t('delete_confirm'), cancel: t('ed_cancel') },
      confirmProps: { color: 'red' },
      onConfirm: () => remove(current.id),
    });
  };

  return (
    <PageContainer className="pb-24 sm:pb-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ActionIcon
            variant="default"
            size="lg"
            aria-label={t('ed_back')}
            onClick={() => navigate('/app/forms')}
          >
            <IconArrowLeft size={16} />
          </ActionIcon>
          <div className="leading-tight">
            <p className="text-xs text-muted-foreground">{t('forms')}</p>
            <p className="text-sm font-semibold">{form.values.title || t('untitled_form')}</p>
          </div>
        </div>
        <Group gap="xs">
          <Button
            variant="default"
            leftSection={<IconChartBar size={16} />}
            onClick={() => navigate(`/app/forms/${current.id}/responses`)}
          >
            {t('ed_responses')}
            <span className="ml-2 text-muted-foreground">{current.responses_count}</span>
          </Button>
          <div
            className={`flex items-center gap-1 rounded-md border py-1 pr-1 pl-3 ${
              current.published ? 'border-border' : 'border-dashed border-border opacity-80'
            }`}
          >
            <span
              className="max-w-[200px] truncate font-mono text-xs text-muted-foreground"
              title={
                current.published ? shareUrl : t('ed_goes_live', { url: shareUrl })
              }
            >
              {shareUrl.replace(/^https?:\/\//, '')}
            </span>
            <CopyButton value={shareUrl} timeout={1500}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? t('ed_copied') : t('ed_copy_link')} withArrow>
                  <ActionIcon
                    variant="subtle"
                    color={copied ? 'green' : 'gray'}
                    aria-label={t('ed_copy_form_link')}
                    onClick={copy}
                  >
                    {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
            {current.shortlink_id && (
              <Tooltip label={t('ed_qr_code')} withArrow>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  aria-label={t('ed_qr_code_of')}
                  onClick={() =>
                    openQrCodeModal({
                      resource: 'shortlinks',
                      id: current.shortlink_id!,
                      url: shareUrl,
                      filename: `kurz-form-${current.public_id}.svg`,
                    })
                  }
                >
                  <IconQrcode size={16} />
                </ActionIcon>
              </Tooltip>
            )}
            {current.published && (
              <Tooltip label={t('ed_open_form')} withArrow>
                <ActionIcon
                  component="a"
                  href={`/f/${current.public_id}`}
                  target="_blank"
                  rel="noreferrer"
                  variant="subtle"
                  color="gray"
                  aria-label={t('ed_open_public')}
                >
                  <IconExternalLink size={16} />
                </ActionIcon>
              </Tooltip>
            )}
          </div>
          {!current.published && (
            <Button
              size="sm"
              color="brand"
              loading={isPublishing}
              onClick={() => setPublished({ id: current.id, published: true })}
            >
              {t('ed_publish')}
            </Button>
          )}
          <span
            role="status"
            className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium ${
              current.published ? 'border-primary/50 bg-primary/10' : 'border-border'
            }`}
          >
            {current.published
              ? `${t('ed_published')} · ${t('ed_version', { version: current.published_version })}`
              : t('draft')}
            {current.published && current.has_unpublished_changes && (
              <span className="text-amber-700 dark:text-amber-400">{t('ed_changes_pending')}</span>
            )}
          </span>
          {current.published && current.has_unpublished_changes && (
            <Button
              size="sm"
              color="brand"
              loading={isPublishing}
              onClick={confirmRepublish}
            >
              {t('ed_publish_changes')}
            </Button>
          )}
          {current.published && (
            <Button size="sm" variant="default" loading={isUnpublishing} onClick={confirmUnpublish}>
              {t('ed_unpublish')}
            </Button>
          )}
          <Tooltip label={t('ed_accepting_hint')} disabled={current.published}>
            <label
              className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium ${
                current.published ? 'cursor-pointer border-border' : 'cursor-not-allowed opacity-60'
              }`}
            >
              <Switch
                size="sm"
                aria-label={t('ed_accepting')}
                checked={current.accepting_responses}
                disabled={!current.published || isTogglingAccepting}
                onChange={event =>
                  setAccepting({
                    id: current.id,
                    data: { accepting_responses: event.currentTarget.checked },
                  })
                }
              />
              {t('ed_accepting')}
            </label>
          </Tooltip>
        </Group>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div>
            <div className="mb-4 flex items-center justify-between gap-2">
              <span className="font-mono text-xs tracking-widest text-muted-foreground">
                {t('ed_editor')}
              </span>
              <Group gap="sm">
                <span className="text-xs text-muted-foreground">
                  {t('question_count', { count: questionCount })}
                  {sectionCount > 0 && ` · ${t('ed_section_count', { count: sectionCount })}`}
                </span>
                <Button
                  size="xs"
                  color="brand"
                  loading={isSaving}
                  disabled={!form.isDirty()}
                  onClick={() => form.onSubmit(values => save({ id: current.id, data: toRequest(values) }))()}
                >
                  {t('ed_save')}
                </Button>
              </Group>
            </div>
            <Stack gap="xs">
              <TextInput
                aria-label={t('ed_title_label')}
                placeholder={t('untitled_form')}
                size="lg"
                styles={{ input: { fontWeight: 600 } }}
                key={form.key('title')}
                {...form.getInputProps('title')}
              />
              <Textarea
                aria-label={t('ed_description_label')}
                placeholder={t('ed_description_placeholder')}
                autosize
                minRows={1}
                maxLength={1000}
                key={form.key('description')}
                {...form.getInputProps('description')}
              />
            </Stack>
          </div>

          <div role="tablist" className="flex gap-1 border-b border-border">
            {(['questions', 'settings'] as const).map(name => (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={tab === name}
                onClick={() => setTab(name)}
                className={`-mb-px border-b-2 px-3 py-2 text-sm ${
                  tab === name
                    ? 'border-primary font-medium text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {name === 'questions' ? t('ed_tab_questions') : t('ed_tab_settings')}
                {name === 'questions' && (
                  <span className="ml-1.5 text-xs text-muted-foreground">{questionCount}</span>
                )}
              </button>
            ))}
          </div>

          {tab === 'questions' ? (
            <QuestionList form={current} selectedId={selectedId} onSelect={setSelectedId} />
          ) : (
          <Card className="p-5 sm:p-6">
            <Stack gap="md">
              <div>
                <p className="text-sm font-medium">{t('ed_layout')}</p>
                <p className="mb-2 text-xs text-muted-foreground">
                  {t('ed_layout_hint')}
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {layoutOptions.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={form.values.layout === option.value}
                      onClick={() => form.setFieldValue('layout', option.value)}
                      className={`rounded-lg border p-3 text-left ${
                        form.values.layout === option.value
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/60'
                      }`}
                    >
                      <option.icon size={18} className="mb-3 text-primary" />
                      <span className="block text-sm font-medium">{option.label}</span>
                      <span className="block text-xs text-muted-foreground">{option.hint}</span>
                    </button>
                  ))}
                </div>
              </div>
              <CoverSettings
                formId={current.id}
                hasCover={Boolean(current.cover_token)}
                coverUrl={coverUrl}
                form={form as never}
                onChanged={refresh}
              />
              <Textarea
                label={t('ed_thanks_label')}
                description={t('ed_thanks_hint')}
                autosize
                minRows={2}
                maxLength={500}
                key={form.key('thank_you_message')}
                {...form.getInputProps('thank_you_message')}
              />
              <ThemePicker
                value={form.values.theme}
                colors={form.values.custom_colors}
                onChange={theme => form.setFieldValue('theme', theme)}
                onColorsChange={colors => form.setFieldValue('custom_colors', colors)}
              />
              <Group justify="space-between">
                <Button
                  variant="subtle"
                  color="red"
                  leftSection={<IconTrash size={16} />}
                  onClick={confirmDelete}
                >
                  {t('delete_confirm')}
                </Button>
                <Button
                  color="brand"
                  loading={isSaving}
                  disabled={!form.isDirty()}
                  onClick={() => form.onSubmit(values => save({ id: current.id, data: toRequest(values) }))()}
                >
                  {t('ed_save')}
                </Button>
              </Group>
            </Stack>
          </Card>
          )}
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">{t('ed_preview')}</p>
            <Group gap="xs">
              <SegmentedControl
                size="xs"
                aria-label={t('ed_device')}
                value={device}
                onChange={value => setDevice(value as 'mobile' | 'desktop')}
                data={[
                  {
                    value: 'mobile',
                    label: (
                      <span className="inline-flex items-center gap-1.5">
                        <IconDeviceMobile size={14} /> {t('ed_mobile')}
                      </span>
                    ),
                  },
                  {
                    value: 'desktop',
                    label: (
                      <span className="inline-flex items-center gap-1.5">
                        <IconDeviceDesktop size={14} /> {t('ed_desktop')}
                      </span>
                    ),
                  },
                ]}
              />
              <Button
                size="xs"
                variant="default"
                leftSection={<IconRefresh size={14} />}
                onClick={() => setRestarts(n => n + 1)}
              >
                {t('ed_restart')}
              </Button>
            </Group>
          </div>
          <Card className="p-4">
            {(() => {
              const preview = (
                <FormRenderer
                  key={`${restarts}-${form.values.layout}-${form.values.intro_enabled}-${current.fields.map(field => field.id).join('-')}`}
                  mode="preview"
                  activeFieldId={selectedId}
                  onSelectField={setSelectedId}
                  form={{
                    title: form.values.title || t('untitled_form'),
                    description: form.values.description || null,
                    thank_you_message: form.values.thank_you_message || null,
                    theme: form.values.theme,
                    custom_colors: form.values.custom_colors,
                    layout: form.values.layout,
                    cover_position: form.values.cover_position,
                    intro_enabled: form.values.intro_enabled,
                    start_label: form.values.start_label || null,
                    fields: current.fields,
                  }}
                  coverUrl={coverUrl}
                />
              );
              return device === 'mobile' ? (
                <PhoneFrame label={t('ed_form_preview')}>{preview}</PhoneFrame>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border">
                  <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
                    <span aria-hidden="true" className="flex gap-1.5">
                      {[0, 1, 2].map(dot => (
                        <i key={dot} className="size-2.5 rounded-full bg-muted-foreground/30" />
                      ))}
                    </span>
                    <span className="mx-auto font-mono text-xs text-muted-foreground">
                      {current.public_url.replace(/^https?:\/\//, '')}
                    </span>
                    <span className="w-9" />
                  </div>
                  <div className="h-[520px] overflow-y-auto">{preview}</div>
                </div>
              );
            })()}
          </Card>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            {t('ed_preview_hint')}
          </p>
        </div>
      </div>
      {form.isDirty() && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-2xl"
        >
          <span className="text-sm">{t('ed_unsaved')}</span>
          <Group gap="xs">
            <Button
              size="xs"
              variant="default"
              onClick={() => {
                form.setValues(serverValues);
                form.resetDirty(serverValues);
              }}
            >
              {t('ed_discard')}
            </Button>
            <Button
              size="xs"
              color="brand"
              loading={isSaving}
              onClick={() => form.onSubmit(values => save({ id: current.id, data: toRequest(values) }))()}
            >
              {t('ed_save')}
            </Button>
          </Group>
        </div>
      )}
    </PageContainer>
  );
}
