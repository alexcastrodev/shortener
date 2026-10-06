import type { MetaFunction } from 'react-router';
import { Card } from '@internal/ui';
import { Layout } from '../layout/web-layout';
import { ogImageMeta } from '../modules/seo';

export const meta: MetaFunction = () => [
  { title: 'Privacy - Kurz' },
  {
    name: 'description',
    content: 'What Kurz collects, who receives it, how long it is kept and how to access or delete your data.',
  },
  ...ogImageMeta(),
];

const CONTACT = 'kurz.fyi@gmail.com';

const RETENTION = [
  ['IP address, browser string (user agent) and referring page of a click', '90 days, then erased'],
  ['Country, region, browser and platform of a click', 'Kept, as statistics without an identity'],
  ['Calls made by connected AI apps (tool name, result, time, never the content)', '90 days'],
  ['Your account, links, bio pages, forms and responses', 'Until you delete the account, then 30 days offline before permanent deletion'],
  ['Sign-in codes', '15 minutes'],
  ['Bookings (name, email, phone, note, dates)', 'Until the owner deletes them or the account is deleted'],
  ['Notifications inside Kurz', '90 days'],
  ['Booking emails queued but not sent', 'Up to 24 hours, then dropped'],
  ['Push subscriptions (browser address and keys)', 'Until you remove the device or the browser invalidates it'],
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="mb-4 p-6 sm:p-8">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-muted-foreground sm:text-base">{children}</div>
    </Card>
  );
}

export default function Privacy() {
  return (
    <Layout>
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="text-sm font-medium text-muted-foreground">Privacy</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">What Kurz does with your data</h1>
        <p className="mt-4 mb-8 text-base leading-7 text-muted-foreground">
          This describes what the software on kurz.fyi actually does. Last updated 6 October 2026.
        </p>

        <Section title="Who runs this">
          <p>
            kurz.fyi is a public demo of the open source Kurz project, run by its maintainer. Questions, access and
            deletion requests: <a className="underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>. Anyone who
            self-hosts Kurz is responsible for their own copy.
          </p>
        </Section>

        <Section title="What is collected, and from whom">
          <p>
            <strong className="text-foreground">If you have an account:</strong> your email address; a password only
            if you set one (stored hashed, never readable); your Google account id and email if you sign in with
            Google; and what you create: short links, bio pages, forms, the responses and images they receive, saved
            templates and palettes, and the apps you connect. A session cookie (<code>kurz_session</code>, not readable
            by scripts) keeps you signed in. There are no advertising or analytics cookies and no tracking scripts.
          </p>
          <p>
            <strong className="text-foreground">If you open a short link or click a link on a bio page:</strong> the
            owner of the link sees statistics about the click. We record the IP address, your browser string and the
            page you came from, plus country and region (provided by Cloudflare) and the browser and platform derived
            from them.
          </p>
          <p>
            <strong className="text-foreground">If you answer a form:</strong> what you type and the images you
            choose, which only the form owner can see, plus country, browser, platform and the kind of site you came
            from. Your IP address is not stored. Images are converted and kept in private storage. The owner of the
            form decides what to ask and is responsible for how they use the answers, so do not enter passwords or card
            numbers in a form.
          </p>
          <p>
            <strong className="text-foreground">If you book an appointment through a form:</strong> your name, email
            address, the service, the dates and times you choose, and anything you type in the form (for example a phone
            number or a note). Only the owner of the form can see it. The owner decides how to use it and is responsible
            for it, so do not enter sensitive information in a note. Your IP address is not stored. Bookings are kept until
            the owner deletes them or deletes their account; ask the owner, or write to us, if you want yours removed. If you give
            your email, you can follow, cancel or confirm your booking from links in the emails.
          </p>
        </Section>

        <Section title="Booking owners">
          <p>
            If you use Kurz to take bookings, you are the one responsible for your customers’ data. Tell them what you
            collect and why, answer their requests, and do not use Kurz for anything that needs guarantees of delivery
            or availability. See <a className="underline" href="/service">how this service works</a>.
          </p>
          <p>
            The calendar feed, if you turn it on, is a secret address: anyone who has it can read the names and times of
            your confirmed bookings. You can replace or revoke it from your account page at any time.
          </p>
        </Section>

        <Section title="Who else receives data">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-foreground">Cloudflare</strong> delivers the site and runs a bot check on sign-in
              and on forms, so it sees your IP address and browser details.
            </li>
            <li>
              <strong className="text-foreground">Resend</strong> sends emails, including sign-in codes and booking messages
              (confirmations, requests, reminders, waiting list notices), so it receives the recipient’s email address and
              the message text. Sending is limited per day and per month; when the limit is reached, booking emails are
              delayed or not sent, and the same information stays available inside Kurz.
            </li>
            <li>
              <strong className="text-foreground">Browser push services</strong> (for example Google, Mozilla or Apple)
              deliver push notifications if you turn them on. They receive your device’s push address and an encrypted
              message, and they can see that a message was sent and when. Messages never contain your customers’ names or
              contact details.
            </li>
            <li>
              <strong className="text-foreground">Google</strong> receives the destination URL of links to check them
              with Safe Browsing, and your sign-in details if you choose Sign in with Google.
            </li>
            <li>
              <strong className="text-foreground">Sentry</strong> receives error reports with request bodies,
              cookies, IP addresses and what people typed removed.
            </li>
            <li>
              <strong className="text-foreground">AI apps you connect</strong> (for example Claude or ChatGPT) receive
              what you allow on the consent screen. If you allow reading responses, what respondents typed is sent to
              that service. You can disconnect any app from your account page.
            </li>
          </ul>
          <p>We do not sell data and do not use it for advertising.</p>
        </Section>

        <Section title="How long it is kept">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <tbody>
                {RETENTION.map(([what, how]) => (
                  <tr key={what} className="border-b border-border last:border-b-0">
                    <td className="py-2 pr-4 align-top text-foreground">{what}</td>
                    <td className="py-2 align-top">{how}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Your choices">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-foreground">Get a copy:</strong> Account, Download your data (JSON), and Export on
              a form’s responses page (Excel or CSV).
            </li>
            <li>
              <strong className="text-foreground">Delete everything:</strong> Account, Delete account. Your content goes
              offline at once and is permanently deleted after 30 days; signing in again before then cancels it.
            </li>
            <li>
              <strong className="text-foreground">Correct or remove items:</strong> edit or delete links, pages, forms
              and responses from the dashboard at any time.
            </li>
            <li>
              <strong className="text-foreground">Other requests, or if you answered a form or clicked a link and want
              something removed:</strong> write to <a className="underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>.
              You can also complain to your data protection authority.
            </li>
          </ul>
        </Section>

        <Section title="Changes">
          <p>
            When what Kurz collects changes, this page changes with it, and the history is public in the project’s
            repository.
          </p>
        </Section>
      </section>
    </Layout>
  );
}
