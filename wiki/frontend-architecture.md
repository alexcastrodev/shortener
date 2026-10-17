# Frontend architecture

> Scope: the web frontend: rendering modes, route map, client-side authentication, API-client conventions, caching, i18n, CSP, SEO and share previews, the service worker, and how it talks to the backend. State as of 2026-10-17.

## Summary

The frontend is a React app (React Router with server rendering enabled, Mantine, Tailwind, TanStack Query). Five marketing and login pages are prerendered at build time; the public pages that render user content (`/u/:username`, `/s/:shortCode`, `/f/:publicId`) are server-rendered with a per-request CSP nonce; everything behind `/app` and `/admin` is a client-side application: the server sends a loading overlay and the browser authenticates and fetches the data. The session is an httpOnly cookie set by the API, so the frontend never sees the token and the server render cannot know who the visitor is. All HTTP calls to the backend follow one set of conventions: one small client module per endpoint, two HTTP clients (authenticated and anonymous) and plain fetch calls in server-side loaders. Strings live in per-language, per-namespace files and each route declares the namespaces it needs; an automated check enforces the declaration. For the language rules see the language guide; for the business rules behind each screen see the domain pages linked in the route map.

## Glossary

- **Endpoint client**: the small client module for one backend endpoint: an HTTP call, optionally a TanStack Query wrapper, and its types.
- **Authenticated client**: the HTTP client that sends the session cookie; used for signed-in owner and admin calls. A 401 response logs the user out.
- **Anonymous client**: the HTTP client without credentials by default; used for public calls, and for login and logout, which opt in to credentials per request.
- **Server loader fetch**: a plain fetch (or the anonymous client with a timeout) made while a page is rendered on the server, forwarding the visitor's IP.
- **Namespace**: one translation file per language and area of the product (27 exist).
- **Strict CSP path**: a path for which the server sends a nonce-based Content-Security-Policy (`/u/`, `/s/`, `/f/`, `/oauth/`).
- **Client-loaded route**: a route whose server render is only a spinner; the browser loads the data.
- **Bio layout / App layout / Guest layout**: the three page shells. Bio is a bare shell without site chrome; App has sidebar, header and mobile navigation behind a client-side sign-in check; Guest is a bare shell for sign-in screens. Marketing pages use a separate header and footer that they include themselves.
- **Shared packages**: three internal workspaces (core logic and endpoint clients, design system, booking-editor logic), imported by name with no separate build step.

## Data

The frontend owns no database tables. It owns this browser state:

| Name | Kind | Purpose |
|---|---|---|
| Session cookie | httpOnly cookie, set by the API | Session token; never readable by page scripts. |
| Locale cookie | cookie, `SameSite=Lax`, 1 year, set by the page | The language the visitor chose. |
| Cached profile | browser local storage | The signed-in user's profile, kept only to render headers quickly; never the token. An obsolete earlier format that stored the token itself is deleted on load. |
| Sidebar state | browser local storage | Whether the desktop sidebar is collapsed. |
| Push subscription id | browser local storage | The id of this device's push subscription. |
| OAuth return address | browser session storage | The consent-screen address to resume after login. |
| Query cache | memory | Server state; cleared on logout. |

Every browser storage access tolerates failure (private mode, blocked site data). See [data-model](data-model.md) for the backend tables behind each endpoint.

## Business rules

### Rendering modes

- **FE-01** Server rendering is on, and exactly five routes are prerendered: `/`, `/login`, `/login-confirmation`, `/about`, `/report`. Prerendered pages are built without a request, so they are in English and switch language after hydration.
- **FE-02** `/privacy`, `/service` and `/status/success` are not prerendered: they are server-rendered per request (static content, no data fetch).
- **FE-03** Public pages that render user content (`/u/:username`, `/s/:shortCode`, and the parent of `/f/:publicId`) fetch their data on the server; the server calls the API with a plain fetch (or the anonymous client with a timeout) and forwards the visitor's IP. A 404 from the API becomes a real 404 page.
- **FE-04** The booking page `/f/:publicId` (its child route) and the token pages `/m/:token`, `/a/:token`, `/v/:token`, `/w/:token` load data only in the browser: the server sends a spinner and the browser fetches the data. The reason for the token pages is that the API call must not be made by the rendering server, which would put a secret token in server logs and caches.
- **FE-05** Every `/app/*`, `/admin/*`, `/login*`, `/signup`, `/password/*` and `/oauth/authorize` screen is marked as not server-rendered and has no server data fetch; its data comes from browser-side queries. See drift note D1 on whether the framework acts on that marking.
- **FE-06** The root server step runs on every document request and returns the language and the translation resources; it never reruns on client-side navigation.
- **FE-07** Document responses carry `Vary: Cookie, Accept-Language`. Prerendered files do not (they are static).
- **FE-08** Crawlers and single-page-mode renders wait until the whole page is ready; everyone else gets the page streamed as soon as its shell is ready. The stream is aborted after 6 seconds.
- **FE-09** `HEAD` requests answer with the headers and no body.

### Authentication and authorization on the client

