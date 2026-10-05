export const SCOPE_LABELS: Record<string, { label: string; hint: string }> = {
  'forms:read': { label: 'Read your forms', hint: 'Titles, questions and settings.' },
  'forms:write': { label: 'Create and edit draft forms', hint: 'Never publishes, and never touches a published form.' },
  'responses:read': { label: 'Read form responses', hint: 'Off by default: contains personal data of respondents.' },
  'shortlinks:read': { label: 'Read your short links', hint: 'Links and aggregate statistics.' },
  'shortlinks:write': { label: 'Create short links', hint: 'Cannot change or delete existing links.' },
  'pages:read': { label: 'Read your bio pages', hint: 'Pages, links and aggregate statistics.' },
  'pages:write': { label: 'Create and edit draft bio pages', hint: 'Never publishes, and never edits a page that is live.' },
};
