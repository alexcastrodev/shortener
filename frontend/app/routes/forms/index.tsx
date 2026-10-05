import {
  ActionIcon,
  Button,
  Menu,
  SegmentedControl,
  Select,
  Text,
  TextInput,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconChartBar,
  IconCopy,
  IconDots,
  IconExternalLink,
  IconFileText,
  IconLayoutGrid,
  IconLink,
  IconList,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useDebouncedValue } from '@mantine/hooks';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Card, PageContainer } from '@internal/ui';
import {
  getFormsKey,
  useGetForms,
} from '@internal/core/actions/get-forms/get-forms.hook';
import { useGetFormTemplates } from '@internal/core/actions/get-form-templates/get-form-templates.hook';
import { useCreateForm } from '@internal/core/actions/create-form/create-form.hook';
import { useDeleteForm } from '@internal/core/actions/delete-form/delete-form.hook';
import { useDuplicateForm } from '@internal/core/actions/duplicate-form/duplicate-form.hook';
import type { Form } from '@internal/core/types/Form';
import { formErrorMessage } from '../../modules/forms/form-errors';
import { isSection } from '../../modules/forms/field-types';
import type { Route } from './+types/index';

dayjs.extend(relativeTime);

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Forms - Kurz' },
    { name: 'description', content: 'Create forms and read the answers' },
  ];
}

export const ssr = false;

type Status = 'all' | 'live' | 'draft';
type Sort = 'edited' | 'name' | 'responses';
type View = 'list' | 'grid';

const questionsOf = (form: Form) => form.fields.filter(field => !isSection(field)).length;
const plural = (count: number, word: string) => `${count.toLocaleString()} ${word}${count === 1 ? '' : 's'}`;

