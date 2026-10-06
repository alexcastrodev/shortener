import {
  ActionIcon,
  Badge,
  Button,
  Loader,
  Menu,
  SegmentedControl,
  Select,
  Tabs,
  Textarea,
  TextInput,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconDots,
  IconEyeOff,
  IconFlag,
  IconInfoCircle,
  IconTemplate,
  IconTrash,
  IconUsersGroup,
  IconWorld,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import i18n from '../../../i18n';
import type templatesEn from '../../../i18n/en/templates.json';
import {
  getPageTemplatesKey,
  useGetPageTemplates,
} from '@internal/core/actions/get-page-templates/get-page-templates.hook';
import {
  getCommunityTemplatesKey,
  useGetCommunityTemplates,
} from '@internal/core/actions/get-community-templates/get-community-templates.hook';
import type { CommunityTemplatesSort } from '@internal/core/actions/get-community-templates/get-community-templates.types';
import { getPagesKey } from '@internal/core/actions/get-pages/get-pages.hook';
import { getPages } from '@internal/core/actions/get-pages/get-pages.service';
import { useApplyPageTemplate } from '@internal/core/actions/apply-page-template/apply-page-template.hook';
import { useSavePageTemplate } from '@internal/core/actions/save-page-template/save-page-template.hook';
import { useDeletePageTemplate } from '@internal/core/actions/delete-page-template/delete-page-template.hook';
import { usePublishPageTemplate } from '@internal/core/actions/publish-page-template/publish-page-template.hook';
import { useReportCommunityTemplate } from '@internal/core/actions/report-community-template/report-community-template.hook';
import { queryClient } from '@internal/core/service-provider';
import type {
  Page,
  PageTemplate,
  PageTemplateItem,
  PageTemplateReportReason,
  PageTheme,
} from '@internal/core/types/Page';
import { BioPageView } from '../../../modules/bio-page';

// Mantine modals render through a portal above the QueryClientProvider, so
// every query/mutation here gets the client explicitly.

interface GalleryProps {
  page: Page;
  onApplied: () => void;
}

type PreviewPage = Pick<Page, 'slug' | 'display_title' | 'avatar_url'>;

type TemplatesKey = keyof typeof templatesEn;

const REPORT_REASONS: { value: PageTemplateReportReason; label: TemplatesKey }[] = [
  { value: 'spam', label: 'reason_spam' },
  { value: 'offensive', label: 'reason_offensive' },
  { value: 'impersonation', label: 'reason_impersonation' },
  { value: 'other', label: 'reason_else' },
];

function errorMessage(error: unknown, fallback: string) {
  const data = error as { errors?: string[]; error?: string } | undefined;
  if (Array.isArray(data?.errors)) return data.errors.join(', ');
  return data?.error ?? fallback;
}

function isVisible(page: Page) {
  return (
    page.published &&
    (!page.expires_at || new Date(page.expires_at) > new Date())
  );
}

// A shrunken, non-interactive render of the page as the template would
// leave it (placeholders shown, so the layout is visible).
// Width the bio page is rendered at before being shrunk into the card.
const PREVIEW_PAGE_WIDTH = 360;
const PREVIEW_MAX_SCALE = 0.5;

export function TemplatePreview({
  page,
  theme,
  items,
}: {
  page: PreviewPage;
  theme: PageTheme;
  items: PageTemplateItem[];
}) {
  // Two cards side by side on a phone are narrower than the usual 180px
  // miniature, so the scale follows the box instead of cropping the page.
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(PREVIEW_MAX_SCALE);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      if (width > 0)
        setScale(Math.min(PREVIEW_MAX_SCALE, width / PREVIEW_PAGE_WIDTH));
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={boxRef}
      className="pointer-events-none flex h-56 justify-center overflow-hidden rounded-lg border border-border bg-muted/50"
      aria-hidden="true"
    >
      <div
        className="h-full shrink-0 overflow-hidden"
        style={{ width: PREVIEW_PAGE_WIDTH * scale }}
      >
        <div
          className="origin-top-left"
          style={{
            width: PREVIEW_PAGE_WIDTH,
            height: `${100 / scale}%`,
            transform: `scale(${scale})`,
          }}
        >
          <BioPageView
            preview
            page={{
              slug: page.slug,
              display_title: page.display_title,
              bio: null,
              avatar_url: page.avatar_url,
              theme,
              links: items.map((item, index) => ({
                ...item,
                id: index + 1,
                icon: item.icon ?? null,
              })),
            }}
          />
        </div>
      </div>
    </div>
  );
}

