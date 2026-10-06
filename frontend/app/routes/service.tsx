import type { MetaFunction } from 'react-router';
import { Card } from '@internal/ui';
import { Layout } from '../layout/web-layout';
import { ogImageMeta } from '../modules/seo';

export const meta: MetaFunction = () => [
  { title: 'How this service works - Kurz' },
  {
    name: 'description',
    content:
      'kurz.fyi is a free public demo run on a home server, with no guarantees. What that means for you.',
  },
  ...ogImageMeta(),
];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="mb-4 p-6 sm:p-8">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-muted-foreground sm:text-base">
        {children}
      </div>
    </Card>
  );
}

export default function Service() {
  return (
    <Layout>
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="text-sm font-medium text-muted-foreground">Service</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          How this service works
        </h1>
        <p className="mt-4 mb-8 text-base leading-7 text-muted-foreground">
          We would rather tell you plainly than have you find out later. Last
          updated 6 October 2026.
        </p>

        <Section title="What kurz.fyi is">
          <p>
            kurz.fyi is a free public demo of the open source Kurz project, run
            by its maintainer. Nobody is a customer and nobody is a vendor: Kurz
            does not charge anyone, has no paid plans and makes no promises of
            the kind a paid service makes. The code is public; the database is
            not.
          </p>
          <p>
            It runs on a home server. The only outside services it relies on are
            the free plans of Cloudflare (the domain name, DNS, and the bot check) and Resend
            (for sending email), so both have limits and no guarantees. There is
            no redundancy and no protection against a disaster that hits that
            machine: a power cut, a failed disk or a fire can take the service
            down, or take data with it.
          </p>
        </Section>

        <Section title="What that means for you">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-foreground">Keep your own copy.</strong>{' '}
              Anything that matters (your bookings, form responses, links)
              should also exist on your side. Use Account, Download your data,
              and the Excel or CSV exports on responses and bookings, or
              subscribe to your bookings from your own calendar app with the
              calendar feed.
            </li>
            <li>
              <strong className="text-foreground">
                No guarantee of availability.
              </strong>{' '}
              The service can be slow, limited or offline without notice. There
              is no service level agreement.
            </li>
            <li>
              <strong className="text-foreground">
                Emails are best effort.
              </strong>{' '}
              Free email plans have daily and monthly limits. When the limit is
              reached, emails are delayed or not sent until it renews. Do not
              rely on email alone.
            </li>
            <li>
              <strong className="text-foreground">
                Notifications also appear inside Kurz.
              </strong>{' '}
              Every booking event shows in the notification bell and in the
              agenda, with or without email. If you take bookings, check Kurz
              regularly.
            </li>
            <li>
              <strong className="text-foreground">
                Push notifications are optional and best effort.
              </strong>{' '}
              If you turn them on in a browser, that browser vendor’s push
              service delivers a short message to that device. It never contains
              your customers’ names or contact details. On iPhone and iPad it
              only works once Kurz is added to the home screen.
            </li>
            <li>
              <strong className="text-foreground">
                Kurz is the only source of availability.
              </strong>{' '}
              It does not read your Google Calendar or any other calendar to
              avoid clashes: the free times are the ones you set in Kurz. Keep
              your other calendars in sync yourself.
            </li>
            <li>
              <strong className="text-foreground">
                Customers can follow their booking
              </strong>{' '}
              with the link shown after booking, even when an email does not
              arrive. Ask them to keep that link.
            </li>
            <li>
              <strong className="text-foreground">
                Limits exist to prevent abuse
              </strong>
              , for example on how many forms or bookings can be created in a
              day. They are the same for everyone.
            </li>
            <li>
              <strong className="text-foreground">
                Important appointments need a backup.
              </strong>{' '}
              If a booking matters to your business, keep your own record and
              confirm it with your customer by other means.
            </li>
          </ul>
        </Section>

        <Section title="If you need guarantees">
          <p>
            Run your own copy. Kurz is open source and can be self-hosted.
            Anyone who self-hosts is responsible for their own copy, including
            its backups.
          </p>
          <p>
            What Kurz does with your data is described on the{' '}
            <a className="underline" href="/privacy">
              privacy page
            </a>
            .
          </p>
        </Section>
      </section>
    </Layout>
  );
}