- **FE-10** The server render never knows the user. The session cookie belongs to the API host (host-only, `SameSite=Strict`) and is not sent to the frontend server, so no server step can check the session. Authentication of `/app/*` is therefore a client-side check.
- **FE-11** The app shell (`/app/*` and `/admin/*`) asks the API for the current user. While loading or on error it renders a full-page loading overlay (which is what the server sends); on error it sends the visitor to `/login`; on success it copies the profile into the client-side store and renders sidebar, header, page and mobile navigation.
- **FE-12** Any 401 on an authenticated call clears the stored user and hard-redirects to `/login`.
- **FE-13** A 403 whose message equals the English text "Your account has been deactivated" clears the user and redirects to `/login?deactivated=true`. The match is on that literal English text (the message is missing from the Portuguese locale file; the API does not switch language per request). See drift D11.
- **FE-14** Admin screens are gated in the UI only: sidebar and header entries are hidden when the user is not an admin, and each admin page shows an English "Access denied" alert. The authorization itself is enforced by the API (see [admin-and-moderation](admin-and-moderation.md)).
- **FE-15** Public pages that show a user menu (marketing pages) ask the API for the current user (5-second timeout, with credentials) only when the persisted profile already has a user; an error clears the stored profile.
- **FE-16** Logout calls the API logout endpoint (with credentials), clears the stored profile, clears the whole query cache, then navigates (`/login`, or `/` from the public menu).
- **FE-17** The guest shell does not redirect an already signed-in user away from `/login`. Sign-in success goes to `/app`, or back to a remembered OAuth authorization address.
- **FE-18** Return to OAuth consent after login: `/oauth/authorize` remembers its query string in session storage when it starts with `/oauth/authorize?`, contains only visible ASCII characters and is at most 4096 characters; it is consumed once after login. Login by code, Google login and password reset resume it; sign-up does not, but it continues through `/login-confirmation`, which does.
- **FE-19** The consent screen only follows redirects whose protocol is `https:`, `http:` or `fyi.kurz.app:`, and only forwards eight query keys to the API (`client_id`, `redirect_uri`, `response_type`, `code_challenge`, `code_challenge_method`, `scope`, `resource`, `state`). Scope switches for sensitive scopes start off. See [mcp-and-oauth](mcp-and-oauth.md).
- **FE-20** Cloudflare Turnstile and Google sign-in render only when their keys are set at build time; without the Turnstile key the API skips the check.

### API client conventions

- **FE-21** One small client module per endpoint, grouped in a folder named verb-first in kebab-case (get, create, update, delete, set, admin). Each has an HTTP call that returns the unwrapped data, usually a TanStack Query wrapper, and its types. About 110 endpoints exist; about 20 have no query wrapper because they are called from event handlers or server loaders. Screens import each endpoint client directly, never through a single catch-all export.
- **FE-22** Query and mutation wrappers accept the TanStack options as an optional last argument and apply them last, and are typed with a common error shape (an error string plus optional per-field errors).
- **FE-23** Query keys: a fixed key per collection (parameters appended) or a key built from the id for a single record. Key names are not uniform across the app.
- **FE-24** Client choice: the authenticated client for owner and admin calls (cookie sent); the anonymous client for public calls, login, sign-up, password reset and logout. Calls that set or need the cookie across origins opt in to credentials explicitly (login by password, Google or code, logout, password reset, password change, and the current-user call from the anonymous client).
- **FE-25** Both clients mark every request as an XMLHttpRequest (the API refuses cookie-authenticated writes without it with 403) and send JSON unless the body is a form upload (so the browser sets the multipart boundary).
- **FE-26** The API origin is fixed at build time (production image default `https://api.kurz.fyi`; end-to-end CI uses a local address).
- **FE-27** Timeouts. The HTTP client has no default timeout, so a request without one waits forever (this caused a calendar that loaded forever). Explicit values:

  | Call | Timeout |
  |---|---|
  | Public form time slots | 10 000 ms |
  | Current user (authenticated and public-menu variants) | 5 000 ms |
  | Admin user list | 5 000 ms |
  | Public form fetch during server rendering (only when a request is passed) | 4 000 ms |
  | Server stream render | 6 000 ms (5 000 + 1 000) |

  After 10 s the slot picker shows its "could not load the times" message with a retry button.
- **FE-28** Error mapping has no single mechanism; four patterns exist:
  1. Let the HTTP error through and read the status and error code in the caller. Auth screens do this through a table from API error code to a translated message (with an optional title); status 429 maps to a rate-limited message; unknown codes to a generic message.
  2. Rethrow the response body (for example publishing a form).
  3. Rethrow body plus status (form submission and link unlock). Callers map status to messages: for forms 422 field errors, 403 captcha, 429 rate limit, 404/410/closed → closed, 413 too long, otherwise send failed; for unlock 401 wrong password, 429 rate limit, 404 gone.
  4. Throw a code string: joining a waitlist throws one of eight codes (not full, waitlist full, too many waitlists, invalid, unavailable, captcha failed, rate limited, unknown).

  Token pages treat a 404 as "no result" so the server can show a 404 page.