function AuthorLine({ template }: { template: PageTemplate }) {
  const { t } = useTranslation('templates');
  if (!template.author) return null;
  const { label, slug } = template.author;
  return (
    <p className="truncate text-xs text-muted-foreground">
      {t('by_author')}{' '}
      {slug ? (
        <a
          href={`/u/${slug}`}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-foreground underline-offset-2 hover:underline"
        >
          {label}
        </a>
      ) : (
        <span className="font-medium text-foreground">{label}</span>
      )}
    </p>
  );
}

function usesLabel(count: number, t: TFunction<'templates'>) {
  return count === 0 ? t('uses_none') : t('uses', { count });
}

// Same format as the API's author label.
function creditLabel(page: Page) {
  return [page.display_title, `@${page.slug}`].filter(Boolean).join(' · ');
}

// The gallery is remounted when a stacked modal (publish, confirm) closes,
// so the open tab lives outside it.
let lastTab = 'ready';

function TemplateCard({
  page,
  template,
  onUse,
  busy,
  badges,
  meta,
  actions,
}: {
  page: PreviewPage;
  template: PageTemplate;
  onUse: () => void;
  busy: boolean;
  badges?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const { t } = useTranslation('templates');
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-border p-3 transition-colors hover:border-primary/40">
      <TemplatePreview
        page={page}
        theme={template.theme}
        items={template.items}
      />
      <div className="min-h-12 min-w-0 space-y-1">
        {badges && <div className="flex flex-wrap gap-1">{badges}</div>}
        <div className="flex items-center justify-between gap-1">
          <p className="min-w-0 truncate text-sm font-semibold">
            {template.name}
          </p>
          {actions && <div className="-my-1 -mr-1 shrink-0">{actions}</div>}
        </div>
        {template.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {template.description}
          </p>
        )}
        {meta}
      </div>
      <Button
        className="mt-auto"
        size="xs"
        color="brand"
        fullWidth
        loading={busy}
        onClick={onUse}
      >
        {t('use_template')}
      </Button>
    </div>
  );
}

