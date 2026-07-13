import type { MetaFunction } from 'react-router';
import { IconAlertTriangle, IconMail } from '@tabler/icons-react';
import { Layout } from '../layout/web-layout';
import { Card } from '@internal/ui';

export const meta: MetaFunction = () => {
  return [
    { title: 'Report Abuse - Kurz | Link Shortener' },
    {
      name: 'description',
      content:
        'Report abusive, phishing, or malicious shortened links on Kurz.',
    },
  ];
};

export default function Report() {
  return (
    <Layout>
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="mb-10 max-w-3xl">
          <p className="text-sm font-medium text-muted-foreground">
            Report Abuse
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Found a suspicious link?
          </h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">
            If you have encountered a Kurz shortened link that leads to
            phishing, malware, scams, or any other abusive content, please
            report it so we can take action.
          </p>
        </div>

        <Card className="mb-6 p-6 sm:p-8">
          <div className="mb-6 inline-flex size-12 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <IconAlertTriangle size={24} stroke={1.8} />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            How to report
          </h2>
          <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground sm:text-base">
            <p>
              Send an email to the address below with the shortened link you
              want to report. Include any relevant context, such as where you
              found it and why you believe it is abusive.
            </p>
            <div className="flex items-center gap-3 rounded-md border border-border bg-muted/50 px-4 py-3">
              <IconMail size={20} stroke={1.8} className="text-foreground" />
              <a
                href="mailto:kurz.fyi@gmail.com"
                className="text-sm font-semibold text-foreground underline-offset-4 hover:underline sm:text-base"
              >
                kurz.fyi@gmail.com
              </a>
            </div>
            <p>
              We review every report and will deactivate links that violate our
              policies. All links are audited so we can trace who created them
              and when.
            </p>
          </div>
        </Card>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-card px-5 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Back to home
          </a>
        </div>
      </section>
    </Layout>
  );
}
