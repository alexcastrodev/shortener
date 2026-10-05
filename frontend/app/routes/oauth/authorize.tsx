import { Alert as MantineAlert, Button, Switch } from '@mantine/core';
import { IconShieldCheck } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { BrandMark, Card } from '@internal/ui';
import { useGetOauthAuthorization } from '@internal/core/actions/get-oauth-authorization/get-oauth-authorization.hook';
import { useDecideOauthAuthorization } from '@internal/core/actions/decide-oauth-authorization/decide-oauth-authorization.hook';
import { rememberAuthorization } from '../../modules/oauth/return-to';
import { SCOPE_LABELS } from '../../modules/oauth/scopes';

export const ssr = false;

export function headers() {
  return {
    'Content-Security-Policy': "frame-ancestors 'none'",
    'X-Frame-Options': 'DENY',
  };
}

export function meta() {
  return [
    { title: 'Authorize app - Kurz' },
    { name: 'robots', content: 'noindex, nofollow' },
  ];
}

const PUBLISH = ['forms:publish', 'pages:publish'];
const SENSITIVE = ['responses:read', ...PUBLISH];

const KEYS = [
  'client_id',
  'redirect_uri',
  'response_type',
  'code_challenge',
  'code_challenge_method',
  'scope',
  'resource',
  'state',
];

function safeRedirect(url: string) {
  try {
    const target = new URL(url);
    return target.protocol === 'https:' || target.protocol === 'http:' ? target.toString() : null;
  } catch {
    return null;
  }
}

export default function AuthorizeApp() {
  const [search, setSearch] = useState('');
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const current = window.location.search;
    rememberAuthorization(current);
    setSearch(current);
  }, []);

  const params = useMemo(() => {
    const query = new URLSearchParams(search);
    return Object.fromEntries(KEYS.flatMap(key => (query.has(key) ? [[key, query.get(key) ?? '']] : [])));
  }, [search]);
  const query = useMemo(() => (search ? `?${new URLSearchParams(params)}` : ''), [params, search]);

  const preview = useGetOauthAuthorization(query);
  const { mutate, isPending } = useDecideOauthAuthorization({
    onSuccess: ({ redirect_to }) => {
      const target = safeRedirect(redirect_to);
      if (target) window.location.assign(target);
    },
  });

  useEffect(() => {
    if (!preview.data) return;
    setEnabled(Object.fromEntries(preview.data.scopes.map(scope => [scope, !SENSITIVE.includes(scope)])));
  }, [preview.data]);

  useEffect(() => {
    const failure = preview.error;
    const target = failure?.redirect_to && safeRedirect(failure.redirect_to);
    if (target) window.location.assign(target);
  }, [preview.error]);

  const granted = Object.keys(enabled).filter(scope => enabled[scope]);
  const readsResponses = !!enabled['responses:read'];
  const publishes = PUBLISH.some(scope => enabled[scope]);
  const decide = (decision: 'allow' | 'deny') => mutate({ params, decision, grantedScopes: granted });

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="mb-8">
        <BrandMark />
      </div>
      <Card className="w-full max-w-md p-6">
        {!search || preview.isLoading || preview.error?.redirect_to ? (
          <div className="h-32 animate-pulse rounded-md bg-muted" />
        ) : preview.error ? (
          <div role="alert">
            <h1 className="text-lg font-semibold">We cannot connect this app</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The request is not valid. Go back to the app and try again.
            </p>
          </div>
        ) : preview.data ? (
          <>
            <div className="mb-4 inline-flex size-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
              <IconShieldCheck size={20} stroke={1.8} />
            </div>
            <h1 className="text-lg font-semibold">
              <span className="break-words">{preview.data.client.name}</span> wants to access your Kurz account
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Unverified app. After you allow, it returns to{' '}
              <strong className="text-foreground">{preview.data.client.redirect_host}</strong>.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Signed in as <strong className="text-foreground">{preview.data.email}</strong>
            </p>

            <ul className="mt-5 space-y-3">
              {preview.data.scopes.map(scope => (
                <li key={scope}>
                  <Switch
                    checked={!!enabled[scope]}
                    disabled={
                      (scope === 'responses:read' && publishes) || (PUBLISH.includes(scope) && readsResponses)
                    }
                    onChange={event => {
                      const checked = event.currentTarget.checked;
                      setEnabled(current => ({ ...current, [scope]: checked }));
                    }}
                    label={SCOPE_LABELS[scope]?.label ?? scope}
                    description={SCOPE_LABELS[scope]?.hint}
                  />
                </li>
              ))}
            </ul>

            {(preview.data.scopes.includes('responses:read') && preview.data.scopes.some(scope => PUBLISH.includes(scope))) && (
              <MantineAlert mt="md" color="blue" variant="light" title="Reading responses and publishing are exclusive">
                Text typed by respondents is untrusted. To keep it from steering what gets published, an app can read
                responses or publish, never both.
              </MantineAlert>
            )}

            {preview.data.scopes.includes('responses:read') && (
              <MantineAlert mt="md" color="yellow" variant="light" title="Respondents' personal data">
                Reading responses sends what people typed in your forms to the AI service behind this app.
                Only turn this on if you are allowed to share that data. Text typed by respondents is untrusted.
              </MantineAlert>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="default" disabled={isPending} onClick={() => decide('deny')}>
                Deny
              </Button>
              <Button color="brand" loading={isPending} disabled={granted.length === 0} onClick={() => decide('allow')}>
                Allow
              </Button>
            </div>
          </>
        ) : null}
      </Card>
    </div>
  );
}