// Publishing: the author sees both versions side by side, so it is obvious
// that texts and links never leave their account.
function PublishDialog({
  template,
  page,
}: {
  template: PageTemplate;
  page: Page;
}) {
  const { t } = useTranslation('templates');
  const { data: pages } = useQuery(
    { queryKey: getPagesKey, queryFn: getPages },
    queryClient
  );
  const visiblePages = (pages ?? []).filter(isVisible);
  const [authorPageId, setAuthorPageId] = useState<string | null>(
    isVisible(page) ? String(page.id) : null
  );
  const [description, setDescription] = useState(template.description ?? '');
  const authorPage = visiblePages.find(
    candidate => String(candidate.id) === authorPageId
  );

  const { mutate: publish, isPending } = usePublishPageTemplate(
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getPageTemplatesKey });
        queryClient.invalidateQueries({ queryKey: getCommunityTemplatesKey });
        modals.close('publish-template');
        notifications.show({
          message: t('published_toast'),
          color: 'green',
        });
      },
      onError: error =>
        notifications.show({
          message: errorMessage(error, t('publish_failed')),
          color: 'red',
        }),
    },
    queryClient
  );

  return (
    <form
      className="space-y-5 pt-2"
      onSubmit={event => {
        event.preventDefault();
        if (!authorPage) return;
        publish({
          id: template.id,
          visibility: 'public',
          description: description.trim() || null,
          author_page_id: authorPage.id,
        });
      }}
    >
      <div className="flex gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
        <IconInfoCircle size={18} className="mt-0.5 shrink-0 text-primary" />
        <p>
          <span className="font-semibold">{t('publish_info_title')}</span>{' '}
          {t('publish_info_body')}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-semibold">
            {t('your_template')}{' '}
            <span className="font-normal text-muted-foreground">
              {t('only_you')}
            </span>
          </p>
          <TemplatePreview
            page={page}
            theme={template.theme}
            items={template.items}
          />
        </div>
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-semibold">{t('community_gets')}</p>
          <TemplatePreview
            page={{
              slug: 'your-page',
              display_title: 'Your name',
              avatar_url: null,
            }}
            theme={template.theme}
            items={template.public_items ?? []}
          />
        </div>
      </div>

      <Textarea
        label={t('description_label')}
        description={t('description_hint')}
        placeholder={t('description_ph')}
        maxLength={140}
        autosize
        minRows={2}
        value={description}
        onChange={event => setDescription(event.currentTarget.value)}
      />

      {visiblePages.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
          {t('publish_need_page')}
        </p>
      ) : (
        <Select
          label={t('credit_label')}
          description={t('credit_hint')}
          data={visiblePages.map(candidate => ({
            value: String(candidate.id),
            label: creditLabel(candidate),
          }))}
          value={authorPageId}
          onChange={setAuthorPageId}
          allowDeselect={false}
          comboboxProps={{ withinPortal: true, zIndex: 1000 }}
        />
      )}
      {authorPage && (
        <p className="text-xs text-muted-foreground">
          {t('shown_as')}{' '}
          <span className="font-medium text-foreground">
            {t('credit_by', { credit: creditLabel(authorPage) })}
          </span>
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button
          variant="default"
          onClick={() => modals.close('publish-template')}
        >
          {t('cancel')}
        </Button>
        <Button
          type="submit"
          color="brand"
          loading={isPending}
          disabled={!authorPage}
        >
          {t('publish')}
        </Button>
      </div>
    </form>
  );
}

function openPublishDialog(template: PageTemplate, page: Page) {
  modals.open({
    modalId: 'publish-template',
    title: (
      <span className="font-semibold">
        {i18n.t('templates:publish_title', { name: template.name })}
      </span>
    ),
    size: 'lg',
    fullScreen:
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 48em)').matches,
    children: <PublishDialog template={template} page={page} />,
  });
}

