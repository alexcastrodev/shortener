import type { MetaFunction } from 'react-router';
import { IconChartBar, IconCode, IconShieldCheck, IconUser } from '@tabler/icons-react';
import { Layout } from '../layout/web-layout';
import { Card } from '@internal/ui';

export const meta: MetaFunction = () => {
  return [
    { title: 'About - Kurz | Link Shortener' },
    {
      name: 'description',
      content:
        'Learn more about Kurz, an open-source URL shortener built around simple link creation and click analytics.',
    },
  ];
};

const items = [
  {
    icon: IconChartBar,
    title: 'Analytics included',
    description:
      'Review click data for your links, including audience context such as location, device, and browser.',
  },
  {
    icon: IconCode,
    title: 'Open source',
    description:
      'The project is transparent and available on GitHub for review, contribution, or self-hosting.',
  },
  {
    icon: IconShieldCheck,
    title: 'Safety checks',
    description:
      'Links are checked with Google Safe Browsing before they are kept active.',
  },
  {
    icon: IconUser,
    title: 'Optional account',
    description:
      'Create a link from the homepage, or sign in when you want a dashboard for management and analytics.',
  },
];

export default function About() {
  return (
    <Layout>
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="mb-10 max-w-3xl">
          <p className="text-sm font-medium text-muted-foreground">About</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Kurz keeps link shortening simple.
          </h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">
            Kurz is an open-source URL shortener for creating concise links,
            sharing them cleanly, and reviewing click data when you need it.
          </p>
        </div>

        <Card className="mb-6 p-6 sm:p-8">
          <div className="space-y-4 text-sm leading-7 text-muted-foreground sm:text-base">
            <p>
              The product is intentionally small: paste a destination URL,
              create a short link, then manage it from a focused dashboard when
              you are signed in.
            </p>
            <p>
              It is useful for campaigns, content links, referral programs, or
              everyday sharing where a shorter URL is easier to read and reuse.
            </p>
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          {items.map(({ icon: Icon, title, description }) => (
            <Card key={title} className="p-5">
              <div className="mb-4 inline-flex size-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
                <Icon size={20} stroke={1.8} />
              </div>
              <h2 className="text-base font-semibold text-foreground">
                {title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            </Card>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Create a link
          </a>
          <a
            href="/app"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-card px-5 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Open dashboard
          </a>
        </div>
      </section>
    </Layout>
  );
}
