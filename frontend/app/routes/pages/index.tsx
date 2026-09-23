import { Button, Stack, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconExternalLink } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { Link, useNavigate } from 'react-router';
import { z } from 'zod/v4';
import { Card, PageContainer } from '@internal/ui';
import {
  getPagesKey,
  useGetPages,
} from '@internal/core/actions/get-pages/get-pages.hook';
import { useCreatePage } from '@internal/core/actions/create-page/create-page.hook';
import type { Route } from './+types/index';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Bio pages - Kurz' },
    { name: 'description', content: 'Manage your bio link pages' },
  ];
}

export const ssr = false;

const schema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9][a-z0-9_.-]{1,28}[a-z0-9]$/,
      '3–30 characters: letters, numbers, ".", "_" or "-"'
    ),
  display_title: z.string().optional(),
});

function errorMessage(error: unknown) {
  const errors = (error as { errors?: unknown } | undefined)?.errors;
  if (Array.isArray(errors)) return errors.join(', ');
  if (errors && typeof errors === 'object') {
    return Object.entries(errors)
      .map(([key, value]) => `${key} ${value}`)
      .join(', ');
  }
  return 'Something went wrong, please try again later.';
}

export default function PagesIndex() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: pages, isLoading } = useGetPages();

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: { slug: '', display_title: '' },
    validate: zod4Resolver(schema),
  });

  const { mutate, isPending } = useCreatePage({
    onSuccess: page => {
      queryClient.invalidateQueries({ queryKey: getPagesKey });
      navigate(`/app/pages/${page.id}`);
    },
    onError: error => {
      notifications.show({
        title: 'Could not create page',
        message: errorMessage(error),
        color: 'red',
      });
    },
  });

  return (
    <PageContainer className="pb-24 sm:pb-10">
      <div className="mb-6">
        <p className="text-sm font-medium text-muted-foreground">Bio pages</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          Your pages
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          {isLoading && <div className="h-24 animate-pulse rounded-lg bg-muted" />}

          {!isLoading && pages?.length === 0 && (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              No pages yet. Pick an address to create your first one.
            </Card>
          )}

          {pages?.map(page => (
            <Card key={page.id} className="flex items-center justify-between gap-4 p-4">
              <Link to={`/app/pages/${page.id}`} className="min-w-0 flex-1">
                <p className="truncate font-semibold text-foreground">
                  {page.display_title || `@${page.slug}`}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  kurz.fyi/u/{page.slug}
                  {!page.published && ' · Unpublished'}
                </p>
              </Link>
              <a
                href={`/u/${page.slug}`}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open ${page.slug}`}
                className="text-muted-foreground hover:text-foreground"
              >
                <IconExternalLink size={18} />
              </a>
            </Card>
          ))}
        </div>

        <Card className="p-5 lg:sticky lg:top-4 lg:self-start">
          <h2 className="mb-4 font-semibold">New page</h2>
          <form onSubmit={form.onSubmit(values => mutate(values))}>
            <Stack gap="md">
              <TextInput
                label="Address"
                leftSection={<span className="pl-2 text-xs">/u/</span>}
                leftSectionWidth={36}
                placeholder="yourname"
                key={form.key('slug')}
                {...form.getInputProps('slug')}
                required
              />
              <TextInput
                label="Title (optional)"
                key={form.key('display_title')}
                {...form.getInputProps('display_title')}
              />
              <Button type="submit" fullWidth loading={isPending} color="brand">
                Create page
              </Button>
            </Stack>
          </form>
        </Card>
      </div>
    </PageContainer>
  );
}