- **FE-29** Owner-side form errors are mapped to translated messages: the daily form limit maps to its own message; a list of publish blockers whose codes are all known (no questions, no service, service incomplete, availability incomplete, waitlist questions, no e-mail) maps to the joined publish-blocker messages; a per-field errors object is shown as "field message" joined by `; ` (raw API text, not translated); anything else gets a generic form error. The publish-blocker response shape is a contract the frontend relies on.
- **FE-30** Toasts have a success (green) and an error (red) variant; the default error title is the untranslated word "Error", so callers pass a translated title.
- **FE-31** Beacon calls that must not delay navigation use fetch with keepalive and swallow errors: form events (view, start; credentials omitted) and bio link clicks.
- **FE-32** File downloads and images are fetched as binary data (response exports, appointment exports, form cover, form upload, QR code). Public covers are plain image URLs on the API origin, also used for `og:image`.
- **FE-33** Visitor IP forwarding: server-side loaders send the visitor's IP (taken from the Cloudflare header) together with a shared secret so API rate limits count the visitor, not the rendering server. Both are omitted unless the secret and the IP exist; the API trusts the IP header only when the secret matches.

### State management and caching

- **FE-34** Server state lives in TanStack Query only. Defaults: data is fresh for 30 s, no refetch on window focus; retry up to 2 times for network errors and 5xx, never for a status below 500.
- **FE-35** Overrides: data never goes stale for form templates, the OAuth authorization preview and one query in the form editor; notifications and the agenda poll every 60 s.
- **FE-36** Client state lives in one small persisted store that holds only the user profile. It is a render cache for the header and for language selection; the cookie remains the source of truth and the app shell re-syncs the store from the API's current-user call.
- **FE-37** Form state uses a form library with schema validation; the booking editor's schema and pure logic live in the shared booking package, not in components.
- **FE-38** Mutations refresh data by invalidating the relevant query keys (or updating/removing cache entries), and polling where needed.
- **FE-39** Caches that can leak between accounts are cleared at logout (query cache and stored profile); a 401 clears the stored profile but relies on the full-page redirect to drop the query cache.

### Internationalization (summary)

- **FE-40** Supported languages: English (default) and Portuguese (Portugal). Resolution order: the locale cookie, then the account's saved language, then `Accept-Language` (by q value; any Portuguese variant maps to Portuguese (Portugal), any English variant to English), else English.
- **FE-41** On the server only the cookie and `Accept-Language` are used (the server cannot see the account preference). In the browser, the language is re-resolved from the cookie, the stored profile's language and the browser's languages, then switched.
- **FE-42** Each route declares the translation namespaces it needs (36 route patterns). The server loads them for the matched route; on client-side navigation the next route's namespaces are loaded first, with a fallback to a full document load if a chunk fails to load.
- **FE-43** An automated check follows every route's imports and fails when a route's declared namespaces differ from the ones its components actually use. A new component imported by a route changes that route's set.
- **FE-44** A second automated check requires that Portuguese has every namespace file, the same keys (plural suffix ignored), the same placeholders, and that every English key is used somewhere in the source. An empty translated file is skipped.
- **FE-45** Translation setup: no runtime fallback to English, only the current language is loaded, the default namespace is the menu one, and values are not escaped by the library (React escapes). The server builds a fresh instance per request; the browser uses one shared instance.
- **FE-46** Dates, numbers, currency and relative time go through shared formatters that read the active language. Components that do not translate text still re-render on language change.
- **FE-47** The account language is saved from the screen's language once, when the account has none; the language switcher saves every choice made on this device. A saved value is never overwritten implicitly.
- **FE-48** Account time zone options are UTC plus every zone the browser supports plus the current value; the default zone is Europe/Lisbon.
- **FE-49** Not translated, by design or by gap: text written by owners (questions, titles); legal pages; the content of `/about`, `/privacy`, `/service`, `/report`, `/status/success` and every page title (hard-coded English); admin screens' alerts. See drift D4.

### CSP, nonce and framing

- **FE-50** In production builds only, requests whose path starts with `/u/`, `/s/`, `/f/` or `/oauth/` get a 16-byte base64 nonce, a Content-Security-Policy and `Cache-Control: no-store`. Development never gets it because the dev server injects inline scripts.
- **FE-51** The policy: default sources limited to the site itself; scripts only from the site and with the nonce; styles from the site plus inline styles (needed by the UI library); fonts from the site; images from the site, `data:`, `blob:` and the API origin; connections to the site and the API origin; no plugins or objects; no base URL; forms may only post to the site; framing is forbidden. Only `/f/` additionally allows `https://challenges.cloudflare.com` for scripts, connections and frames (Turnstile). The API origin is derived from the build-time API address.
- **FE-52** The nonce reaches the page on the server and is applied to every script the framework and theme code inject. The client renders the tree with the same shape and no nonce, so generated ids match between server and client.
- **FE-53** Independently of the nonce, `/u/`, `/s/`, `/f/` (child), `/m/`, `/a/`, `/v/`, `/w/` and `/oauth/authorize` send `Content-Security-Policy: frame-ancestors 'none'` and `X-Frame-Options: DENY`, so framing is blocked in development and prerender too. Token pages add `Referrer-Policy: no-referrer`. The strict policy replaces the framing-only one when both apply.
- **FE-54** Fonts (Inter, Geist, Geist Mono) are self-hosted, with the main Inter file preloaded. Google Fonts were removed because every visitor, including form respondents, would send their IP to Google.
- **FE-55** Pages with no CSP (every other path: marketing, `/app`, `/login`, token pages `/m` `/a` `/v` `/w`) rely on framing headers only. Token pages are not in the strict list although they handle secret tokens. See drift D7.

