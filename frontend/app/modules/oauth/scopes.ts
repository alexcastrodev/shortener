import type { TFunction } from 'i18next';
import i18n from '../../i18n';
import type oauth from '../../i18n/en/oauth.json';

export const FULL_SCOPE = 'account:full';

type ScopeKey = keyof typeof oauth;

const SCOPES: Record<string, { label: ScopeKey; hint: ScopeKey }> = {
  'forms:read': { label: 'scope_forms_read', hint: 'scope_forms_read_hint' },
  'forms:write': { label: 'scope_forms_write', hint: 'scope_forms_write_hint' },
  'forms:publish': { label: 'scope_forms_publish', hint: 'scope_forms_publish_hint' },
  'responses:read': { label: 'scope_responses_read', hint: 'scope_responses_read_hint' },
  'shortlinks:read': { label: 'scope_shortlinks_read', hint: 'scope_shortlinks_read_hint' },
  'shortlinks:write': { label: 'scope_shortlinks_write', hint: 'scope_shortlinks_write_hint' },
  'pages:read': { label: 'scope_pages_read', hint: 'scope_pages_read_hint' },
  'pages:write': { label: 'scope_pages_write', hint: 'scope_pages_write_hint' },
  'appointments:read': { label: 'scope_appointments_read', hint: 'scope_appointments_read_hint' },
  'appointments:write': { label: 'scope_appointments_write', hint: 'scope_appointments_write_hint' },
  'account:full': { label: 'scope_account_full', hint: 'scope_account_full_hint' },
  'pages:publish': { label: 'scope_pages_publish', hint: 'scope_pages_publish_hint' },
};

export function scopeLabel(scope: string, t: TFunction<'oauth'> = i18n.getFixedT(null, 'oauth')) {
  const entry = SCOPES[scope];
  return entry ? t(entry.label) : scope;
}

export function scopeHint(scope: string, t: TFunction<'oauth'> = i18n.getFixedT(null, 'oauth')) {
  const entry = SCOPES[scope];
  return entry ? t(entry.hint) : undefined;
}
