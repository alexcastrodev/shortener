import i18n, { createInstance, type BackendModule, type InitOptions, type ResourceKey } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LOCALE, type Locale } from './locales';
import type { Namespace } from './namespaces';

export type I18nData = { locale: Locale; resources: Partial<Record<Namespace, ResourceKey>> };

const files = import.meta.glob<ResourceKey>('./*/*.json', { import: 'default' });

function read(locale: string, namespace: string) {
  const file = files[`./${locale}/${namespace}.json`];
  return file ? file() : Promise.reject(new Error(`No ${locale}/${namespace}.json`));
}

export async function loadResources(locale: Locale, namespaces: readonly Namespace[]) {
  const bundles = await Promise.all(namespaces.map(namespace => read(locale, namespace)));
  return Object.fromEntries(namespaces.map((namespace, i) => [namespace, bundles[i]]));
}

const backend: BackendModule = {
  type: 'backend',
  init() {},
  read(locale, namespace, callback) {
    read(locale, namespace).then(
      bundle => callback(null, bundle),
      error => callback(error, false)
    );
  },
};

function options({ locale, resources }: I18nData): InitOptions {
  return {
    lng: locale,
    ns: Object.keys(resources),
    defaultNS: 'menu',
    resources: { [locale]: resources },
    partialBundledLanguages: true,
    fallbackLng: false,
    load: 'currentOnly',
    initAsync: false,
    interpolation: { escapeValue: false },
  };
}

const EMPTY: I18nData = { locale: DEFAULT_LOCALE, resources: {} };

export function i18nFor(data: I18nData = EMPTY) {
  if (import.meta.env.SSR) {
    const instance = createInstance().use(backend);
    instance.init(options(data));
    return instance;
  }
  if (!i18n.isInitialized) i18n.use(backend).use(initReactI18next).init(options(data));
  return i18n;
}

export async function loadNamespaces(locale: string, namespaces: readonly string[]) {
  const missing = namespaces.filter(namespace => !i18n.hasResourceBundle(locale, namespace));
  try {
    const bundles = await Promise.all(missing.map(namespace => read(locale, namespace)));
    missing.forEach((namespace, i) => i18n.addResourceBundle(locale, namespace, bundles[i]));
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

let wanted: Locale | undefined;

export async function switchLanguage(locale: Locale) {
  wanted = locale;
  const loaded = Object.keys(i18n.store.data[i18n.language] ?? {});
  if ((await loadNamespaces(locale, loaded)) && wanted === locale) await i18n.changeLanguage(locale);
  return i18n.language === locale;
}

export function activeLocale(): Locale {
  return i18n.resolvedLanguage === 'pt-PT' ? 'pt-PT' : DEFAULT_LOCALE;
}

export default i18n;
