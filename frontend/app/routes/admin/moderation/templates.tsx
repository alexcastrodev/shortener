import { Badge, Button, Center, Loader, SegmentedControl } from '@mantine/core';
import { IconLock } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Card, PageContainer } from '@internal/ui';
import { useGetLoggedUser } from '@internal/core/actions/get-logged-user/get-logged-user.hook';
import {
  adminPageTemplatesKey,
  useAdminPageTemplates,
} from '@internal/core/actions/admin-page-templates/admin-page-templates.hook';
import type { AdminPageTemplatesStatus } from '@internal/core/actions/admin-page-templates/admin-page-templates.types';
import { useToggleTemplateHidden } from '@internal/core/actions/admin-toggle-template-hidden/admin-toggle-template-hidden.hook';
import { notifyError } from '@internal/core/utils/notify';
import { TemplatePreview } from '../../pages/components/template-gallery';
import { ModerationHeader } from './moderation-header';

export const ssr = false;

export function meta() {
  return [{ title: 'Templates - Moderation' }];
}

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export default function ModerationTemplatesPage() {
  const { data } = useGetLoggedUser();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AdminPageTemplatesStatus>('reported');
  const { data: result, isLoading, error } = useAdminPageTemplates(status);
  const templates = result?.page_template ?? [];

  const {
    mutate: toggleHidden,
    isPending,
    variables,
  } = useToggleTemplateHidden({
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: adminPageTemplatesKey() }),
    onError: () => notifyError('Could not update the template.'),
  });

  if ((data && !data.user?.admin) || error) {
    return (
      <PageContainer>
        <Alert
          variant="error"
          icon={<IconLock size={24} />}
          title="Access denied"
        >
          Only administrators can moderate templates.
        </Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="pb-24 sm:pb-10">
      <ModerationHeader section="Community templates" />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SegmentedControl
          value={status}
          onChange={value => setStatus(value as AdminPageTemplatesStatus)}
          data={[
            { label: 'Reported', value: 'reported' },
            { label: 'Hidden', value: 'hidden' },
            { label: 'Listed', value: 'public' },
          ]}
        />
        <p className="text-sm text-muted-foreground sm:ml-auto">
          Three reports hide a template until it is reviewed.
        </p>
      </div>

      {isLoading ? (
        <Center py="xl">
          <Loader size="lg" color="brand" />
        </Center>
      ) : templates.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="font-semibold text-foreground">Nothing here</p>
          <p className="mt-2 text-sm text-muted-foreground">
            No templates match this filter.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map(template => (
            <Card key={template.id} className="p-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Original
                  </p>
                  <TemplatePreview
                    page={{
                      slug: template.author_slug ?? 'author',
                      display_title: template.name,
                      avatar_url: null,
                    }}
                    theme={template.theme}
                    items={template.items}
                  />
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Public
                  </p>
                  <TemplatePreview
                    page={{
                      slug: 'your-page',
                      display_title: 'Your name',
                      avatar_url: null,
                    }}
                    theme={template.theme}
                    items={template.public_items}
                  />
                </div>
              </div>

              <div className="mt-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">
                    {template.name}
                  </p>
                  {template.description && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {template.description}
                    </p>
                  )}
                </div>
                {template.hidden ? (
                  <Badge className="shrink-0" color="red" variant="light">
                    Hidden
                  </Badge>
                ) : (
                  <Badge className="shrink-0" color="brand" variant="light">
                    Listed
                  </Badge>
                )}
              </div>

              <dl className="mt-3 space-y-1 text-sm text-muted-foreground">
                <div className="truncate">
                  Credit:{' '}
                  {template.author_slug ? (
                    <a
                      href={`/u/${template.author_slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-foreground underline-offset-2 hover:underline"
                    >
                      {template.author_label}
                    </a>
                  ) : (
                    template.author_label
                  )}
                </div>
                <div className="truncate">Owner: {template.owner_email}</div>
                <div>
                  {plural(template.uses_count, 'use')} ·{' '}
                  {plural(template.reports_count, 'report')}
                  {Object.keys(template.reasons).length > 0 &&
                    ` (${Object.entries(template.reasons)
                      .map(([reason, count]) => `${reason} ${count}`)
                      .join(', ')})`}
                </div>
              </dl>

              <Button
                className="mt-4"
                fullWidth
                variant="subtle"
                color={template.hidden ? 'green' : 'red'}
                size="sm"
                loading={isPending && variables === template.id}
                onClick={() => toggleHidden(template.id)}
              >
                {template.hidden
                  ? 'Unhide and clear reports'
                  : 'Hide from Community'}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
