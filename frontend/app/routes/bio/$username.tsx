import { data, isRouteErrorResponse } from 'react-router';
import { getPublicPage } from '@internal/core/actions/get-public-page/get-public-page.service';
import { trackPageLinkClick } from '@internal/core/actions/track-page-link-click/track-page-link-click.service';
import { BioPageView } from '../../modules/bio-page';
import type { Route } from './+types/$username';

export async function loader({ params }: Route.LoaderArgs) {
  const page = await getPublicPage(params.username);
  if (!page) throw data('Page not found', { status: 404 });

  return { page };
}

// Bio pages render user content for anonymous visitors; never let another
// site frame them (clickjacking).
// entry.server sets the full CSP in production; these keep framing blocked
// in every environment.
export function headers() {
  return {
    'Content-Security-Policy': "frame-ancestors 'none'",
    'X-Frame-Options': 'DENY',
  };
}

export function meta({ loaderData, params }: Route.MetaArgs) {
  if (!loaderData) {
    return [{ title: 'Page not found - Kurz' }];
  }

  const { page } = loaderData;
  const title = page.display_title || `@${page.slug}`;
  const description = page.bio || `Links from ${title}`;
  const url = `https://kurz.fyi/u/${params.username}`;

  return [
    { title },
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: url },
    { name: 'twitter:card', content: 'summary' },
    ...(page.avatar_url
      ? [{ property: 'og:image', content: page.avatar_url }]
      : []),
    { tagName: 'link', rel: 'canonical', href: url },
  ];
}

export default function BioPage({ loaderData }: Route.ComponentProps) {
  const { page } = loaderData;

  function handleClick(linkId: number) {
    trackPageLinkClick({
      slug: page.slug,
      linkId,
      referer: document.referrer,
    });
  }

  return <BioPageView page={page} onLinkClick={handleClick} />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const notFound = isRouteErrorResponse(error) && error.status === 404;

  return (
    <div className="min-h-screen bg-background px-4 pt-24 text-center text-foreground">
      <h1 className="text-xl font-semibold">
        {notFound ? 'Page not found' : 'Something went wrong'}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {notFound
          ? 'This page does not exist or is no longer available.'
          : 'Please try again in a moment.'}
      </p>
      <a
        href="/"
        className="mt-6 inline-block text-sm font-medium text-primary hover:underline"
      >
        Go to Kurz
      </a>
    </div>
  );
}