### SEO, meta and share previews

- **FE-56** Every page emits site-wide meta: viewport (`viewport-fit=cover`), `robots: index, follow, max-image-preview:large`, a Googlebot entry, keywords, author, `og:type`, `og:site_name`, `og:locale=en_US` with alternate `pt_BR`, two theme colours (light `#f7f8fa`, dark `#101418`), favicons and the web manifest.
- **FE-57** Per-route meta overrides titles. The canonical site address `https://kurz.fyi` is hard-coded, so a self-hosted instance still advertises `kurz.fyi` in canonical and `og:url`. The shared 1200×630 site image provides the default `og:image`.
- **FE-58** Bio page meta: title is the display title or `@slug`; description is the bio or "Links from <title>"; `og:url` and canonical are `https://kurz.fyi/u/<username>`; if the page has an avatar, `twitter:card=summary` with the avatar as `og:image`, else the site image. A missing page gets the title "Page not found - Kurz".
- **FE-59** Form share preview: `/f/:publicId` is split into a server-rendered parent that provides the meta (so crawlers see the tags in HTML) and a child that renders the form in the browser. If the server fetch fails for any reason, the head falls back to "Form - Kurz" with `noindex`. The title is one line; the description is the form intro cut at a word boundary at 160 characters with `…`, otherwise a translated booking/answer sentence in the form's language taken from the request; plus `og:url` and the cover image (`image/webp`, absolute URL) or the site image. The head always carries `robots: noindex, nofollow`.
- **FE-60** Pages with no value for search send `robots: noindex, nofollow`: `/s/:shortCode`, `/m/`, `/a/`, `/v/`, `/w/`, `/oauth/authorize` and forms.
- **FE-61** Static files: `robots.txt` (allow all; disallow `/api/` and `/app/`; the AI crawlers GPTBot, ChatGPT-User, CCBot, anthropic-ai and Claude-Web may only fetch `/llms.txt` and are disallowed elsewhere; crawl delay 0.5; sitemap address), `sitemap.xml` (3 URLs), `llms.txt` (project description, the MCP endpoint `https://api.kurz.fyi/mcp`, rules for models), the web manifest (standalone, scope and start `/`, theme `#101418`), icons and the share image.

### Service worker

- **FE-62** There is a single service worker. It is registered only when the user turns on "Notices on this device" in `/app/account`, never at page load. It has no fetch handling and no cache: it does not make the app work offline.
- **FE-63** On a push it shows a notification titled "Kurz" with a text chosen from the push kind (appointment created, requested, cancelled, expired, auto-confirmed, else a fallback) in Portuguese or English according to the browser's language (not the app's locale cookie), and stays silent while a window is visible and focused. The payload carries only the kind and an id, so no name or time appears. A click focuses an existing same-origin window or opens `/app/agenda`. See [notifications-and-email](notifications-and-email.md).
- **FE-64** The worker activates immediately and takes control of open pages. The device state machine (unsupported, iOS needs Home Screen install, denied, off, on, server disabled) is client logic with its own automated checks.

### Accessibility and UI conventions

- **FE-65** Conventions followed in the interface (no lint rule enforces them): icon-only buttons carry an accessible label; loading text uses the status role, errors the alert role; the shared loading indicator marks the region busy and hides its spinner from assistive tech, with animation only when motion is allowed; decorative motion on the landing page respects reduced-motion preferences; screen-reader-only text and focus-visible styles exist.
- **FE-66** Layout: mobile-first; the app shell shows the sidebar from the large breakpoint and a bottom mobile navigation below it; content gets bottom padding on small screens so the navigation never covers it; safe-area insets and dynamic viewport height are used.
- **FE-67** Theme: the colour scheme follows the system by default (with a nonce-aware script to avoid a flash); the dark variant follows the active scheme; a brand colour palette (primary shade 7 light / 4 dark); filled brand buttons use a dedicated foreground colour for text.
- **FE-68** The design system package exports presentational components only (cards, page container and background, alert, loading, icon badge, brand mark and logo, theme toggle, stat and summary cards, error boundary, and a layout shell) plus the theme, style presets and a class-name helper. Business logic stays in the app's feature modules.
- **FE-69** The root error boundary comes from the design system: a 404 page for route errors with status 404, a generic error page otherwise, the stack only in development; English text, not translated. Public routes with their own error boundary (`/u`, `/s`, `/f`, `/m`, `/a`, `/v`, `/w`) render translated not-found screens.

