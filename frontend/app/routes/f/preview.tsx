import { Outlet } from 'react-router';
import i18n from '../../i18n';
import { readCookie, resolveLocale } from '../../i18n/locales';
import { getPublicForm } from '@internal/core/actions/get-public-form/get-public-form.service';
import { formMeta } from '../../modules/forms/form-meta';
import type { Route } from './+types/preview';

export async function loader({ params, request }: Route.LoaderArgs) {
  const form = await getPublicForm(params.publicId, request).catch(() => null);
  const locale = resolveLocale({
    cookie: readCookie(request.headers.get('cookie')),
    acceptLanguage: request.headers.get('accept-language'),
  });

  return { form, locale };
}

export function meta({ loaderData, params }: Route.MetaArgs) {
  const t = i18n.getFixedT(loaderData?.locale ?? null, 'respond');

  return formMeta({
    form: loaderData?.form,
    publicId: params.publicId,
    apiBase: import.meta.env.VITE_BASE_URL,
    t: (key, options) => t(key, options),
  });
}

export default function FormPreview() {
  return <Outlet />;
}
