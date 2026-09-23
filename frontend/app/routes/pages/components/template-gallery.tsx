import { Button, Loader, TextInput } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconTemplate, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import {
  getPageTemplatesKey,
  useGetPageTemplates,
} from '@internal/core/actions/get-page-templates/get-page-templates.hook';
import { useApplyPageTemplate } from '@internal/core/actions/apply-page-template/apply-page-template.hook';
import { useSavePageTemplate } from '@internal/core/actions/save-page-template/save-page-template.hook';
import { useDeletePageTemplate } from '@internal/core/actions/delete-page-template/delete-page-template.hook';
import { queryClient } from '@internal/core/service-provider';
import type { Page, PageTemplate } from '@internal/core/types/Page';
import { BioPageView } from '../../../modules/bio-page';

// Mantine modals render through a portal above the QueryClientProvider, so
// every query/mutation here gets the client explicitly.

interface GalleryProps {
  page: Page;
  onApplied: () => void;
}

// A shrunken, non-interactive render of the page as the template would
// leave it (placeholders shown, so the layout is visible).
function TemplatePreview({ page, template }: { page: Page; template: PageTemplate }) {
  return (
    <div className="pointer-events-none flex h-56 justify-center overflow-hidden rounded-lg border border-border bg-muted/50" aria-hidden="true">
      <div className="h-full w-[180px] shrink-0 overflow-hidden">
        <div className="w-[360px] origin-top-left scale-[0.5]" style={{ height: '200%' }}>
        <BioPageView
          preview
          page={{
            slug: page.slug,
            display_title: page.display_title,
            bio: null,
            avatar_url: page.avatar_url,
            theme: template.theme,
            links: template.items.map((item, index) => ({ ...item, id: index + 1, icon: item.icon ?? null })),
          }}
        />
        </div>
      </div>
    </div>
  );
}

function TemplateCard({
  page,
  template,
  onUse,
  onDelete,
  busy,
}: {
  page: Page;
  template: PageTemplate;
  onUse: () => void;
  onDelete?: () => void;
  busy: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-3 transition-colors hover:border-primary/40">
      <TemplatePreview page={page} template={template} />
      <div className="min-h-12">
        <p className="text-sm font-semibold">{template.name}</p>
        {template.description && (
          <p className="text-xs text-muted-foreground">{template.description}</p>
        )}
      </div>
      <div className="mt-auto flex gap-2">
        <Button size="xs" color="brand" fullWidth loading={busy} onClick={onUse}>
          Use this template
        </Button>
        {onDelete && (
          <Button size="xs" variant="subtle" color="red" onClick={onDelete} aria-label={`Delete ${template.name}`}>
            <IconTrash size={14} />
          </Button>
        )}
      </div>
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
      onSuccess: () => {
        modals.closeAll();
        notifications.show({
          message: 'Template applied. Placeholder links are hidden until you edit them.',
          color: 'green',
        });
        onApplied();
      },
      onError: () => notifications.show({ message: 'Could not apply the template.', color: 'red' }),
      onSettled: () => setApplying(undefined),
    },
    queryClient
  );

  const { mutate: save, isPending: isSaving } = useSavePageTemplate(
    {
      onSuccess: () => {
        setName('');
        queryClient.invalidateQueries({ queryKey: getPageTemplatesKey });
        notifications.show({ message: 'Saved to your templates.', color: 'green' });
      },
      onError: error =>
        notifications.show({
          message: Array.isArray(error?.errors) ? error.errors.join(', ') : 'Could not save the template.',
          color: 'red',
        }),
    },
    queryClient
  );

  const { mutate: remove } = useDeletePageTemplate(
    { onSuccess: () => queryClient.invalidateQueries({ queryKey: getPageTemplatesKey }) },
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
    <div className="space-y-10 pt-6 pb-2">
      <section>
        <h3 className="text-base font-semibold">Ready-made</h3>
        <p className="mt-1 mb-4 text-xs text-muted-foreground">
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
      </section>

      <section>
        <h3 className="text-base font-semibold">Your templates</h3>
        <p className="mt-1 mb-4 text-xs text-muted-foreground">Only you can see and use these.</p>
        {mine.length > 0 && (
          <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-3">
            {mine.map(template => (
              <TemplateCard
                key={template.id}
                page={page}
                template={template}
                busy={applying === template.id}
                onUse={() => use(template)}
                onDelete={() => remove(template.id)}
              />
            ))}
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
          <Button type="submit" loading={isSaving} disabled={!name.trim() || !hasContent} variant="default">
            Save template
          </Button>
        </form>
      </section>
    </div>
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
    fullScreen: typeof window !== 'undefined' && window.matchMedia('(max-width: 48em)').matches,
    children: <Gallery {...props} />,
  });
}