### Shared packages

- **FE-70** The core package holds the endpoint clients, the persisted user store, shared types (form, OAuth, page, error shape, shortlink, user), small utilities (toasts, visitor forwarding) and the query client provider. It declares no dependencies of its own; they come from the app. Screens import endpoint clients by their specific path.
- **FE-71** The booking package is free of React: one module per booking mode (services, individual), a registry that defaults to the services mode, and shared logic (schedule, rules, durations, time generation, summary, validation). The editor UI consumes it. Details and the rules it mirrors are in [booking-engine](booking-engine.md).
- **FE-72** Frontend validation duplicates backend rules in places (booking editor limits, the 15–4320 minute range for waitlist confirmation, field limits). Those checks are advisory; the API remains authoritative. See [forms](forms.md) and [booking-engine](booking-engine.md).

## Flows

### Document request (production)

1. The edge/proxy forwards the request to the Node server.
2. The server resolves the language and loads the route's namespaces; a page that needs data fetches it from the API with the visitor IP headers.
3. The server sets `Vary`, and for strict paths a nonce, CSP and `no-store`; it renders HTML with a per-request translation instance.
4. The browser hydrates with the same resources; the language may switch after hydration; `/app` pages then ask the API for the current user.

### Sign-in on the client

1. `/login` posts to the anonymous client (password, e-mail code request, code verification, or Google) with credentials; the API replies by setting the session cookie.
2. The page stores the returned user in the client store and goes to the remembered OAuth address or `/app`.
3. The `/app` shell asks the API for the current user; on 401 the client redirects to `/login`.

See [accounts-and-auth](accounts-and-auth.md) for the API side.

### Public form (`/f/:publicId`)

1. Server: the parent route fetches the public form from the API (4 s timeout, visitor IP), renders only the head (meta) and the child's spinner.
2. Browser: the child repeats the call (no timeout), renders the form and records a view event; time slots are fetched per month with a 10 s timeout; the submission is sent with an idempotency key, a Turnstile token and a hidden honeypot field.
3. Errors map to messages as described in FE-28.

See [forms](forms.md) and [booking-engine](booking-engine.md).

### Language switch

Choosing a language writes the locale cookie (1 year, `SameSite=Lax`), loads the already-present namespaces in the new language first, and switches only if everything loaded and no newer switch was requested; the page's language attribute updates after success.

## States and transitions

The frontend has no persisted status. The one client state machine with business meaning is the push device state (unavailable, unsupported, iOS needs Home Screen, denied, off, on). The auth state is: no user in the store (anonymous) → user set after login or after the current-user call → cleared on 401, deactivation, logout or a failed current-user call from the public menu.

## Limits and configuration

| Name | Value | Notes |
|---|---|---|
| API origin | build-time; production default `https://api.kurz.fyi` | Also builds the CSP connection and image sources; the strict policy refuses to build if it is missing or invalid. |
| Turnstile site key | build-time | Empty in end-to-end CI. |
| Google client id | build-time | A public id. |
| SSR forward secret | runtime, set on both frontend and API | Same value in both (FE-33). |
| Server port | runtime | 80 in production, 3001 in end-to-end CI. |
| IPv4-first DNS option | build | Prerender needs IPv4 to reach the API. |
| Node version | 22 for development and CI; 26 in the production image | See D2. |
| Healthcheck | the robots file is fetched every 10 s | The static file proves the server is up. |
| Frontend container limits | 0.5 CPU, 512 MB | |
| Query freshness | 30 s | |
| Query retry | 2, only on network errors or 5xx | |
| Notifications / agenda polling | 60 s | FE-35. |
| Stream timeout | 5 s (+1 s abort) | |
| Locale cookie | 1 year | |
| OAuth return path | 4096 characters | |
| Form meta description | 160 characters | |

## Authorization and privacy

- Anonymous visitors: public pages, form submission, token pages. They get no cookie from the frontend except the locale cookie (a language preference). The CSP restricts third parties to Turnstile on `/f/`.
- Owners: everything under `/app` after the client check (FE-11); admins: `/admin` (FE-14).
- Personal data in the browser: the cached user profile (id, e-mail, flags, locale, time zone) in local storage until logout or 401; the session token is never available to scripts (FE-10). Form drafts and the visitor's time-zone choice are kept in local storage by the form screens (see [forms](forms.md)).
- The rendering server receives visitor IPs from the proxy only to forward them to the API (FE-33); it does not store them.
- Self-hosted fonts and no analytics script: no third-party request on public pages other than Turnstile on `/f/` and Google sign-in where configured.

## API and UI surface

### Route map

Access values: public, guest (public sign-in screens), owner (any signed-in user), admin. Rendering: **P** prerendered, **S** server-rendered with a data fetch, **D** server-rendered document without a fetch (static content), **C** the server sends a spinner/overlay and the browser fetches. Screens in the app shell also poll the current user and the notification bell.

