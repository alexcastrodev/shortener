import { Button, Stack, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconExternalLink } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { Link, useNavigate } from 'react-router';
import { z } from 'zod/v4';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
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

const makeSchema = (message: string) =>
  z.object({
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9][a-z0-9_.-]{1,28}[a-z0-9]$/, message),
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
  return i18n.t('pages:generic_error');
}

export default function PagesIndex() {
  const { t } = useTranslation('pages');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: pages, isLoading } = useGetPages();

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: { slug: '', display_title: '' },
    validate: zod4Resolver(makeSchema(t('slug_rule'))),
  });

  const { mutate, isPending } = useCreatePage({
    onSuccess: page => {
      queryClient.invalidateQueries({ queryKey: getPagesKey });
      navigate(`/app/pages/${page.id}`);
    },
    onError: error => {
      notifications.show({
        title: t('create_failed'),
        message: errorMessage(error),
        color: 'red',
      });
    },
  });

  return (
    <PageContainer className="pb-24 sm:pb-10">
      <div className="mb-6">
        <p className="text-sm font-medium text-muted-foreground">{t('bio_pages')}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          {t('your_pages')}
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          {isLoading && <div className="h-24 animate-pulse rounded-lg bg-muted" />}

          {!isLoading && pages?.length === 0 && (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              {t('no_pages')}
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
                  {!page.published && ` · ${t('unpublished')}`}
                </p>
              </Link>
              <a
                href={`/u/${page.slug}`}
                target="_blank"
                rel="noreferrer"
                aria-label={t('open_page', { slug: page.slug })}
                className="text-muted-foreground hover:text-foreground"
              >
                <IconExternalLink size={18} />
              </a>
            </Card>
          ))}
        </div>

        <Card className="p-5 lg:sticky lg:top-4 lg:self-start">
          <h2 className="mb-4 font-semibold">{t('new_page')}</h2>
          <form onSubmit={form.onSubmit(values => mutate(values))}>
            <Stack gap="md">
              <TextInput
                label={t('address')}
                leftSection={<span className="pl-2 text-xs">/u/</span>}
                leftSectionWidth={36}
                placeholder={t('address_placeholder')}
                key={form.key('slug')}
                {...form.getInputProps('slug')}
                required
              />
              <TextInput
                label={t('title_optional')}
                key={form.key('display_title')}
                {...form.getInputProps('display_title')}
              />
              <Button type="submit" fullWidth loading={isPending} color="brand">
                {t('create_page')}
              </Button>
            </Stack>
          </form>
        </Card>
      </div>
    </PageContainer>
  );
}