function CommunityTab({
  page,
  applying,
  onUse,
}: {
  page: Page;
  applying?: string;
  onUse: (template: PageTemplate) => void;
}) {
  const { t } = useTranslation('templates');
  const [sort, setSort] = useState<CommunityTemplatesSort>('popular');
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useGetCommunityTemplates(sort, queryClient);
  const templates = data?.pages.flatMap(result => result.page_template) ?? [];

  const { mutate: report } = useReportCommunityTemplate(
    {
      onSuccess: () =>
        notifications.show({
          message: t('report_thanks'),
          color: 'green',
        }),
      onError: () =>
        notifications.show({
          message: t('report_dup'),
          color: 'yellow',
        }),
    },
    queryClient
  );

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {t('community_intro')}
        </p>
        <SegmentedControl
          size="xs"
          value={sort}
          onChange={value => setSort(value as CommunityTemplatesSort)}
          data={[
            { label: t('sort_popular'), value: 'popular' },
            { label: t('sort_new'), value: 'new' },
          ]}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader />
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <IconUsersGroup size={28} className="mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold">
            {t('community_empty_title')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('community_empty_body')}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {templates.map(template => (
              <TemplateCard
                key={template.id}
                page={page}
                template={template}
                busy={applying === template.id}
                onUse={() => onUse(template)}
                meta={
                  <>
                    <AuthorLine template={template} />
                    <p className="text-xs text-muted-foreground">
                      {usesLabel(template.uses_count ?? 0, t)}
                    </p>
                  </>
                }
                badges={
                  template.mine ? (
                    <Badge size="xs" color="gray" variant="light">
                      {t('yours_badge')}
                    </Badge>
                  ) : undefined
                }
                actions={
                  !template.mine && (
                    <Menu position="bottom-end" withinPortal zIndex={1000}>
                      <Menu.Target>
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          size={26}
                          aria-label={t('more_for', { name: template.name })}
                        >
                          <IconDots size={16} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Label>{t('report_title')}</Menu.Label>
                        {REPORT_REASONS.map(reason => (
                          <Menu.Item
                            key={reason.value}
                            leftSection={<IconFlag size={14} />}
                            onClick={() =>
                              report({ id: template.id, reason: reason.value })
                            }
                          >
                            {t(reason.label)}
                          </Menu.Item>
                        ))}
                      </Menu.Dropdown>
                    </Menu>
                  )
                }
              />
            ))}
          </div>
          {hasNextPage && (
            <div className="mt-5 flex justify-center">
              <Button
                variant="default"
                size="xs"
                loading={isFetchingNextPage}
                onClick={() => fetchNextPage()}
              >
                {t('load_more')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Gallery({ page, onApplied }: GalleryProps) {
  const { t } = useTranslation('templates');
  const { data: templates, isLoading } = useGetPageTemplates(queryClient);
  const [applying, setApplying] = useState<string>();
  const [name, setName] = useState('');
  const hasContent = (page.links?.length ?? 0) > 0;

  const { mutate: apply } = useApplyPageTemplate(
    {
      onSuccess: (_data, variables) => {
        modals.closeAll();
        notifications.show({
          message: t('applied'),
          color: 'green',
        });
        if (variables.template.startsWith('community-')) {
          queryClient.invalidateQueries({ queryKey: getCommunityTemplatesKey });
        }
        onApplied();
      },
      onError: () =>
        notifications.show({
          message: t('apply_failed'),
          color: 'red',
        }),
      onSettled: () => setApplying(undefined),
    },
    queryClient
  );

  const { mutate: save, isPending: isSaving } = useSavePageTemplate(
    {
      onSuccess: () => {
        setName('');
        queryClient.invalidateQueries({ queryKey: getPageTemplatesKey });
        notifications.show({
          message: t('saved'),
          color: 'green',
        });
      },
      onError: error =>
        notifications.show({
          message: errorMessage(error, t('save_failed')),
          color: 'red',
        }),
    },
    queryClient
  );

  const { mutate: remove } = useDeletePageTemplate(
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getPageTemplatesKey });
        queryClient.invalidateQueries({ queryKey: getCommunityTemplatesKey });
      },
    },
    queryClient
  );

  const { mutate: unpublish } = usePublishPageTemplate(
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getPageTemplatesKey });
        queryClient.invalidateQueries({ queryKey: getCommunityTemplatesKey });
        notifications.show({
          message: t('unpublished'),
          color: 'green',
        });
      },
      onError: error =>
        notifications.show({
          message: errorMessage(error, t('update_failed')),
          color: 'red',
        }),
    },
    queryClient
  );

  function use(template: PageTemplate) {
    const run = () => {
      setApplying(template.id);
      apply({ pageId: page.id, template: template.id });
    };
    if (!hasContent) return run();
    modals.openConfirmModal({
      title: t('use_title', { name: template.name }),
      children: <p className="text-sm">{t('use_body')}</p>,
      labels: { confirm: t('use_confirm'), cancel: t('cancel') },
      confirmProps: { color: 'red' },
      onConfirm: run,
    });
  }

  function confirmUnpublish(template: PageTemplate) {
    modals.openConfirmModal({
      title: t('unpublish_title', { name: template.name }),
      children: <p className="text-sm">{t('unpublish_body')}</p>,
      labels: { confirm: t('remove'), cancel: t('cancel') },
      confirmProps: { color: 'red' },
      onConfirm: () => unpublish({ id: template.id, visibility: 'private' }),
    });
  }

  if (isLoading || !templates) {
    return (
      <div className="flex justify-center py-16">
        <Loader />
      </div>
    );
  }

  const builtIn = templates.filter(template => template.built_in);
  const mine = templates.filter(template => !template.built_in);

  return (
    <Tabs
      defaultValue={lastTab}
      onChange={value => {
        if (value) lastTab = value;
      }}
      keepMounted={false}
      className="pt-2 pb-2"
    >
      <Tabs.List grow className="mb-5">
        <Tabs.Tab value="ready">{t('tab_ready')}</Tabs.Tab>
        <Tabs.Tab value="community">{t('tab_community')}</Tabs.Tab>
        <Tabs.Tab value="yours">
          {mine.length > 0 ? t('tab_yours_count', { n: mine.length }) : t('tab_yours')}
        </Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="ready">
        <p className="mb-4 text-xs text-muted-foreground">
          {t('ready_hint')}
        </p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {builtIn.map(template => (
            <TemplateCard
              key={template.id}
              page={page}
              template={template}
              busy={applying === template.id}
              onUse={() => use(template)}
            />
          ))}
        </div>
      </Tabs.Panel>

      <Tabs.Panel value="community">
        <CommunityTab page={page} applying={applying} onUse={use} />
      </Tabs.Panel>

      <Tabs.Panel value="yours">
        <p className="mb-4 text-xs text-muted-foreground">
          {t('yours_hint')}
        </p>
        {mine.length > 0 && (
          <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-3">
            {mine.map(template => {
              const isPublic = template.visibility === 'public';
              return (
                <TemplateCard
                  key={template.id}
                  page={page}
                  template={template}
                  busy={applying === template.id}
                  onUse={() => use(template)}
                  badges={
                    isPublic ? (
                      <>
                        <Badge
                          size="xs"
                          color="brand"
                          variant="light"
                          leftSection={<IconWorld size={10} />}
                        >
                          {t('public_badge')}
                        </Badge>
                        {template.hidden && (
                          <Badge
                            size="xs"
                            color="red"
                            variant="light"
                            leftSection={<IconEyeOff size={10} />}
                          >
                            {t('review_badge')}
                          </Badge>
                        )}
                      </>
                    ) : undefined
                  }
                  meta={
                    isPublic ? (
                      <p className="text-xs text-muted-foreground">
                        {usesLabel(template.uses_count ?? 0, t)}
                      </p>
                    ) : undefined
                  }
                  actions={
                    <Menu position="bottom-end" withinPortal zIndex={1000}>
                      <Menu.Target>
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          size={26}
                          aria-label={t('more_for', { name: template.name })}
                        >
                          <IconDots size={16} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        {isPublic ? (
                          <Menu.Item
                            leftSection={<IconEyeOff size={14} />}
                            onClick={() => confirmUnpublish(template)}
                          >
                            {t('remove_community')}
                          </Menu.Item>
                        ) : (
                          <Menu.Item
                            leftSection={<IconWorld size={14} />}
                            onClick={() => openPublishDialog(template, page)}
                          >
                            {t('publish_community')}
                          </Menu.Item>
                        )}
                        <Menu.Item
                          color="red"
                          leftSection={<IconTrash size={14} />}
                          onClick={() => remove(template.id)}
                        >
                          {t('delete')}
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  }
                />
              );
            })}
          </div>
        )}
        <form
          className="flex flex-col gap-3 rounded-xl border border-dashed border-border p-4 sm:flex-row sm:items-end"
          onSubmit={event => {
            event.preventDefault();
            if (name.trim()) save({ name: name.trim(), page_id: page.id });
          }}
        >
          <TextInput
            className="flex-1"
            label={t('save_label')}
            description={t('save_desc')}
            placeholder={t('save_ph')}
            maxLength={60}
            value={name}
            onChange={event => setName(event.currentTarget.value)}
          />
          <Button
            type="submit"
            loading={isSaving}
            disabled={!name.trim() || !hasContent}
            variant="default"
          >
            {t('save_button')}
          </Button>
        </form>
      </Tabs.Panel>
    </Tabs>
  );
}

export function openTemplateGallery(props: GalleryProps) {
  modals.open({
    title: (
      <span className="flex items-center gap-2 font-semibold">
        <IconTemplate size={18} />
        {i18n.t('templates:gallery_title')}
      </span>
    ),
    size: 'xl',
    fullScreen:
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 48em)').matches,
    children: <Gallery {...props} />,
  });
}