| URL | Purpose | Access | Render | Domain page |
|---|---|---|---|---|
| `/` | Landing page | public | P | [shortlinks](shortlinks.md), [bio-pages](bio-pages.md) |
| `/about` | About Kurz (static) | public | P | none |
| `/report` | Report abusive content | public | P | [admin-and-moderation](admin-and-moderation.md) |
| `/privacy` | Privacy notice (static) | public | D | none |
| `/service` | Terms of service (static) | public | D | none |
| `/status/success` | Confirmation after a link is created | public | D | [shortlinks](shortlinks.md) |
| `/u/:username` | Public bio page; records link clicks | public | S | [bio-pages](bio-pages.md) |
| `/s/:shortCode` | Landing for a protected or non-redirecting short link, including password unlock | public | S | [shortlinks](shortlinks.md) |
| `/f/:publicId` | Public form: server-rendered head for share previews, form rendered in the browser (slots, submission, waitlist, uploads, view events, cover) | public | S (head only) + C | [forms](forms.md), [booking-engine](booking-engine.md) |
| `/m/:token` | Visitor manages (views or cancels) their appointment | public (token) | C | [appointments-lifecycle](appointments-lifecycle.md) |
| `/a/:token` | Owner-side accept/decline decision for an appointment from an e-mail link | public (token) | C | [appointments-lifecycle](appointments-lifecycle.md) |
| `/v/:token` | Visitor confirms their e-mail for an appointment | public (token) | C | [appointments-lifecycle](appointments-lifecycle.md) |
| `/w/:token` | Waitlist offer: claim or leave | public (token) | C | [appointments-lifecycle](appointments-lifecycle.md) |
| `/oauth/authorize` | OAuth consent screen for AI apps; no app chrome; authentication is the 401 from its own API call | owner (401 → `/login`) | C | [mcp-and-oauth](mcp-and-oauth.md) |
| `/login` | Sign in by password, e-mail code or Google | guest | P | [accounts-and-auth](accounts-and-auth.md) |
| `/login-confirmation` | Enter the e-mail code | guest | P | [accounts-and-auth](accounts-and-auth.md) |
| `/signup` | Create an account | guest | C | [accounts-and-auth](accounts-and-auth.md) |
| `/password/forgot` | Request a password reset | guest | C | [accounts-and-auth](accounts-and-auth.md) |
| `/password/reset` | Set a new password | guest | C | [accounts-and-auth](accounts-and-auth.md) |
| `/app` | Dashboard: create, edit, delete and QR-code short links | owner | C | [shortlinks](shortlinks.md) |
| `/app/links/:id` | One link: details, statistics, QR code | owner | C | [shortlinks](shortlinks.md) |
| `/app/pages` | List and create bio pages | owner | C | [bio-pages](bio-pages.md) |
| `/app/pages/:id` | Bio page editor: links, avatar, templates, community templates, colour palettes, QR code | owner | C | [bio-pages](bio-pages.md) |
| `/app/pages/:id/stats` | Bio page statistics | owner | C | [bio-pages](bio-pages.md) |
| `/app/agenda` | Agenda of appointments and bookings; confirm, decline, cancel, send manage links (polls every 60 s) | owner | C | [appointments-lifecycle](appointments-lifecycle.md) |
| `/app/forms` | List, create, duplicate, delete forms; form templates | owner | C | [forms](forms.md) |
| `/app/forms/:id` | Form editor: fields, booking setup, cover, publish/unpublish, QR code, slot preview | owner | C | [forms](forms.md), [booking-engine](booking-engine.md) |
| `/app/forms/:id/responses` | Responses, summary, appointments, waitlist, uploads and exports | owner | C | [forms](forms.md), [appointments-lifecycle](appointments-lifecycle.md) |
| `/app/account` | Profile, password, data export, account deletion, notification preferences, push device, calendar feed, connected AI apps | owner | C | [accounts-and-auth](accounts-and-auth.md), [notifications-and-email](notifications-and-email.md), [mcp-and-oauth](mcp-and-oauth.md) |
| `/app/notifications` | Notification list; mark read | owner | C | [notifications-and-email](notifications-and-email.md) |
| `/admin` | Admin overview: abuse signals, page templates | admin (UI check) | C | [admin-and-moderation](admin-and-moderation.md) |
| `/admin/users` | Users; activate/deactivate | admin | C | [admin-and-moderation](admin-and-moderation.md) |
| `/admin/shortlinks` | All short links; activate/deactivate, mark safe/unsafe | admin | C | [admin-and-moderation](admin-and-moderation.md), [shortlinks](shortlinks.md) |
| `/admin/audit-logs` | Audit log | admin | C | [admin-and-moderation](admin-and-moderation.md) |
| `/admin/moderation` | Page templates; hide/show | admin | C | [admin-and-moderation](admin-and-moderation.md), [bio-pages](bio-pages.md) |
| `/admin/moderation/abuse` | Abuse signals; dismiss, deactivate the user | admin | C | [admin-and-moderation](admin-and-moderation.md) |

Notes: (1) the app shell asks for the current user and polls notifications (60 s) on every `/app` and `/admin` page; (2) `/oauth/authorize` uses the bare shell, so it has no app chrome and no current-user gate; (3) `/f/:publicId` is one URL served by a parent and a child route, so its translation namespaces are the parent's declaration.

