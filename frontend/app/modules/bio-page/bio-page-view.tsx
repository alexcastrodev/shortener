import type { PublicPage, PublicPageLink } from '@internal/core/types/Page';
import { socialNetworkById } from './social-networks';
import { getBioTheme } from './themes';

type ViewLink = Omit<PublicPageLink, 'kind'> & { kind?: PublicPageLink['kind'] };

// The API only accepts http(s) URLs; this is a second line of defense so a
// javascript: or data: URL can never become a clickable link.
function safeHref(url: string | null | undefined, preview?: boolean) {
  if (preview || !url) return undefined;
  return /^https?:\/\//i.test(url) ? url : undefined;
}

interface LinkGroup {
  header?: ViewLink;
  links: ViewLink[];
}

// Buttons are grouped under the section header that precedes them; social
// icons are pulled out into the row under the title.
function groupLinks(links: ViewLink[]) {
  const socials: ViewLink[] = [];
  const groups: LinkGroup[] = [{ links: [] }];

  for (const link of links) {
    if (link.kind === 'social' && socialNetworkById(link.icon)) socials.push(link);
    else if (link.kind === 'header') groups.push({ header: link, links: [] });
    else groups[groups.length - 1].links.push(link);
  }

  // A section title with nothing visible under it (e.g. a template's
  // placeholders not filled in yet) would read as a mistake to visitors.
  return { socials, groups: groups.filter(group => group.links.length > 0) };
}

interface BioPageViewProps {
  page: Pick<PublicPage, 'slug' | 'display_title' | 'bio' | 'theme' | 'avatar_url'> & {
    links: ViewLink[];
  };
  onLinkClick?: (linkId: number) => void;
  // Showcase only: animates a "tap" on this link.
  pulseLinkId?: number;
  // Previews (editor, homepage mockup) render inside a frame, not the
  // whole viewport, and must not navigate away.
  preview?: boolean;
}

export function BioPageView({
  page,
  onLinkClick,
  preview,
  pulseLinkId,
}: BioPageViewProps) {
  const theme = getBioTheme(page.theme);
  const { socials, groups } = groupLinks(page.links);
  const title = page.display_title || `@${page.slug}`;
  const initial = title.replace('@', '').charAt(0).toUpperCase();

  return (
    <div
      className={`flex flex-col ${preview ? 'h-full min-h-full' : 'min-h-screen'} ${theme.page}`}
    >
      <div
        className={`mx-auto flex w-full max-w-md flex-1 flex-col items-center px-4 ${preview ? 'pt-10' : 'pt-16'} pb-8`}
      >
        {page.avatar_url ? (
          <img
            src={page.avatar_url}
            alt={title}
            width={96}
            height={96}
            className="h-24 w-24 rounded-full object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className={`flex h-24 w-24 items-center justify-center rounded-full text-3xl font-semibold ${theme.avatar}`}
          >
            {initial}
          </div>
        )}

        {preview ? (
          <p className={`mt-4 text-center text-xl font-semibold ${theme.title}`}>
            {title}
          </p>
        ) : (
          <h1 className={`mt-4 text-center text-xl font-semibold ${theme.title}`}>
            {title}
          </h1>
        )}
        {page.bio && (
          <p
            className={`mt-2 text-center text-sm whitespace-pre-line ${theme.bio}`}
          >
            {page.bio}
          </p>
        )}

        {socials.length > 0 && (
          <ul className="mt-5 flex flex-wrap justify-center gap-1">
            {socials.map(link => {
              const network = socialNetworkById(link.icon)!;
              return (
                <li key={link.id}>
                  <a
                    href={safeHref(link.url, preview)}
                    rel="noopener noreferrer nofollow"
                    aria-label={network.name}
                    title={network.name}
                    onClick={() => onLinkClick?.(link.id)}
                    className={`flex size-11 items-center justify-center rounded-full transition-transform hover:scale-110 ${theme.title}`}
                  >
                    <network.icon size={26} stroke={1.8} />
                  </a>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-8 flex w-full flex-col gap-9">
          {groups.map((group, index) => (
            <section key={group.header?.id ?? `group-${index}`} className="flex flex-col gap-3">
              {group.header &&
                (preview ? (
                  <p className={`mb-2 text-center text-xs font-bold tracking-widest uppercase ${theme.title}`}>
                    {group.header.label}
                  </p>
                ) : (
                  <h2 className={`mb-2 text-center text-xs font-bold tracking-widest uppercase ${theme.title}`}>
                    {group.header.label}
                  </h2>
                ))}
              {group.links.length > 0 && (
                <ul className="flex flex-col gap-3">
                  {group.links.map(link => {
                    const network = socialNetworkById(link.icon);
                    return (
                      <li key={link.id}>
                        <a
                          href={safeHref(link.url, preview)}
                          rel="noopener noreferrer nofollow"
                          onClick={() => onLinkClick?.(link.id)}
                          className={`relative flex w-full items-center justify-center rounded-lg py-3 text-center text-sm font-medium transition-colors ${network ? 'px-12' : 'px-4'} ${theme.button} ${link.id === pulseLinkId ? 'landing-tap' : ''}`}
                        >
                          {network && (
                            <network.icon
                              size={20}
                              stroke={1.8}
                              aria-hidden="true"
                              className="absolute left-4"
                            />
                          )}
                          {link.label}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ))}
        </div>

        {page.links.length === 0 && (
          <p className={`mt-8 text-sm ${theme.bio}`}>No links yet.</p>
        )}
      </div>

      <footer className="flex justify-center gap-4 py-6 text-center text-xs">
        {preview ? (
          <span className={theme.footer}>Made with Kurz</span>
        ) : (
          <>
            <a href="/" className={`transition-colors ${theme.footer}`}>
              Made with Kurz
            </a>
            <a
              href={`/report?page=${encodeURIComponent(page.slug)}`}
              rel="nofollow"
              className={`transition-colors ${theme.footer}`}
            >
              Report
            </a>
          </>
        )}
      </footer>
    </div>
  );
}
