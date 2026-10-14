import { Outlet } from 'react-router';
import { i18nFor } from '../../i18n';
import { getPublicForm } from '@internal/core/actions/get-public-form/get-public-form.service';
import { formMeta } from '../../modules/forms/form-meta';
import type { Route } from './+types/preview';

export async function loader({ params, request }: Route.LoaderArgs) {
  const form = await getPublicForm(params.publicId, request).catch(() => null);

  return { form };
}

export function meta({ loaderData, params, matches }: Route.MetaArgs) {
  const t = i18nFor(matches[0]?.loaderData).getFixedT(null, 'respond');

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