### Other UI surface

- Query-string contracts: `/login?deactivated=true` (shows the deactivation notice), `/oauth/authorize?<oauth params>`.
- The share URL of a form is `https://kurz.fyi/f/<publicId>`; manage links `https://kurz.fyi/m/<token>` come from the API.
- The account page shows the MCP URL as the API origin followed by `/mcp`.

## Decisions

### D-FE-01 Session in an httpOnly cookie, authentication on the client
**Decision.** The API sets the session cookie as httpOnly, `SameSite=Strict`, `Secure` in production; the browser sends it to the API only. The frontend authenticates by asking the API for the current user and treats the stored profile as a render cache. **Why.** An XSS can no longer steal the token; `kurz.fyi` and `api.kurz.fyi` are the same site, so frontend requests carry the cookie while requests started from other sites do not. **Consequence.** Server rendering cannot render signed-in pages; `/app` is a spinner on the server, a cost accepted for private screens. CSRF defence is `SameSite=Strict`, an exact CORS origin list and the XMLHttpRequest marker (FE-25).

### D-FE-02 Language per request with per-route namespaces
**Decision.** No language is bundled; the root server step returns only the namespaces declared for the route, in the visitor's language; an automated check keeps the declarations true. **Why.** Before this, the server rendered everything in English from one shared instance, every route shipped 27 namespaces of two languages (184 KB, 55 KB gzipped) and Portuguese visitors saw English first. **Consequence.** Adding a string in a new component can fail the build checks until the route's namespace list includes it; translating at module load time is forbidden; validation messages in the form editor are created lazily.

### D-FE-03 Strict, nonce-based CSP only on pages that render user content
**Decision.** Nonce CSP on `/u/`, `/s/`, `/f/`, `/oauth/`; all other pages get none. **Why.** Stored content can never execute even if it reached the HTML unescaped. Inline styles stay allowed for the UI library's style attributes. Fonts were self-hosted in the same hardening. **Consequence.** Any new inline script on those paths needs the nonce; any new third-party origin on `/f/` needs an entry in the CSP; responses are `no-store`.

### D-FE-04 The form page is split into a server parent and a client child
**Decision.** A server-rendered parent provides the head and a client-loaded child renders the form. **Why.** Link previews (WhatsApp, Slack, iMessage, Facebook, X, LinkedIn) need the tags in server-rendered HTML; the page previously had only client-side loading. The server call forwards the visitor IP so the 120-per-minute limit is not shared by all crawlers, and has a 4 s timeout; any failure gives the generic head. **Consequence.** The form is fetched twice (server for the head, browser for the body); the head always says `noindex`.

### D-FE-05 One client module per endpoint, thin services, optional query wrappers
**Decision.** Each endpoint has its own small client module with an HTTP call, an optional query wrapper and types. **Why.** The structure has been consistent since the early versions; no other reason was recorded. **Consequence.** See "How to add a new screen". Error shape is per endpoint (FE-28).

### D-FE-06 Explicit timeouts only where a stall hurts
**Decision.** Add a timeout where a hung request freezes a screen. **Why.** The anonymous client had none, so a stalled slots request kept the calendar loading forever with no error or retry. **Consequence.** Other calls still have no timeout (FE-27).

### D-FE-07 Service worker only for push, registered on demand
**Decision.** The service worker handles push display and click only, with the language chosen from the browser's language. **Why.** The push payload carries only the kind of event so no name or time leaves the server; the worker stays quiet while Kurz is open and in front. **Consequence.** No offline support or asset caching exists. A new push kind needs a text entry in the worker or it shows the fallback text.

### D-FE-08 Fixed build-time API origin
**Decision.** The API origin is a build-time setting, not a runtime one. **Why.** It is used in the CSP, in bundles and in prerendered pages, and deploys must build exactly as before. **Consequence.** One image per API origin.

## Change impact

- **Add or rename an API field or status**: update the endpoint client, its types and callers, the pinned API contract (FE-29), and the MCP tools if shared. The previous frontend release must survive the new schema (deploys never stop the site).
- **New route**: place it in the right shell, declare its translation namespaces (FE-42, FE-43), set page meta and framing headers (FE-53, FE-60), mark app screens as client-rendered (FE-05), decide whether it needs the strict CSP (FE-50, D-FE-03) and whether it belongs in the sitemap (FE-61).
- **Change the session cookie name, domain, `SameSite` or the CORS list**: review FE-10, FE-24, the CSP connection sources (FE-51) and the end-to-end sign-in, which injects the session cookie.
- **Change the deactivated-account message text or language**: breaks FE-13 (D11).
- **Change a notification kind**: update the service worker's text table (FE-63), the notification preferences and the notices translations; see [notifications-and-email](notifications-and-email.md).
- **Change share-preview behaviour**: review FE-58 and FE-59 and the share-preview end-to-end checks.
- **Change the slots endpoint**: review the 10 s timeout (FE-27), the slot picker and [booking-engine](booking-engine.md).
- **Add a language**: follow the language guide; also the service worker's texts and language matching, the active-language logic, the `og:locale` tags (FE-56) and the backend locale files.
- **Change the SSR forward secret or header names**: review FE-33 on both frontend and API, deployment configuration and the end-to-end setup.
- **Upgrade Node or the routing framework**: review the container builds, CI and the IPv4-first workaround (D2).

