export const SCOPE_LABELS: Record<string, { label: string; hint: string }> = {
  'forms:read': { label: 'Read your forms', hint: 'Titles, questions and settings.' },
  'forms:write': { label: 'Create and edit forms', hint: 'Drafts only; a live form accepts only theme and color changes.' },
  'forms:publish': { label: 'Publish and unpublish forms', hint: 'Can put a form online or take it offline. Not available together with reading responses.' },
  'responses:read': { label: 'Read form responses', hint: 'Off by default: contains personal data of respondents.' },
  'shortlinks:read': { label: 'Read your short links', hint: 'Links and aggregate statistics.' },
  'shortlinks:write': { label: 'Create short links', hint: 'Cannot change or delete existing links.' },
  'pages:read': { label: 'Read your bio pages', hint: 'Pages, links and aggregate statistics.' },
  'pages:write': { label: 'Create and edit bio pages', hint: 'Drafts only; a live page accepts only theme and color changes.' },
  'pages:publish': { label: 'Publish and unpublish bio pages', hint: 'Can put a page online or take it offline. Not available together with reading responses.' },
};
