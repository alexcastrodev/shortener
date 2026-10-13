import type { ResourceKey } from 'i18next';

export default import.meta.glob<ResourceKey>(['./*/*.json', '!./en/*.json'], {
  eager: true,
  import: 'default',
});