## Drift and open questions

- **D1 (medium)** Many routes are marked as not server-rendered, but only the global setting enables server rendering. Whether the framework honours a per-route marking could not be confirmed. Observable behaviour is the same either way: these routes have no server data fetch and the app shell shows an overlay until the current-user call returns. `/login` and `/login-confirmation` carry the marking and are also prerendered. Verify before relying on it.
- **D2 (low)** Node version: development docs, the development container and CI use Node 22; the production image uses Node 26. Tests run on a different major than production. The developer guide is also silent on a dependency-install flag used by both container builds but not by CI.
- **D3 (low)** `og:locale` is `en_US` with alternate `pt_BR`, while the second language is Portuguese (Portugal); the page language attribute follows the real language but the OG tags do not. The web manifest declares `en-US`; the sitemap lists a Portuguese alternate pointing to the same URL.
- **D4 (medium)** The i18n guide says every new UI string goes to English and every other language, but large parts are English-only: marketing page bodies, all page titles, the default error toast title, the root error page, admin alerts and descriptions ("Access denied", "Accounts, activate and deactivate"). Legal text is explicitly exempt in the guide; the rest is not.
- **D5 (low)** A small `home` translation namespace (one key for total links) is declared but used by no route; the component uses the dashboard namespace instead. The "every English key is used" check passes because the same key name appears elsewhere. Dead file.
- **D6 (low)** An endpoint client for creating a short link anonymously exists with a query wrapper but no caller, and the backend has no such public route (only the signed-in owner route). Dead code.
- **D7 (low)** The token pages `/m`, `/a`, `/v`, `/w` handle secret tokens but are not in the strict CSP list (FE-55).
- **D8 (low)** Stale documentation: a comment in one public-page endpoint client says the clients read the token from local storage (they do not; the token is an httpOnly cookie). The sitemap lists `/app` (disallowed by `robots.txt`) and `/login`, omits `/about`, `/privacy`, `/service`, and has an old last-modified date. `robots.txt` does not disallow `/admin/`. A sitemap comment says "update with your actual domain".
- **D9 (low)** The hard-coded `https://kurz.fyi` (site address, bio canonical, backend CORS list) means a self-hosted instance advertises the public instance in canonical and OG URLs.
- **D10 (low)** The service worker picks the notification language from the browser's language, not from the locale cookie or the account language, so a user who chose English on a Portuguese browser gets Portuguese notices. The click target is always `/app/agenda` whatever the kind.
- **D11 (medium)** The deactivated-account redirect depends on matching an English message (FE-13). The API does not set a language per request today, so it works; a localized API message or a changed wording silently turns the redirect into a plain 403.
- **D12 (low)** Error handling has four unrelated patterns (FE-28) and most mutations do not set a timeout (FE-27); query-key naming is inconsistent (FE-23).
- **D13 (low)** Linting runs only two React-hooks rules and is not part of CI; code formatting is configured (80 columns) but not enforced, and many files exceed it. TypeScript strict mode is on.
- **D14 (low)** The i18n guide was checked and is accurate on locales, cookie name, resolution order, the `Vary` header, the prerendered list, the navigation fallback and both automated checks. Gaps in the guide: it does not mention that the server ignores the account language, that namespace declarations use route patterns without distinguishing index routes, or that any Portuguese variant maps to Portuguese (Portugal).
- **D15 (low)** Not verified: how the production edge routes `kurz.fyi` to the Node server and `api.kurz.fyi` to Rails (see [platform-and-operations](platform-and-operations.md)); the local development API and frontend ports and the API address for local development are not documented in the repository. In end-to-end CI the frontend runs on 3001 and Rails on 3000 on `localhost`; the cookie is `SameSite=Strict` and cookies ignore ports, so it is sent cross-port.

## How to add a new screen

- Give the screen's data calls their own endpoint clients: authenticated for owner/admin data, anonymous for public data, with a timeout where a stall would freeze the screen and one consistent error pattern (FE-21 to FE-28).
- Place it in the right shell (signed-in, public bare, or sign-in) and pick its rendering mode: client-rendered for signed-in screens, server-rendered with a fetch for public pages with user content, client-loaded for token pages (FE-03 to FE-05).
- Set the page head and framing protections, mark private pages `noindex`, and add the strict CSP when the page renders user content (FE-50 to FE-60).
- Add every string in every supported language, declare the screen's namespaces, and use the shared date and number formatters (FE-40 to FE-46).
- Follow the accessibility and layout conventions, and refresh the relevant query keys after mutations (FE-38, FE-65 to FE-67).
- Verify in containers (see the project's contributing rules), cover a user-visible flow end to end, and update the sitemap and `llms.txt` for indexable public pages and the route map above.