function StatusBadge({ published }: { published: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
        published ? 'bg-teal-500/15 text-teal-400' : 'bg-muted text-muted-foreground'
      }`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {published ? 'Live' : 'Draft'}
    </span>
  );
}

export default function FormsIndex() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: templates } = useGetFormTemplates();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status>('all');
  const [sort, setSort] = useState<Sort>('edited');
  const [search] = useDebouncedValue(query.trim(), 250);
  const { data, isLoading } = useGetForms({ q: search, status, sort });
  const [view, setView] = useState<View>('list');

  const onError = (title: string) => (error: unknown) =>
    notifications.show({ title, message: formErrorMessage(error), color: 'red' });

  const { mutate: create, isPending: isCreating } = useCreateForm({
    onSuccess: created => {
      queryClient.invalidateQueries({ queryKey: getFormsKey });
      navigate(`/app/forms/${created.id}`);
    },
    onError: onError('Could not create form'),
  });

  const { mutate: duplicate } = useDuplicateForm({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getFormsKey });
      notifications.show({ message: 'Form duplicated', color: 'teal' });
    },
    onError: onError('Could not duplicate form'),
  });

  const { mutate: remove } = useDeleteForm({
    onSuccess: () => queryClient.invalidateQueries({ queryKey: getFormsKey }),
    onError: onError('Could not delete form'),
  });

  const confirmDelete = (item: Form) => {
    modals.openConfirmModal({
      title: 'Delete this form?',
      centered: true,
      children: (
        <Text size="sm">
          “{item.title}” and its {plural(item.responses_count, 'response')} will be deleted for
          good. This cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete form', cancel: 'Keep it' },
      confirmProps: { color: 'red' },
      onConfirm: () => remove(item.id),
    });
  };

  const copyLink = async (item: Form) => {
    try {
      await navigator.clipboard.writeText(item.short_url ?? item.public_url);
      notifications.show({ message: 'Link copied', color: 'teal' });
    } catch {
      notifications.show({ message: item.short_url ?? item.public_url, color: 'gray' });
    }
  };

  const visible = data?.form ?? [];
  const counts = data?.meta ?? { total: 0, live: 0, draft: 0, responses: 0 };

  const actions = (item: Form) => (
    <div className="flex items-center justify-end gap-1">
      {item.published && (
        <ActionIcon
          variant="subtle"
          color="gray"
          aria-label={`Copy link of ${item.title}`}
          onClick={() => copyLink(item)}
        >
          <IconLink size={16} />
        </ActionIcon>
      )}
      <ActionIcon
        variant="subtle"
        color="gray"
        aria-label={`Responses of ${item.title}`}
        onClick={() => navigate(`/app/forms/${item.id}/responses`)}
      >
        <IconChartBar size={16} />
      </ActionIcon>
      <Menu position="bottom-end" withinPortal>
        <Menu.Target>
          <ActionIcon variant="subtle" color="gray" aria-label={`More actions for ${item.title}`}>
            <IconDots size={16} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item
            leftSection={<IconPencil size={14} />}
            onClick={() => navigate(`/app/forms/${item.id}`)}
          >
            Edit
          </Menu.Item>
          {item.published && (
            <Menu.Item
              component="a"
              href={`/f/${item.public_id}`}
              target="_blank"
              rel="noreferrer"
              leftSection={<IconExternalLink size={14} />}
            >
              Open form
            </Menu.Item>
          )}
          <Menu.Item
            leftSection={<IconCopy size={14} />}
            onClick={() => duplicate({ id: item.id })}
          >
            Duplicate
          </Menu.Item>
          <Menu.Divider />
          <Menu.Item
            color="red"
            c="red.5"
            leftSection={<IconTrash size={14} />}
            onClick={() => confirmDelete(item)}
          >
            Delete
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </div>
  );

  const icon = (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
      <IconFileText size={18} />
    </span>
  );

  return (
    <PageContainer className="pb-24 sm:pb-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Forms</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Your forms</h1>
          {!isLoading && (
            <p className="mt-1 text-sm text-muted-foreground">
              {plural(counts.total, 'form')} · {counts.live} live · {plural(counts.responses, 'total response')}
            </p>
          )}
        </div>
        <Button
          color="brand"
          leftSection={<IconPlus size={16} />}
          loading={isCreating}
          onClick={() => create({ title: 'Untitled form' })}
        >
          New form
        </Button>
      </div>

      <div className="mb-8">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">Start from a template</h2>
          <span className="text-xs text-muted-foreground">Every template is fully editable</span>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {[{ id: '', name: 'Blank form', hint: 'Start from scratch' }]
            .concat(
              (templates ?? []).map(template => ({
                id: template.id,
                name: template.name,
                hint: plural(template.questions, 'question'),
              }))
            )
            .map(template => (
              <button
                key={template.id || 'blank'}
                type="button"
                disabled={isCreating}
                onClick={() =>
                  create({
                    title: template.id ? template.name : 'Untitled form',
                    template: template.id || undefined,
                  })
                }
                className="rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary disabled:opacity-50"
              >
                <span className="mb-4 flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  {template.id ? <IconFileText size={18} /> : <IconPlus size={18} />}
                </span>
                <span className="block text-sm font-semibold">{template.name}</span>
                <span className="block text-xs text-muted-foreground">{template.hint}</span>
              </button>
            ))}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <TextInput
          className="w-full sm:w-64"
          placeholder="Search forms"
          aria-label="Search forms"
          leftSection={<IconSearch size={16} />}
          value={query}
          onChange={event => setQuery(event.currentTarget.value)}
        />
        <SegmentedControl
          value={status}
          onChange={value => setStatus(value as Status)}
          data={[
            { value: 'all', label: `All ${counts.total}` },
            { value: 'live', label: `Live ${counts.live}` },
            { value: 'draft', label: `Draft ${counts.draft}` },
          ]}
        />
        <div className="ml-auto flex items-center gap-3">
          <Select
            aria-label="Sort"
            allowDeselect={false}
            value={sort}
            onChange={value => setSort((value as Sort) ?? 'edited')}
            data={[
              { value: 'edited', label: 'Last edited' },
              { value: 'name', label: 'Name' },
              { value: 'responses', label: 'Responses' },
            ]}
            w={150}
          />
          <SegmentedControl
            aria-label="View"
            value={view}
            onChange={value => setView(value as View)}
            data={[
              { value: 'list', label: <IconList size={16} aria-label="List" /> },
              { value: 'grid', label: <IconLayoutGrid size={16} aria-label="Grid" /> },
            ]}
          />
        </div>
      </div>

      {isLoading && <div className="h-40 animate-pulse rounded-lg bg-muted" />}

      {!isLoading && visible.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          {counts.total === 0
            ? 'No forms yet. Start from a template or a blank form.'
            : 'No forms match your search.'}
        </Card>
      )}

      {visible.length > 0 && view === 'list' && (
        <Card className="overflow-hidden p-0">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border px-5 py-3 text-xs text-muted-foreground sm:grid-cols-[minmax(0,1fr)_90px_90px_140px_130px]">
            <span>Name</span>
            <span className="hidden sm:block">Status</span>
            <span className="hidden text-right sm:block">Responses</span>
            <span className="hidden sm:block">Last edited</span>
            <span />
          </div>
          {visible.map(item => (
            <div
              key={item.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border px-5 py-3 last:border-b-0 hover:bg-muted/40 sm:grid-cols-[minmax(0,1fr)_90px_90px_140px_130px]"
            >
              <Link to={`/app/forms/${item.id}`} className="flex min-w-0 items-center gap-3">
                {icon}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {item.title}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {plural(questionsOf(item), 'question')}
                  </span>
                </span>
              </Link>
              <span className="hidden sm:block">
                <StatusBadge published={item.published} />
              </span>
              <span className="hidden text-right text-sm tabular-nums sm:block">
                {item.responses_count.toLocaleString()}
              </span>
              <span className="hidden text-sm text-muted-foreground sm:block">
                {dayjs(item.updated_at).fromNow()}
              </span>
              {actions(item)}
            </div>
          ))}
        </Card>
      )}

      {visible.length > 0 && view === 'grid' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map(item => (
            <Card key={item.id} className="flex flex-col gap-4 p-4">
              <div className="flex items-start justify-between gap-2">
                <Link to={`/app/forms/${item.id}`} className="flex min-w-0 items-center gap-3">
                  {icon}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {item.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {plural(questionsOf(item), 'question')}
                    </span>
                  </span>
                </Link>
                <StatusBadge published={item.published} />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {plural(item.responses_count, 'response')} · {dayjs(item.updated_at).fromNow()}
                </span>
                {actions(item)}
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
