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

const REPORT_REASONS: { value: PageTemplateReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam or scam' },
  { value: 'offensive', label: 'Offensive content' },
  { value: 'impersonation', label: 'Impersonation' },
  { value: 'other', label: 'Something else' },
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
  if (!template.author) return null;
  const { label, slug } = template.author;
  return (
    <p className="truncate text-xs text-muted-foreground">
      by{' '}
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

function usesLabel(count: number) {
  if (count === 0) return 'Not used yet';
  return count === 1 ? 'Used once' : `Used ${count} times`;
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
        Use this template
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
          message: 'Published to the Community.',
          color: 'green',
        });
      },
      onError: error =>
        notifications.show({
          message: errorMessage(error, 'Could not publish the template.'),
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
          <span className="font-semibold">
            Texts and links are replaced by placeholders
          </span>{' '}
          in the public version. Only the layout and theme are shared. Your copy
          keeps everything.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-semibold">
            Your template{' '}
            <span className="font-normal text-muted-foreground">
              · only you
            </span>
          </p>
          <TemplatePreview
            page={page}
            theme={template.theme}
            items={template.items}
          />
        </div>
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-semibold">What the community gets</p>
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
        label="Description"
        description="Optional, public. Links are not allowed."
        placeholder="e.g. Clean layout for musicians"
        maxLength={140}
        autosize
        minRows={2}
        value={description}
        onChange={event => setDescription(event.currentTarget.value)}
      />

      {visiblePages.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
          Templates are credited to one of your published pages. Publish a page
          first.
        </p>
      ) : (
        <Select
          label="Credit"
          description="Your email is never shown."
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
          Shown as:{' '}
          <span className="font-medium text-foreground">
            by {creditLabel(authorPage)}
          </span>
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button
          variant="default"
          onClick={() => modals.close('publish-template')}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          color="brand"
          loading={isPending}
          disabled={!authorPage}
        >
          Publish
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
        Publish “{template.name}” to the Community
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
  const [sort, setSort] = useState<CommunityTemplatesSort>('popular');
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useGetCommunityTemplates(sort, queryClient);
  const templates = data?.pages.flatMap(result => result.page_template) ?? [];

  const { mutate: report } = useReportCommunityTemplate(
    {
      onSuccess: () =>
        notifications.show({
          message: 'Thanks for the report. We will take a look.',
          color: 'green',
        }),
      onError: () =>
        notifications.show({
          message: 'You already reported this template.',
          color: 'yellow',
        }),
    },
    queryClient
  );

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Layouts shared by other people. You get a copy with placeholders.
        </p>
        <SegmentedControl
          size="xs"
          value={sort}
          onChange={value => setSort(value as CommunityTemplatesSort)}
          data={[
            { label: 'Popular', value: 'popular' },
            { label: 'New', value: 'new' },
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
            No Community templates yet
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Save a page as a template in the Yours tab and publish it.
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
                      {usesLabel(template.uses_count ?? 0)}
                    </p>
                  </>
                }
                badges={
                  template.mine ? (
                    <Badge size="xs" color="gray" variant="light">
                      Yours
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
                          aria-label={`More for ${template.name}`}
                        >
                          <IconDots size={16} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Label>Report template</Menu.Label>
                        {REPORT_REASONS.map(reason => (
                          <Menu.Item
                            key={reason.value}
                            leftSection={<IconFlag size={14} />}
                            onClick={() =>
                              report({ id: template.id, reason: reason.value })
                            }
                          >
                            {reason.label}
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
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Gallery({ page, onApplied }: GalleryProps) {
  const { data: templates, isLoading } = useGetPageTemplates(queryClient);
  const [applying, setApplying] = useState<string>();
  const [name, setName] = useState('');
  const hasContent = (page.links?.length ?? 0) > 0;

  const { mutate: apply } = useApplyPageTemplate(
    {
      onSuccess: (_data, variables) => {
        modals.closeAll();
        notifications.show({
          message:
            'Template applied. Placeholder links are hidden until you edit them.',
          color: 'green',
        });
        if (variables.template.startsWith('community-')) {
          queryClient.invalidateQueries({ queryKey: getCommunityTemplatesKey });
        }
        onApplied();
      },
      onError: () =>
        notifications.show({
          message: 'Could not apply the template.',
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
          message: 'Saved to your templates.',
          color: 'green',
        });
      },
      onError: error =>
        notifications.show({
          message: errorMessage(error, 'Could not save the template.'),
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
          message: 'Removed from the Community.',
          color: 'green',
        });
      },
      onError: error =>
        notifications.show({
          message: errorMessage(error, 'Could not update the template.'),
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
      title: `Use “${template.name}”?`,
      children: (
        <p className="text-sm">
          This replaces the links, sections and theme of this page. Your title,
          bio and photo stay.
        </p>
      ),
      labels: { confirm: 'Replace content', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: run,
    });
  }

  function confirmUnpublish(template: PageTemplate) {
    modals.openConfirmModal({
      title: `Remove “${template.name}” from the Community?`,
      children: (
        <p className="text-sm">
          It stops being listed right away. Pages other people already made from
          it are their own copies and stay as they are.
        </p>
      ),
      labels: { confirm: 'Remove', cancel: 'Cancel' },
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
        <Tabs.Tab value="ready">Ready-made</Tabs.Tab>
        <Tabs.Tab value="community">Community</Tabs.Tab>
        <Tabs.Tab value="yours">
          Yours{mine.length > 0 ? ` (${mine.length})` : ''}
        </Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="ready">
        <p className="mb-4 text-xs text-muted-foreground">
          Links start hidden: fill them in or delete what you do not need.
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
          Private unless you publish one. The public version never includes your
          texts or links.
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
                          Public
                        </Badge>
                        {template.hidden && (
                          <Badge
                            size="xs"
                            color="red"
                            variant="light"
                            leftSection={<IconEyeOff size={10} />}
                          >
                            Under review
                          </Badge>
                        )}
                      </>
                    ) : undefined
                  }
                  meta={
                    isPublic ? (
                      <p className="text-xs text-muted-foreground">
                        {usesLabel(template.uses_count ?? 0)}
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
                          aria-label={`More for ${template.name}`}
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
                            Remove from Community
                          </Menu.Item>
                        ) : (
                          <Menu.Item
                            leftSection={<IconWorld size={14} />}
                            onClick={() => openPublishDialog(template, page)}
                          >
                            Publish to Community
                          </Menu.Item>
                        )}
                        <Menu.Item
                          color="red"
                          leftSection={<IconTrash size={14} />}
                          onClick={() => remove(template.id)}
                        >
                          Delete
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
            label="Save this page as a template"
            description="Keeps its links, sections and theme."
            placeholder="e.g. My creator layout"
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
            Save template
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
        Templates
      </span>
    ),
    size: 'xl',
    fullScreen:
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 48em)').matches,
    children: <Gallery {...props} />,
  });
}
