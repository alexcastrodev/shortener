import { useEffect, useRef, useState } from 'react';
import { data, isRouteErrorResponse } from 'react-router';
import { getPublicForm } from '@internal/core/actions/get-public-form/get-public-form.service';
import { submitFormResponse } from '@internal/core/actions/submit-form-response/submit-form-response.service';
import { trackFormEvent } from '@internal/core/actions/track-form-event/track-form-event.service';
import type { SubmitFormResponseError } from '@internal/core/actions/submit-form-response/submit-form-response.types';
import { getBioTheme } from '../../modules/bio-page/themes';
import {
  Turnstile,
  TURNSTILE_SITE_KEY,
  type TurnstileHandle,
} from '../../modules/auth/turnstile';
import {
  FormRenderer,
  type SubmitFailure,
} from '../../modules/forms/form-renderer';
import type { Route } from './+types/$publicId';

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const form = await getPublicForm(params.publicId);
  if (!form) throw data('Form not found', { status: 404 });

  return { form, publicId: params.publicId };
}

export function headers() {
  return {
    'Content-Security-Policy': "frame-ancestors 'none'",
    'X-Frame-Options': 'DENY',
  };
}

export function meta() {
  return [
    { title: 'Form - Kurz' },
    { name: 'robots', content: 'noindex, nofollow' },
  ];
}

export function HydrateFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className="size-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
    </div>
  );
}

function failureFor(error: SubmitFormResponseError): SubmitFailure {
  if (error.status === 422 && error.errors?.answers && !Array.isArray(error.errors.answers)) {
    return { fieldErrors: error.errors.answers };
  }
  if (error.status === 403) return { message: 'We could not verify you are human. Please try again.' };
  if (error.status === 429) return { message: 'Too many attempts. Please wait a few minutes and try again.' };
  if (error.status === 404) return { message: 'This form is no longer accepting answers.' };
  if (error.status === 413) return { message: 'Your answers are too long.' };
  return { message: 'We could not send your answers. Please try again.' };
}

export default function PublicForm({ loaderData }: Route.ComponentProps) {
  const { form, publicId } = loaderData;
  const theme = getBioTheme(form.theme);
  const idempotencyKey = useRef(crypto.randomUUID());
  const turnstile = useRef<TurnstileHandle>(null);
  const [token, setToken] = useState<string | null>(null);
  const [website, setWebsite] = useState('');
  const viewed = useRef(false);
  const started = useRef(false);

  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    trackFormEvent(publicId, 'view');
  }, [publicId]);

  const onSubmit = async (answers: Record<string, unknown>) => {
    if (TURNSTILE_SITE_KEY && !token) {
      throw { message: 'Verifying you are human, please wait a moment and send again.' } satisfies SubmitFailure;
    }
    try {
      await submitFormResponse({
        publicId,
        answers,
        idempotencyKey: idempotencyKey.current,
        turnstileToken: token,
        website,
        referer: document.referrer,
      });
    } catch (error) {
      throw failureFor(error as SubmitFormResponseError);
    } finally {
      turnstile.current?.reset();
    }
  };

  return (
    <FormRenderer
      mode="live"
      form={form}
      onSubmit={onSubmit}
      onStart={() => {
        if (started.current) return;
        started.current = true;
        trackFormEvent(publicId, 'start');
      }}
      lastStepSlot={
        <>
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>
              Leave this field empty
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={event => setWebsite(event.target.value)}
              />
            </label>
          </div>
          <div className="mt-4">
            <Turnstile ref={turnstile} action="form_response" onToken={setToken} />
          </div>
        </>
      }
      footer={
        <footer className={`mt-auto pt-10 text-xs leading-5 ${theme.bio}`}>
          <p>
            This is a public demo of the open source Kurz project. Your answers
            go to the owner of this form. Kurz records your country, device,
            browser and where you came from, never your IP address.
          </p>
          <p className="mt-2">Never submit passwords or card numbers through a form.</p>
          <a
            href={`/report?form=${encodeURIComponent(publicId)}`}
            className={`mt-2 inline-block underline ${theme.footer}`}
          >
            Report this form
          </a>
        </footer>
      }
    />
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const notFound = isRouteErrorResponse(error) && error.status === 404;

  return (
    <div className="min-h-dvh bg-background px-4 pt-24 text-center text-foreground">
      <h1 className="text-xl font-semibold">
        {notFound ? 'Form not found' : 'Something went wrong'}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {notFound
          ? 'This form does not exist or is no longer accepting answers.'
          : 'Please try again in a moment.'}
      </p>
      <a href="/" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">
        Go to Kurz
      </a>
    </div>
  );
}
