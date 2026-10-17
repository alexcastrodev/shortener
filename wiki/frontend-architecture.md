# Frontend architecture

> Scope: the React Router app in `frontend/`: rendering modes, route map, authentication on the client, the API client, caching, i18n, CSP, SEO, service worker, tests, build and how it talks to the backend. State as of commit `bc7f65c` (2026-10-17).
> Main code: `frontend/app/` (root, entries, routes, layouts, modules, components, i18n, utils), `frontend/packages/core` (API client), `frontend/packages/ui` (design system), `frontend/packages/booking` (editor logic), `frontend/public/`, `e2e/tests/`.

## Summary

The frontend is a React Router 8 app with `ssr: true` (`frontend/react-router.config.ts:3`), React 19, Mantine 9, Tailwind 4 and TanStack Query 5. Five marketing and login routes are prerendered; the public routes that render user content (`/u/:username`, `/s/:shortCode`, `/f/:publicId`) are server-rendered with a per-request CSP nonce; everything behind `/app` and `/admin` is a client-side application: the server sends a loading overlay and the browser authenticates and fetches data. The session is an httpOnly cookie set by the API, so the frontend never sees the token and the server render cannot know who the visitor is. All HTTP calls to the backend go through three workspace packages' worth of conventions: one folder per endpoint in `@internal/core/actions`, two axios instances (`api`, `publicApi`) and plain `fetch` in SSR loaders. Strings live in per-language, per-namespace JSON files and each route declares the namespaces it needs; a test enforces the declaration. For the language rules see [docs/i18n.md](../docs/i18n.md); for the business rules behind each screen see the domain pages linked in the route map.

## Glossary

- **Action** (`@internal/core/actions/<name>/`): one backend endpoint, as a `.service.ts` (HTTP call), optionally a `.hook.ts` (TanStack Query wrapper) and `.types.ts`.
- **`api`** (`frontend/packages/core/actions/api.ts:5`): axios instance with `withCredentials: true`; for authenticated `/api/me`, `/api/admin` calls. Its 401 handler logs the user out.
- **`publicApi`** (`api.ts:12`): axios instance without credentials by default; for anonymous `/api/public` calls and for login/logout, which opt in to credentials per request.
- **SSR loader fetch**: a plain `fetch` (or `publicApi` with a timeout) inside a route `loader`, forwarding the visitor's IP (`forwardVisitor`).
- **Namespace**: one i18n JSON file per language (`app/i18n/<lang>/<ns>.json`); 27 exist.
- **Strict CSP path**: a path for which `entry.server.tsx` sends a nonce-based Content-Security-Policy (`/u/`, `/s/`, `/f/`, `/oauth/`).
- **HydrateFallback route**: a route with only a `clientLoader`; the server renders its spinner, the browser loads the data.
- **Bio layout / App layout / Guest layout**: the three route-config layouts (`frontend/app/routes.ts:16`, `:26`, `:49`).
- **Web layout** (`frontend/app/layout/web-layout.tsx`): the marketing header and footer component, imported by the static pages directly (not a route layout).
- **`@internal/*`**: npm workspaces `core`, `ui`, `booking` (`frontend/package.json:67-69`), imported by name, no build step (`main` points at each package's `src/index.ts`).

## Data

The frontend owns no database tables. Browser and cookie state it owns:

| Name | Kind | Value / purpose | Where |
|---|---|---|---|
| `kurz_session` | httpOnly cookie, set by the API | session token; never readable by page scripts | `backend/app/controllers/concerns/session_cookie.rb:7`, `:12-19` |
| `kurz_locale` | cookie, `SameSite=Lax`, 1 year, set by the page | chosen language | `frontend/app/i18n/locales.ts:4`; `app/i18n/use-locale-sync.ts:8,12` |
| `v2-user-storage` | localStorage (zustand persist) | cached profile `User` for rendering; never the token | `frontend/packages/core/states/use-user-state.ts:30` |
| `v1-user-storage` | localStorage, removed on load | v1 stored the token itself; deleted | `frontend/packages/core/states/use-user-state.ts:16` |
| `kurz:sidebar-collapsed` | localStorage | desktop sidebar state | `frontend/app/components/app-sidebar/app-sidebar.tsx:24` |
| `kurz-push-subscription` | localStorage | id of this device's push subscription | `frontend/app/modules/notices/push.ts:11` |
| `kurz:oauth-return` | sessionStorage | `/oauth/authorize?...` to resume after login | `frontend/app/modules/oauth/return-to.ts:1` |
| TanStack Query cache | memory | server state, cleared on logout | `frontend/packages/core/service-provider.tsx:5` |

Every browser storage access is wrapped in try/catch (private mode, blocked site data). See [data-model](data-model.md) for the backend tables behind each endpoint.

## Business rules

### Rendering modes

- **FE-01** `ssr: true` and exactly five prerendered routes: `/`, `/login`, `/login-confirmation`, `/about`, `/report`. Prerendered pages are built without a request, so they are in `en` and switch after hydration. — `frontend/react-router.config.ts:3-4`; `docs/i18n.md` ("How the strings reach the page").
- **FE-02** `/privacy`, `/service`, `/status/success` are not in the prerender list: they are server-rendered per request (static content, no loader). — `frontend/react-router.config.ts:4`; `app/routes.ts:12,13,15`.
- **FE-03** Public pages that render user content use a server `loader` (`/u/:username`, `/s/:shortCode`, and the parent of `/f/:publicId`); the loader calls the API with a plain `fetch` (or `publicApi` with a timeout) and forwards the visitor's IP. A 404 from the API becomes a React Router `data(..., {status: 404})`. — `frontend/app/routes/bio/$username.tsx:8-13`; `frontend/app/routes/unlock/$shortCode.tsx:12-17`; `frontend/app/routes/f/preview.tsx:7-11`.
- **FE-04** The booking and token pages `/f/:publicId` (child), `/m/:token`, `/a/:token`, `/v/:token`, `/w/:token` have only a `clientLoader` and a `HydrateFallback`: the server sends a spinner and the browser fetches the data. Reason for tokens: the API call must not be made by the SSR server, which would put a secret token in server logs and cache (inferred; not recorded). — `app/routes/f/$publicId.tsx:26,40`; `app/routes/m/$token.tsx:13,35`; `a/$token.tsx:10,32`; `v/$token.tsx:12,34`; `w/$token.tsx:13,35`.
- **FE-05** Every `/app/*`, `/admin/*`, `/login*`, `/signup`, `/password/*` and `/oauth/authorize` route file exports `ssr = false`. These routes have no loader; their data comes from hooks in the browser. See drift note D1 on whether React Router acts on this export. — e.g. `frontend/app/routes/oauth/authorize.tsx:11`; `frontend/app/routes/admin/index.tsx:17`; `frontend/app/routes/login/index.tsx` (grep `export const ssr`).
- **FE-06** The root `loader` runs on every document request and returns `{locale, resources}`; `shouldRevalidate` is `() => false`, so it never reruns on client navigation. — `frontend/app/root.tsx:28-37`.
- **FE-07** Document responses get `Vary: Cookie, Accept-Language`. Prerendered files do not (they are static). — `frontend/app/entry.server.tsx:37`.
- **FE-08** Crawlers (`isbot`) and SPA-mode renders wait for `onAllReady`; everyone else streams at `onShellReady`. Stream abort after `streamTimeout + 1000` = 6 s. — `app/entry.server.tsx:13,47-52`.
- **FE-09** `HEAD` requests answer with the headers and no body. — `frontend/app/entry.server.tsx:24-30`.

### Authentication and authorization on the client

- **FE-10** The server render never knows the user. The session cookie belongs to the API host (`api.kurz.fyi`, host-only, `SameSite=Strict`) and is not sent to the frontend server, so no loader can check the session. Authentication of `/app/*` is therefore a client check. — `backend/app/controllers/concerns/session_cookie.rb:1-6,12-19`; `frontend/app/layout/index.tsx:14`.
- **FE-11** The app layout (`/app/*` and `/admin/*`) calls `GET /api/me` through `useGetLoggedUser`. While loading or on error it renders a full-page `LoadingOverlay` (that is what the server sends); on error it calls `navigate('/login')`; on success it copies the profile into the zustand store and renders sidebar, header, `<Outlet/>` and mobile nav. — `frontend/app/layout/index.tsx:14-31`.
- **FE-12** Any 401 on an `api` call clears the stored user and hard-redirects with `window.location.replace('/login')`. — `frontend/packages/core/actions/api.ts:32-35`.
- **FE-13** A 403 whose `message` equals the English string `Your account has been deactivated` clears the user and redirects to `/login?deactivated=true`. The match is on the literal text of `errors.account_deactivated` in `backend/config/locales/en.yml:33` (the key is missing from `pt-PT.yml`; no controller switches locale). — `api.ts:36-41`; `frontend/app/routes/login/index.tsx:56`.
- **FE-14** Admin screens are gated in the UI only: `AdminGuard` hides sidebar/header entries when `user.admin` is false; each admin page renders an "Access denied" alert (English, hard-coded) when `data.user.admin` is false. The authorization itself is enforced by the API (see [admin-and-moderation](admin-and-moderation.md)). — `frontend/app/components/admin-guard/admin-guard.tsx:14`; `frontend/app/routes/admin/index.tsx:36-48`; `frontend/app/routes/admin/users.tsx:59`; `frontend/app/routes/admin/shortlinks.tsx:86`; `frontend/app/routes/admin/audit-logs.tsx:123`; `frontend/app/routes/admin/moderation/templates.tsx:44`; `frontend/app/routes/admin/moderation/abuse.tsx:61`.
- **FE-15** Public pages that show a user menu (marketing pages) call `GET /api/me` (5 s timeout, `withCredentials`) only when the persisted store already has a user (`enabled: !!user`); an error clears the store. — `frontend/app/modules/auth/use-auth.tsx:11-19`; `frontend/packages/core/actions/get-logged-user/get-logged-user.public.service.ts:5-14`.
- **FE-16** Logout calls `DELETE /api/logout` (with credentials), clears the store, clears the whole query cache, then navigates (`/login`, or `/` from the public menu). — `frontend/app/modules/auth/use-logout.ts:9-17`; `frontend/packages/core/actions/logout/logout.service.ts`.
- **FE-17** The guest layout does not redirect an already signed-in user away from `/login`. Sign-in success goes to `/app`, or back to a remembered OAuth authorization URL. — `frontend/app/layout/guest.tsx`; `frontend/app/modules/oauth/return-to.ts:23-27`.
- **FE-18** Return to OAuth consent after login: `/oauth/authorize` stores its query string in sessionStorage when it matches `^/oauth/authorize\?[\x21-\x7e]*$` and is at most 4096 characters; `goAfterLogin` consumes it once. Login by code, Google login and password reset call `goAfterLogin`; sign-up does not, but it continues through `/login-confirmation`, which does. — `frontend/app/modules/oauth/return-to.ts:2,4-11,13-27`; `frontend/app/routes/login/index.tsx:78`; `frontend/app/routes/login/confirmation/index.tsx:41`; `frontend/app/routes/password/reset.tsx`; `frontend/app/modules/auth/use-google-sign-in.ts`.
- **FE-19** The consent screen only follows redirects whose protocol is `https:`, `http:` or `fyi.kurz.app:`, and only forwards eight query keys to the API (`client_id`, `redirect_uri`, `response_type`, `code_challenge`, `code_challenge_method`, `scope`, `resource`, `state`). Scope switches: sensitive scopes start off. See [mcp-and-oauth](mcp-and-oauth.md). — `frontend/app/routes/oauth/authorize.tsx:27-49`.
- **FE-20** Cloudflare Turnstile and Google sign-in render only when `VITE_TURNSTILE_SITE_KEY` / `VITE_GOOGLE_CLIENT_ID` are set at build time; without the key the API skips the check. — `frontend/app/modules/auth/turnstile.tsx:4-9`; `frontend/app/modules/auth/google-button.tsx:10-12`.

### API client conventions

- **FE-21** One folder per endpoint: `packages/core/actions/<verb>-<noun>/` with `<name>.service.ts` (async function returning unwrapped data), `<name>.hook.ts` (`useQuery`/`useMutation`) and `<name>.types.ts`. Folder names are kebab-case verb-first (`get-`, `create-`, `update-`, `delete-`, `set-`, `admin-`); 110 folders exist. Routes import by deep path, never from a barrel. Services without hooks (called from event handlers or loaders) are allowed: 20 folders have no `.hook.ts`. — `packages/core/actions/*`; example `create-shortlink/`.
- **FE-22** Hooks accept the TanStack options as an optional last argument and spread them last (`...queryProps` / `...mutationProps`), typed with `ResponseError` (`{error: string; errors?: Record<string,string>}`). — `frontend/packages/core/actions/get-logged-user/get-logged-user.hook.ts:8-16`; `frontend/packages/core/actions/create-shortlink/create-shortlink.hook.ts:7-19`; `frontend/packages/core/types/ResponseError.ts`.
- **FE-23** Query keys: an exported constant `getXKey = ['get-x']` for collections (params appended: `[...getFormsKey, params]`) or a function for one record (`getFormKey(id) => ['form', String(id)]`). Key names are not uniform (`'get-forms'`, `'form'`, `'color-palettes'`, `'oauth-grants'`, `'public','user'`). — `frontend/packages/core/actions/get-forms/get-forms.hook.ts:6,12`; `frontend/packages/core/actions/get-form/get-form.hook.ts:7-9`; `frontend/packages/core/actions/get-color-palettes/get-color-palettes.hook.ts:6`; `frontend/app/modules/auth/use-auth.tsx:12`.
- **FE-24** Client choice: `api` for `/api/me/*` and `/api/admin/*` (cookie sent); `publicApi` for `/api/public/*`, `/api/login*`, `/api/signup`, `/api/password/*`, `/api/logout`. Endpoints that set or need the cookie across origins pass `{withCredentials: true}` (login password/Google/verify, logout, password reset, `PUT /api/me/password`, `GET /api/me` from `publicApi`). — `api.ts:5-14`; `frontend/packages/core/actions/login-password/login-password.service.ts:13`; `update-password.service.ts`.
- **FE-25** Both instances set `X-Requested-With: XMLHttpRequest` on every request (the API refuses cookie-authenticated writes without it with 403) and `Content-Type: application/json` unless the body is `FormData` (so the browser sets the multipart boundary). — `api.ts:16-27`; `backend/app/controllers/application_controller.rb:108-112`.
- **FE-26** Base URL is `import.meta.env.VITE_BASE_URL`, fixed at build time (production image default `https://api.kurz.fyi`; CI e2e `http://localhost:3000`). — `api.ts:6,13`; `.ci/Dockerfile.frontend:18`; `.github/workflows/ci.yml:155`.
- **FE-27** Timeouts. Axios has no default timeout, so a request without one waits forever (the cause of #330). Explicit values:

  | Call | Timeout | Where |
  |---|---|---|
  | `getFormSlots` (`GET /api/public/forms/:id/slots`) | 10 000 ms | `frontend/packages/core/actions/get-form-slots/get-form-slots.service.ts:4,17` |
  | `getLoggedUser`, `getLoggedUserPublic` (`GET /api/me`) | 5 000 ms | `frontend/packages/core/actions/get-logged-user/get-logged-user.service.ts:9`; `.public.service.ts:9` |
  | `getManageUsers` (`GET /api/admin/users`) | 5 000 ms | `frontend/packages/core/actions/get-manage-users/get-manage-users.service.ts:13` |
  | `getPublicForm` in SSR (only when a `request` is passed) | 4 000 ms | `frontend/packages/core/actions/get-public-form/get-public-form.service.ts:6,15` |
  | React stream render | 6 000 ms (5 000 + 1 000) | `frontend/app/entry.server.tsx:13,56` |

  After 10 s the slot picker shows its "could not load the times" message with a retry button (#330, `990ff03`).
- **FE-28** Error mapping has no single mechanism; four patterns exist:
  1. Let the `AxiosError` through and read `error.response.status` / `error.response.data.error` in the caller. Auth screens do this through `explainAuthError`, a table from API error code to `auth` i18n key (+ optional title); status 429 maps to `err_rate_limited`; unknown codes to `err_generic`. — `frontend/app/modules/auth/auth-errors.ts:11-42`.
  2. Rethrow the response body: `setFormPublished` throws `error.response.data`. — `frontend/packages/core/actions/set-form-published/set-form-published.service.ts:19-21`.
  3. Rethrow body plus status: `submitFormResponse` and `unlockShortlink` throw `{...data, status}`. Callers map status to messages (`failureFor`: 422 field errors, 403 captcha, 429 rate limit, 404/410/`closed` closed, 413 too long, else send failed; unlock: 401 wrong, 429 rate, 404 gone). — `frontend/app/routes/f/$publicId.tsx:46-60`; `frontend/app/routes/f/$publicId.tsx:48-58`; `frontend/app/routes/unlock/$shortCode.tsx:36-41`.
  4. Throw a code string: `joinWaitlist` throws one of eight `JoinWaitlistError` codes (`not_full`, `waitlist_full`, `too_many_waitlists`, `invalid`, `unavailable`, `captcha_failed`, `rate_limited`, `unknown`). — `frontend/packages/core/actions/waitlist/waitlist.service.ts:30-60`.
  Token pages return `null` on 404 (`getVerification`, `getWaitlistEntry`, `getAppointment`, `getAppointmentDecision`) so the loader can raise a 404 page.
- **FE-29** Owner-side form errors go through `formErrorMessage`: `forms_daily_limit` -> `forms:ed_daily_limit`; a `blocks[]` array whose codes are all known (`no_questions`, `no_service`, `service_incomplete`, `availability_incomplete`, `waitlist_questions`, `no_email`) -> joined `forms:err_publish_*` messages; `errors` object -> `"<key> <messages>"` joined by `; ` (raw API text, not translated); else `forms:ed_generic_error`. — `app/modules/forms/form-errors.ts:4-12,18-36`; contract pinned by `e2e/tests/api-contract.spec.ts:10-22` (422 `blocks[0].code = service_incomplete`).
- **FE-30** Toasts: `notifySuccess(message)` (green) and `notifyError(message, title = 'Error')` (red) wrap Mantine notifications; the default title `'Error'` is not translated, so callers pass a translated title. — `frontend/packages/core/utils/notify.ts:3-9`.
- **FE-31** Beacon calls that must not delay navigation use `fetch` with `keepalive: true` and swallow errors: form events `view` / `start` (`credentials: 'omit'`) and bio link clicks. — `frontend/packages/core/actions/track-form-event/track-form-event.service.ts:3-13`; `frontend/packages/core/actions/track-page-link-click/track-page-link-click.service.ts:5-19`.
- **FE-32** File downloads and images use `responseType: 'blob'` (`export-form-responses`, `export-form-appointments`, `get-form-cover`, `get-form-upload`, `get-qr-code`). Public covers are plain `<img>`/`og:image` URLs `VITE_BASE_URL/api/public/forms/:id/cover/:token`. — `get-qr-code.service.ts`; `frontend/app/modules/forms/form-cover-url.ts:1-9`.
- **FE-33** Visitor IP forwarding: SSR loaders add `X-Visitor-Ip` (from `cf-connecting-ip`) and `X-Ssr-Secret` (env `SSR_FORWARD_SECRET`) so API rate limits count the visitor, not the SSR server. Both are omitted unless the secret and the IP exist; the API trusts the header only when the secret matches. — `frontend/packages/core/utils/forward-visitor.ts:1-7`; `backend/app/controllers/concerns/client_ip.rb:7-22`; test `e2e/tests/form-share-preview.spec.ts:142`; `backend/spec/requests/client_ip_spec.rb`.

### State management and caching

- **FE-34** Server state lives in TanStack Query only. Defaults: `staleTime` 30 000 ms, `refetchOnWindowFocus: false`; retry up to 2 times for network errors and 5xx, never for a status below 500. — `frontend/packages/core/service-provider.tsx:5-17`.
- **FE-35** Overrides: `staleTime: Infinity` for form templates, the OAuth authorization preview and one query in the form editor; polling every 60 s for notifications (`REFRESH_MS`) and the agenda. — `frontend/packages/core/actions/get-form-templates/get-form-templates.hook.ts:15`; `frontend/packages/core/actions/get-oauth-authorization/get-oauth-authorization.hook.ts:14`; `frontend/app/routes/forms/$id.tsx:145`; `frontend/packages/core/actions/get-notifications/get-notifications.hook.ts:8,16`; `frontend/packages/core/actions/get-agenda/get-agenda.hook.ts:13`.
- **FE-36** Client state lives in a zustand store with `persist` that holds only the `User` profile (`user`, `setUser`, `clear`). It is a render cache for the header and for `useLocaleSync`; the cookie remains the source of truth and the app layout re-syncs the store from `GET /api/me`. — `frontend/packages/core/states/use-user-state.ts:8-33`; `frontend/app/layout/index.tsx:20-23`.
- **FE-37** Form state uses `@mantine/form` with zod resolvers (`mantine-form-zod-resolver`, zod 4); the booking editor's schema and pure logic are in `@internal/booking`, not in components. — `frontend/package.json:25,41`; `frontend/packages/booking/src/shared/validation.ts`.
- **FE-38** Mutations refresh data by invalidating the relevant key (46 `invalidateQueries` / `setQueryData` / `removeQueries` / `refetchInterval` call sites); there is no optimistic-update helper. — `grep` over `app/` and `packages/`.
- **FE-39** Caches that can leak between accounts are cleared at logout (`queryClient.clear()`, store `clear()`); a 401 clears the store but relies on the full-page redirect to drop the query cache. — `frontend/app/modules/auth/use-logout.ts:13-14`; `api.ts:33`.

### Internationalization (summary; the guide is [docs/i18n.md](../docs/i18n.md))

- **FE-40** Supported languages: `en` (default) and `pt-PT`. Resolution order: cookie `kurz_locale`, then the account's saved `locale`, then `Accept-Language` (by q value; any `pt*` maps to `pt-PT`, any `en*` to `en`), else `en`. — `app/i18n/locales.ts:1-4,10-15,49-57`; tests `frontend/app/i18n/locales.test.ts`.
- **FE-41** Server: the root loader resolves cookie then `Accept-Language` only (it cannot see the account preference). Client: `useLocaleSync` re-resolves with cookie, store `user.locale` and `navigator.languages`, then `switchLanguage`. — `frontend/app/root.tsx:29-32`; `frontend/app/i18n/use-locale-sync.ts:20-31`.
- **FE-42** Each route declares its namespaces in `ROUTE_NAMESPACES` (36 patterns). The root loader loads them for the matched pattern; `clientMiddleware` loads those of the next route on client navigation and falls back to a full document load if a chunk fails. — `frontend/app/i18n/namespaces.ts:5-46`; `frontend/app/root.tsx:39-47`.
- **FE-43** `frontend/app/i18n/namespaces.test.ts` walks the import graph of every route (regexes for `useTranslation`, `getFixedT`, `ns:`, `'ns:key'`) and fails when the declaration differs from the namespaces used. A new component imported by a route changes that route's set. — `frontend/app/i18n/namespaces.test.ts:22-75`.
- **FE-44** `frontend/app/i18n/parity.test.ts`: `pt-PT` has every namespace file; same keys (plural suffix ignored); same `{{placeholders}}`; every `en` key appears quoted in the sources of `app/` or `packages/`. A `{}` translated file is skipped. — `frontend/app/i18n/parity.test.ts:36-82`.
- **FE-45** i18next config: `fallbackLng: false` (no runtime fallback to `en`), `load: 'currentOnly'`, `defaultNS: 'menu'`, `interpolation.escapeValue: false` (React escapes). The server builds a fresh instance per request; the browser uses the singleton. — `frontend/app/i18n/index.ts:31-55`.
- **FE-46** Dates, numbers, currency and relative time go through `frontend/app/i18n/format.ts` (`formatDate`, `formatDateTime`, `formatRelative`, `formatNumber`, `formatCurrency`), which read `activeLocale()`. Components without `t()` call `useLocale()` to re-render on language change. — `frontend/app/i18n/format.ts:6-43`.
- **FE-47** The account language is saved from the screen's language once (`useSaveMissingLocale` -> `PATCH /api/me {locale}`) when the account has none; the switcher saves every choice made on this device. A saved value is never overwritten implicitly. — `frontend/app/i18n/use-locale-sync.ts:33-43`; `frontend/app/i18n/locales.ts:44-47`; `language-switcher.tsx`; tests `locales.test.ts`.
- **FE-48** Account time zone options are `UTC` plus `Intl.supportedValuesOf('timeZone')` plus the current value; the default zone constant is `Europe/Lisbon`. — `frontend/app/i18n/time-zones.ts:1-7`; test `frontend/app/i18n/time-zones.test.ts`; `e2e/tests/account-time-zone.spec.ts:6`.
- **FE-49** Not translated by design or gap: text written by owners (questions, titles); legal pages; `/about`, `/privacy`, `/service`, `/report`, `/status/success` content and every `meta` title (hard-coded English); admin screens' alerts. See drift D4.

### CSP, nonce and framing

- **FE-50** In production builds only (`import.meta.env.PROD`), requests whose path matches `^/u/`, `^/s/`, `^/f/` or `^/oauth/` get a 16-byte base64 nonce, `Content-Security-Policy` and `Cache-Control: no-store`. Dev never gets it because Vite injects inline scripts. — `frontend/app/utils/content-security-policy.ts:5`; `frontend/app/entry.server.tsx:34-41`.
- **FE-51** The policy: `default-src 'self'`; `script-src 'self' 'nonce-…'`; `style-src 'self' 'unsafe-inline'` (Mantine inline styles); `font-src 'self'`; `img-src 'self' data: blob: <api origin>`; `connect-src 'self' <api origin>`; `object-src 'none'`; `base-uri 'none'`; `form-action 'self'`; `frame-ancestors 'none'`. Only `/f/` also allows `https://challenges.cloudflare.com` in `script-src`, `connect-src` and `frame-src` (Turnstile). The API origin is `new URL(VITE_BASE_URL).origin`. — `frontend/app/utils/content-security-policy.ts:6-34`.
- **FE-52** The nonce reaches React through `NonceProvider` (server) and is also passed to `renderToPipeableStream`, `ServerRouter`, `<ColorSchemeScript>`, `<ScrollRestoration>` and `<Scripts>`. The client wraps the tree in `NonceProvider value={undefined}` so the component tree has the same shape and `useId` values match between server and client. — `frontend/app/utils/nonce.tsx:1-10`; `app/root.tsx:97,105-106`; `frontend/app/entry.client.tsx:7-15`.
- **FE-53** Independently of the nonce, the routes `/u/`, `/s/`, `/f/` (child), `/m/`, `/a/`, `/v/`, `/w/`, `/oauth/authorize` export `headers()` with `Content-Security-Policy: frame-ancestors 'none'` and `X-Frame-Options: DENY`, so framing is blocked in dev and prerender too. Token pages add `Referrer-Policy: no-referrer`. The strict policy replaces the `frame-ancestors`-only one when both apply (`entry.server` sets the header last). — `frontend/app/routes/bio/$username.tsx:19-24`; `frontend/app/routes/unlock/$shortCode.tsx:21-26`; `frontend/app/routes/m/$token.tsx:20-25`; `frontend/app/routes/f/$publicId.tsx:33-38`; `frontend/app/routes/oauth/authorize.tsx:13-18`.
- **FE-54** Fonts are self-hosted (Inter, Geist, Geist Mono) from `/fonts/*.woff2`, with the main Inter file preloaded; Google Fonts were removed because every visitor, including form respondents, would send their IP to Google. — `frontend/app/app.css:3-35`; `frontend/app/root.tsx:19-25`; `dc98cbc` (#14).
- **FE-55** Pages with no CSP (every other path: marketing, `/app`, `/login`, token pages `/m` `/a` `/v` `/w`) rely on framing headers only. Token pages are not in the strict list although they handle secret tokens. See drift D7.

### SEO, meta and share previews

- **FE-56** `root.tsx` `Layout` emits site-wide meta: viewport (`viewport-fit=cover`), `robots: index, follow, max-image-preview:large…`, `googlebot`, keywords, author, `og:type`, `og:site_name`, `og:locale=en_US` with alternate `pt_BR`, two `theme-color` entries (light `#f7f8fa`, dark `#101418`), favicons, manifest. — `app/root.tsx:13-26,57-95`.
- **FE-57** Per-route `meta` overrides titles; `SITE_URL = 'https://kurz.fyi'` is hard-coded in `modules/seo` and in the bio page canonical, so a self-hosted instance still advertises `kurz.fyi` in canonical and `og:url`. `ogImageMeta()` returns the shared 1200x630 `frontend/public/og.png` tags (source `frontend/og-image/og.html`). — `frontend/app/modules/seo/index.ts:3-23`; `frontend/app/routes/index.tsx:15-37`; `frontend/app/routes/bio/$username.tsx:34`.
- **FE-58** Bio page meta: title = `display_title` or `@slug`; description = `bio` or `Links from <title>`; `og:url` and `canonical` = `https://kurz.fyi/u/<username>`; if the page has an avatar, `twitter:card=summary` with `og:image = avatar_url`, else the site image. A missing page gets title `Page not found - Kurz`. — `frontend/app/routes/bio/$username.tsx:26-51`.
- **FE-59** Form share preview: `/f/:publicId` is split into a parent route that has a server `loader` + `meta` (so crawlers see the tags in HTML) and an index child that renders the form on the client. The loader swallows any error (`catch(() => null)`) and the head falls back to `Form - Kurz` + `noindex`. `formMeta` builds title (one line), description (form intro cut at a word at 160 characters with `…`, else translated `respond:meta_booking` / `meta_answer` using the form's language from the request), `og:url`, cover image (`image/webp`, absolute URL) or the site image. The head always carries `robots: noindex, nofollow`. — `frontend/app/routes/f/preview.tsx:7-22`; `frontend/app/modules/forms/form-meta.ts:5-62`; tests `frontend/app/modules/forms/form-meta.test.ts`, `e2e/tests/form-share-preview.spec.ts:25-129`; commit `fe5629e` (#285).
- **FE-60** Pages with no value for search export `robots: noindex, nofollow`: `/s/:shortCode`, `/m/`, `/a/`, `/v/`, `/w/`, `/oauth/authorize`, forms. — `frontend/app/routes/unlock/$shortCode.tsx:28-34`; `frontend/app/routes/m/$token.tsx:19-24`; `frontend/app/routes/oauth/authorize.tsx:20-25`.
- **FE-61** Static files in `frontend/public/`: `robots.txt` (allow all, `Disallow: /api/`, `/app/`; AI crawlers `GPTBot`, `ChatGPT-User`, `CCBot`, `anthropic-ai`, `Claude-Web` get `Allow: /llms.txt` + `Disallow: /`; `Crawl-delay: 0.5`; sitemap URL), `sitemap.xml` (3 URLs), `llms.txt` (project description, MCP endpoint `https://api.kurz.fyi/mcp`, rules for models), `site.webmanifest` (standalone, scope `/`, start `/`, theme `#101418`), icons and `og.png`. — `frontend/public/*`; tests `e2e/tests/static.spec.ts:3-17` pin `llms.txt` (starts with `# Kurz`, contains the MCP URL and `## Optional`) and the five blocked agents.

### Service worker

- **FE-62** `frontend/public/sw.js` is the only service worker. It is registered only when the user turns on "Notices on this device" in `/app/account` (`navigator.serviceWorker.register('/sw.js')`, default scope `/`), never at page load. It has no `fetch` handler and no cache: it does not make the app work offline. — `app/modules/notices/push.ts:46-48,69-88`; `frontend/public/sw.js`; commit `ee841f1` (#174).
- **FE-63** On `push` it shows a notification titled `Kurz` with a text chosen from the push `kind` (`appointment_created`, `appointment_requested`, `appointment_cancelled`, `appointment_expired`, `appointment_auto_confirmed`, else `fallback`) in `pt` or `en` according to `navigator.language` (not the app's cookie), and stays silent while a window is visible and focused. The payload carries only `kind` and `id`, so no name or time appears. A click focuses an existing same-origin window or opens `/app/agenda`. — `frontend/public/sw.js:1-62`; `backend/app/services/notifications/deliver_push.rb:52`; `backend/app/models/notification_preference.rb:3-9`. See [notifications-and-email](notifications-and-email.md).
- **FE-64** `install` calls `skipWaiting`, `activate` calls `clients.claim()`. Device state machine (unsupported, iOS needs Home Screen install, denied, off, on, server disabled) is in `frontend/app/modules/notices/push-logic.ts`, covered by `push-logic.test.ts`. — `frontend/public/sw.js:20-21`; `frontend/app/modules/notices/push-logic.ts`.

### Accessibility and UI conventions

- **FE-65** Conventions found in code (no lint rule enforces them; ESLint only runs the two `react-hooks` rules): icon-only buttons carry `aria-label` (131 occurrences, e.g. sidebar toggle `aria-label` + `title`); loading text uses `role="status"`, errors `role="alert"`; the shared `Loading` component sets `aria-busy` and a spinner with `aria-hidden`, animation under `motion-safe:`; decorative motion on the landing page checks `prefers-reduced-motion`; `app.css` has a `prefers-reduced-motion` section; `sr-only` and `focus-visible` styles exist. — `frontend/packages/ui/src/components/loading.tsx:10-33`; `app/app.css:179,287,317`; `frontend/app/components/app-sidebar/app-sidebar.tsx:79-86`; `frontend/app/modules/landing/hero-console.tsx:30`.
- **FE-66** Layout: mobile-first Tailwind; the app shell shows the sidebar from `lg` and a bottom `MobileNav` below it; content gets `pb-[calc(var(--mobile-nav-offset)+0.5rem)]` on small screens; safe-area insets and `dvh` are used. — `frontend/app/layout/index.tsx:23-40`; `app/app.css:114-117,153`; `frontend/app/components/mobile-nav/mobile-nav.tsx`.
- **FE-67** Theme: Mantine `defaultColorScheme="auto"` plus `<ColorSchemeScript>` (nonce-aware); Tailwind `dark` variant keyed on `data-mantine-color-scheme`; brand colour palette `brand` (primary shade 7 light / 4 dark); filled brand buttons use `--app-primary-foreground` for text. — `frontend/app/layout/providers.tsx:15`; `app/app.css:37,66,88`; `frontend/packages/ui/src/styles/mantine-theme.ts:7-23`.
- **FE-68** Design system `@internal/ui` exports presentational components only (`Card*`, `PageContainer`/`PageBackground`, `Alert`, `Loading`, `IconBadge`, `BrandMark`, `KurzLogo`, `ThemeToggle`, `StatCard`, `SummaryCard`, `ErrorBoundary`, `Layout` and its `Header/Nav/NavList/NavHeader/NavFooter/Main` parts) plus `mantineTheme`, style presets and `cn()` (`tailwind-merge` + `clsx`). Business logic stays in `app/modules`. — `frontend/packages/ui/src/components/index.ts:1-49`; `frontend/packages/ui/src/utils/cn.ts`.
- **FE-69** The root `ErrorBoundary` is the one from `@internal/ui`: `404` page for route errors with status 404, `Error` otherwise, the stack only in dev; English text, not translated. Public routes with their own `ErrorBoundary` (`/u`, `/s`, `/f`, `/m`, `/a`, `/v`, `/w`) render translated not-found screens. — `frontend/app/root.tsx:116`; `frontend/packages/ui/src/components/error-boundary/index.tsx:10-37`.

### Packages

- **FE-70** `@internal/core` holds `actions/`, `frontend/packages/core/states/use-user-state.ts`, `types/` (`Form`, `Oauth`, `Page`, `ResponseError`, `Shortlink`, `User`), `utils/` (`notify`, `forward-visitor`) and `service-provider.tsx` (`QueryClient`). It has no `package.json` dependencies; they come from the app's root. Imports use deep paths (`@internal/core/actions/...`). — `frontend/packages/core/package.json`; `service-provider.tsx`.
- **FE-71** `@internal/booking` is React-free: one module per booking mode (`services`, `individual`) registered in `registry.ts` (`modes = [servicesMode, individualMode]`, `modeFor(name)` defaults to `servicesMode`) plus `shared/` (schedule, rules, durations, time generator, summary, validation with zod). The UI in `app/routes/forms/components/booking-modes/*` and `frontend/app/modules/forms/booking-draft.ts` consumes it. Details and the rules it mirrors are in [booking-engine](booking-engine.md). — `frontend/packages/booking/src/registry.ts:1-7`; `frontend/packages/booking/src/index.ts:1-25`; `frontend/packages/booking/package.json`.
- **FE-72** Frontend validation duplicates backend rules in places (booking editor limits, `timeoutInRange(minutes, 15, 4320)` for waitlist confirmation, field limits). Those checks are advisory; the API remains authoritative. — `frontend/packages/booking/src/shared/validation.ts:297-317`; see [forms](forms.md) and [booking-engine](booking-engine.md).

## Flows

### Document request (production)

1. Edge/proxy forwards the request to the Node server (`react-router-serve`, `npm start`, port from `PORT`).
2. Root `loader` resolves the language and loads the route's namespaces (`frontend/app/root.tsx:28-35`); route `loader` (if any) fetches from `VITE_BASE_URL` with the visitor IP headers.
3. `entry.server` sets `Vary`, and for strict paths a nonce, CSP and `no-store`; renders HTML with a per-request i18next instance.
4. The browser hydrates with the same resources; `useLocaleSync` may switch the language after hydration; `/app` pages then query `GET /api/me`.

### Sign-in on the client

1. `/login` posts to `publicApi` (`/api/login/password`, `/api/login_request`, `/api/login_verify`, `/api/login/google`) with credentials; the API replies with `Set-Cookie: kurz_session`.
2. The page stores the returned user in zustand and calls `goAfterLogin` (OAuth return path or `/app`).
3. `/app` layout calls `GET /api/me`; on 401 the interceptor redirects to `/login`.

See [accounts-and-auth](accounts-and-auth.md) for the API side.

### Public form (`/f/:publicId`)

1. Server: parent `loader` calls `GET /api/public/forms/:id` (4 s, visitor IP), renders only the head (meta) and the child's spinner.
2. Browser: `clientLoader` repeats the call (no timeout), renders the form; `trackFormEvent('view')`; `GET .../slots` per month with a 10 s timeout; `POST .../responses` with an idempotency key, Turnstile token and honeypot `website`.
3. Errors map through `failureFor` (FE-28).

See [forms](forms.md) and [booking-engine](booking-engine.md).

### Language switch

`applyLocale(locale)` writes the cookie (1 year, `SameSite=Lax`) and calls `switchLanguage`, which loads the already-present namespaces in the new language first and calls `changeLanguage` only if all loaded and no newer switch was requested; `document.documentElement.lang` updates after success. — `frontend/app/i18n/use-locale-sync.ts:11-18`; `frontend/app/i18n/index.ts:69-76`.

## States and transitions

The frontend has no persisted status column. The one client state machine with business meaning is the push device state (`DeviceState`: unavailable, unsupported, iOS-needs-home-screen, denied, off, on) in `frontend/app/modules/notices/push-logic.ts`, pinned by `frontend/app/modules/notices/push-logic.test.ts`. The auth state is: no user in store (anonymous) -> `setUser` after login or `GET /api/me` -> `clear` on 401, deactivation, logout or a failed `GET /api/me` from the public menu.

## Limits and configuration

| Name | Value | Where | Notes |
|---|---|---|---|
| `VITE_BASE_URL` | build-time; prod default `https://api.kurz.fyi` | `.ci/Dockerfile.frontend:18`; read at `api.ts:6` | also builds the CSP `connect-src`/`img-src`; `strictCsp` throws if unset or invalid |
| `VITE_TURNSTILE_SITE_KEY` | build-time | `.ci/Dockerfile.frontend:19` | empty in e2e (`.github/workflows/ci.yml:156`) |
| `VITE_GOOGLE_CLIENT_ID` | build-time | `.ci/Dockerfile.frontend:21` | public id |
| `SSR_FORWARD_SECRET` | runtime env of the frontend and the API | `.ci/fe-stack.yml:17`; `.ci/stack.yml:68` | same value in both |
| `PORT` | runtime | `.ci/fe-stack.yml:16` (80); e2e 3001 | `react-router-serve` |
| `NODE_OPTIONS=--dns-result-order=ipv4first` | build | `frontend/Dockerfile:20`; `.ci/Dockerfile.frontend:29`; CI | prerender fetch needs IPv4 (react-router#15255) |
| Node | 22 (`frontend/Dockerfile`, CI) / 26 (`.ci/Dockerfile.frontend`) | see D2 | |
| Healthcheck | `curl http://localhost:80/robots.txt` every 10 s | `.ci/fe-stack.yml:20-25` | the static file proves the server is up |
| Frontend container limits | 0.5 CPU, 512 MB | `.ci/fe-stack.yml:29-32` | |
| Query `staleTime` | 30 s | `frontend/packages/core/service-provider.tsx:13` | |
| Query retry | 2, only on network or 5xx | `frontend/packages/core/service-provider.tsx:7-11` | |
| Notifications / agenda polling | 60 s | FE-35 | |
| Stream timeout | 5 s (+1 s abort) | `frontend/app/entry.server.tsx:13` | |
| Locale cookie | 1 year | `frontend/app/i18n/use-locale-sync.ts:8` | |
| OAuth return path | 4096 chars | `frontend/app/modules/oauth/return-to.ts:7` | |
| Form meta description | 160 chars | `frontend/app/modules/forms/form-meta.ts:5` | |
| Prettier | 80 cols, single quotes, semicolons, `trailingComma: es5`, `arrowParens: avoid` | `frontend/.prettierrc` | many newer files exceed 80 columns (not enforced in CI) |

## Authorization and privacy

- Anonymous visitors: public pages, form submission, token pages. They get no cookie from the frontend except `kurz_locale` (a language preference). The CSP restricts third parties to Turnstile on `/f/`.
- Owners: everything under `/app` after the client check (FE-11); admins: `/admin` (FE-14).
- Personal data in the browser: the cached `User` profile (id, e-mail, flags, locale, time zone) in localStorage until logout or 401; the session token is never in JS (FE-10). Form drafts and visitor zone choice are kept in localStorage by `modules/forms` (`picker-memory.ts`, `frontend/app/modules/forms/zone-time.ts:159`; see [forms](forms.md)).
- The SSR server receives visitor IPs from the proxy only to forward them to the API (FE-33); it does not store them.
- Self-hosted fonts and no analytics script: no third-party request on public pages other than Turnstile on `/f/` and Google sign-in where configured.

## API and UI surface

### Route map

Layouts: **bio** = `frontend/app/layout/bio-layout.tsx` (passthrough `<Outlet/>`, no site chrome); **app** = `frontend/app/layout/index.tsx` (sidebar, header, mobile nav, client auth gate); **guest** = `frontend/app/layout/guest.tsx` (passthrough); **web** = `Layout` of `frontend/app/layout/web-layout.tsx` imported by the page (marketing header and footer). Auth values: public, guest (public sign-in screens), owner (any signed-in user), admin. "Render": **P** prerendered, **S** server-rendered with loader, **D** server-rendered document without loader (static content), **C** server sends spinner/overlay and the browser fetches. Namespaces are copied from `frontend/app/i18n/namespaces.ts:6-41` (`menu` is the default namespace). Endpoints listed are the ones the screen reaches directly or through its modules; the client conditionally calls `GET /api/me` in headers and menus.

| URL pattern | Route file (`app/routes/`) | Layout | Auth | Render | i18n namespaces | Backend endpoints | Owner page |
|---|---|---|---|---|---|---|---|
| `/` | `index.tsx` | web | public | P | auth, landing, menu, pages | `GET /api/me` (only if a stored user) | [shortlinks](shortlinks.md), [bio-pages](bio-pages.md) |
| `/about` | `about.tsx` | web | public | P | auth, landing | none | none (static) |
| `/report` | `report.tsx` | web | public | P | auth, landing | none | [admin-and-moderation](admin-and-moderation.md) |
| `/privacy` | `privacy.tsx` | web | public | D | auth, landing | none | none (static) |
| `/service` | `service.tsx` | web | public | D | auth, landing | none | none (static) |
| `/status/success` | `frontend/app/routes/status/success.tsx` | web | public | D | auth, landing | none | [shortlinks](shortlinks.md) |
| `/u/:username` | `frontend/app/routes/bio/$username.tsx` | bio | public | S | landing, pages | `GET /api/public/pages/:slug` (SSR fetch); `POST /api/public/pages/:slug/links/:id/click` | [bio-pages](bio-pages.md) |
| `/s/:shortCode` | `frontend/app/routes/unlock/$shortCode.tsx` | bio | public | S | unlock | `GET /api/public/shortlinks/:code` (SSR); `POST /api/public/shortlinks/:code/unlock` | [shortlinks](shortlinks.md) |
| `/f/:publicId` (parent) | `frontend/app/routes/f/preview.tsx` | bio | public | S (head only) | forms, menu, respond | `GET /api/public/forms/:id` (SSR, 4 s) | [forms](forms.md) |
| `/f/:publicId` (index) | `frontend/app/routes/f/$publicId.tsx` | bio | public | C | forms, menu, respond | `GET /api/public/forms/:id`; `GET .../slots` (10 s); `POST .../responses`; `POST .../waitlist`; `POST .../fields/:fid/uploads`; `POST .../events`; `GET .../cover/:token` | [forms](forms.md), [booking-engine](booking-engine.md) |
| `/m/:token` | `frontend/app/routes/m/$token.tsx` | bio | public (token) | C | manage, menu | `GET /api/public/appointments/:token`; `POST .../:token/cancel` | [appointments-lifecycle](appointments-lifecycle.md) |
| `/a/:token` | `frontend/app/routes/a/$token.tsx` | bio | public (token) | C | decide, menu | `GET` / `POST /api/public/appointment_decisions/:token` | [appointments-lifecycle](appointments-lifecycle.md) |
| `/v/:token` | `frontend/app/routes/v/$token.tsx` | bio | public (token) | C | menu, verify | `GET` / `POST /api/public/appointment_verifications/:token` | [appointments-lifecycle](appointments-lifecycle.md) |
| `/w/:token` | `frontend/app/routes/w/$token.tsx` | bio | public (token) | C | menu, waitlist | `GET /api/public/waitlist/:token`; `POST .../claim`; `POST .../leave` | [appointments-lifecycle](appointments-lifecycle.md) |
| `/oauth/authorize` | `frontend/app/routes/oauth/authorize.tsx` | bio | owner (401 -> `/login`) | C (`ssr=false`) | account, appointments, forms, oauth, pages, responses | `GET /api/me/oauth/authorization?...`; `POST /api/me/oauth/authorization` | [mcp-and-oauth](mcp-and-oauth.md) |
| `/login` | `frontend/app/routes/login/index.tsx` | guest | guest | P | auth, menu, settings | `POST /api/login/password`, `/api/login_request`, `/api/login_verify`, `/api/login/google` | [accounts-and-auth](accounts-and-auth.md) |
| `/login-confirmation` | `frontend/app/routes/login/confirmation/index.tsx` | guest | guest | P | auth, settings | `POST /api/login_verify`, `/api/login_request` | [accounts-and-auth](accounts-and-auth.md) |
| `/signup` | `signup.tsx` | guest | guest | C | auth, settings | `POST /api/signup`, `/api/login/google` | [accounts-and-auth](accounts-and-auth.md) |
| `/password/forgot` | `frontend/app/routes/password/forgot.tsx` | guest | guest | C | auth, settings | `POST /api/password/forgot` | [accounts-and-auth](accounts-and-auth.md) |
| `/password/reset` | `frontend/app/routes/password/reset.tsx` | guest | guest | C | auth, settings | `POST /api/password/reset` | [accounts-and-auth](accounts-and-auth.md) |
| `/app` | `frontend/app/routes/dashboard/index.tsx` | app | owner | C | dashboard, links, menu, notifications | `GET`/`POST /api/me/shortlinks`, `PATCH`/`DELETE /api/me/shortlinks/:id`, `GET /api/me/shortlinks/:id/qr_code`, `GET /api/me/notifications` | [shortlinks](shortlinks.md) |
| `/app/links/:id` | `frontend/app/routes/links/$id.tsx` | app | owner | C | links, menu, notifications | `GET /api/me/shortlinks/:id`, `.../statistics`, `.../qr_code` | [shortlinks](shortlinks.md) |
| `/app/pages` | `frontend/app/routes/pages/index.tsx` | app | owner | C | menu, notifications, pages | `GET`/`POST /api/me/pages` | [bio-pages](bio-pages.md) |
| `/app/pages/:id` | `frontend/app/routes/pages/$id.tsx` | app | owner | C | landing, links, menu, notifications, pages, templates | `/api/me/pages/:id` (+ `links`, `links/reorder`, `avatar`, `apply_template`, `qr_code`), `/api/me/page_templates`, `/api/me/community_templates` (+ `/report`), `/api/me/color_palettes` | [bio-pages](bio-pages.md) |
| `/app/pages/:id/stats` | `frontend/app/routes/pages/stats.tsx` | app | owner | C | landing, menu, notifications, pages, responses | `GET /api/me/pages/:id`, `.../statistics`, `/api/me/color_palettes` | [bio-pages](bio-pages.md) |
| `/app/agenda` | `frontend/app/routes/agenda/index.tsx` | app | owner | C | agenda, menu, notifications | `GET /api/me/agenda` (poll 60 s), `GET /api/me/bookings`, `POST /api/me/appointments/:id/:action`, `POST /api/me/bookings/:key/manage_link` | [appointments-lifecycle](appointments-lifecycle.md) |
| `/app/forms` | `frontend/app/routes/forms/index.tsx` | app | owner | C | forms, menu, notifications | `GET`/`POST /api/me/forms`, `POST .../:id/duplicate`, `DELETE .../:id`, `GET /api/me/form_templates` | [forms](forms.md) |
| `/app/forms/:id` | `frontend/app/routes/forms/$id.tsx` | app | owner | C | booking, cover, forms, landing, links, menu, notifications, pages, respond | `/api/me/forms/:id` (+ `fields`, `fields/reorder`, `publish`/`unpublish`, `discard`, `cover`, `qr_code`), `POST /api/me/appointments/generate_times`, `GET /api/public/forms/:id/slots` (preview) | [forms](forms.md), [booking-engine](booking-engine.md) |
| `/app/forms/:id/responses` | `frontend/app/routes/forms/responses.tsx` | app | owner | C | appointments, forms, menu, notifications, responses | `/api/me/forms/:id/{responses,responses_export,summary,appointments,appointments_export,uploads/:token,waitlist}`, `DELETE .../responses[/:rid]`, `GET /api/me/shortlinks/:id` | [forms](forms.md), [appointments-lifecycle](appointments-lifecycle.md) |
| `/app/account` | `account.tsx` | app | owner | C | account, appointments, auth, calendarFeed, forms, menu, notices, notifications, oauth, pages, responses, settings | `PATCH`/`DELETE /api/me`, `PUT /api/me/password`, `POST /api/me/data_export`, `/api/me/notification_preferences`, `/api/me/push_config`, `/api/me/push_subscriptions`, `/api/me/calendar_feed`, `/api/me/oauth_grants` | [accounts-and-auth](accounts-and-auth.md), [notifications-and-email](notifications-and-email.md), [mcp-and-oauth](mcp-and-oauth.md) |
| `/app/notifications` | `frontend/app/routes/notifications/index.tsx` | app | owner | C | menu, notifications | `GET /api/me/notifications`, `POST .../:id/read`, `POST .../read_all` | [notifications-and-email](notifications-and-email.md) |
| `/admin` | `frontend/app/routes/admin/index.tsx` | app | admin (UI check) | C | menu, notifications | `GET /api/admin/abuse_signals`, `GET /api/admin/page_templates` | [admin-and-moderation](admin-and-moderation.md) |
| `/admin/users` | `frontend/app/routes/admin/users.tsx` | app | admin | C | admin, menu, notifications | `GET /api/admin/users` (5 s), `POST .../:id/toggle_active` | [admin-and-moderation](admin-and-moderation.md) |
| `/admin/shortlinks` | `frontend/app/routes/admin/shortlinks.tsx` | app | admin | C | admin, menu, notifications | `GET /api/admin/shortlinks`, `POST .../:id/toggle_active`, `.../toggle_safe` | [admin-and-moderation](admin-and-moderation.md), [shortlinks](shortlinks.md) |
| `/admin/audit-logs` | `frontend/app/routes/admin/audit-logs.tsx` | app | admin | C | menu, notifications | `GET /api/admin/audits`, `GET /api/admin/users` | [admin-and-moderation](admin-and-moderation.md) |
| `/admin/moderation` | `frontend/app/routes/admin/moderation/templates.tsx` | app | admin | C | landing, menu, notifications, pages, templates | `GET /api/admin/page_templates`, `POST .../:id/toggle_hidden`, page-template endpoints | [admin-and-moderation](admin-and-moderation.md), [bio-pages](bio-pages.md) |
| `/admin/moderation/abuse` | `frontend/app/routes/admin/moderation/abuse.tsx` | app | admin | C | menu, notifications | `GET /api/admin/abuse_signals`, `POST .../:id/dismiss`, `POST /api/admin/users/:id/toggle_active` | [admin-and-moderation](admin-and-moderation.md) |

Notes on the table: (1) the app layout also calls `GET /api/me` and, in the header bell, `GET /api/me/notifications` (60 s poll) on every `/app` and `/admin` page; (2) `/oauth/authorize` is inside the bio layout, so it has no app chrome and no `/api/me` gate: authentication is the 401 from its own API call; (3) the `/f/:publicId` parent and child share one URL, so its `i18n` row is the parent's declaration (`frontend/app/i18n/namespaces.ts:14`); (4) `/f/:publicId` also appears as a route pattern ending in `/` in the namespace test.

### Other UI surface

- Query-string contracts: `/login?deactivated=true` (shows the deactivation notice), `/oauth/authorize?<oauth params>`.
- Share URL of a form is `https://kurz.fyi/f/<publicId>`; manage links `https://kurz.fyi/m/<token>` come from the API (`manage_url`).
- The account page shows the MCP URL as `${VITE_BASE_URL}/mcp`. — `frontend/app/routes/account.tsx:342`.

## Decisions

### D-FE-01 Session in an httpOnly cookie, authentication on the client
**Decision.** The API sets `kurz_session` as httpOnly, `SameSite=Strict`, `Secure` in production; the browser sends it to the API only. The frontend authenticates with `GET /api/me` and treats the zustand profile as a render cache. **Why.** Code comments: an XSS can no longer steal the token; `kurz.fyi` and `api.kurz.fyi` are the same site, so frontend requests carry the cookie while requests started from other sites do not (`backend/app/controllers/concerns/session_cookie.rb:1-6`; `frontend/packages/core/states/use-user-state.ts:8-10`). Introduced in `5a12219` ("Bio pages", no message body). **Consequence.** SSR cannot render signed-in pages; `/app` is a spinner on the server, cost accepted for private screens. CSRF defence is `SameSite=Strict`, an exact CORS origin list and the `X-Requested-With` header (FE-25).

### D-FE-02 Language per request with per-route namespaces
**Decision.** No language bundled; the root loader returns only the namespaces declared for the route, in the visitor's language; a test keeps the declarations true. **Why.** Before #315 the server rendered everything in `en` from one singleton, every route shipped 27 namespaces of two languages (184 KB, 55 KB gzipped) and pt-PT visitors saw English first (`07896fc`, #315). **Consequence.** Adding a string in a new component can break `npm test` until `ROUTE_NAMESPACES` lists the namespace; `i18n.t` at module scope is forbidden; zod messages in `frontend/app/routes/forms/$id.tsx` became lazy.

### D-FE-03 Strict, nonce-based CSP only on pages that render user content
**Decision.** Nonce CSP on `/u/`, `/s/`, `/f/`, `/oauth/`; all other pages get none. **Why.** Code comment: stored content can never execute even if it reached the HTML unescaped (`frontend/app/utils/content-security-policy.ts:1-4`). `style-src 'unsafe-inline'` is kept for Mantine's inline style attributes. Fonts self-hosted in the same hardening (`dc98cbc`, #14). **Consequence.** Any new inline script on those paths needs the nonce; any new third-party origin on `/f/` needs an entry in the CSP; responses are `no-store`.

### D-FE-04 The form page is split into a server parent and a client child
**Decision.** `frontend/app/routes/f/preview.tsx` (server loader + meta) wraps `frontend/app/routes/f/$publicId.tsx` (client loader). **Why.** Link previews (WhatsApp, Slack, iMessage, Facebook, X, LinkedIn) need the tags in server-rendered HTML; the page had only a client loader (`fe5629e`, #285). The SSR call forwards the visitor IP so the 120 per minute limit is not shared by all crawlers and has a 4 s timeout; any failure gives the generic head. **Consequence.** The form is fetched twice (server for head, browser for body); the head always says `noindex`.

### D-FE-05 One folder per endpoint, thin services, optional hooks
**Decision.** Each endpoint is a folder of service/hook/types. **Why.** Not recorded in a commit message; the structure is consistent from the first commits (`bfb1573`, `1a2713e`). **Consequence.** See "How to add a new screen". Error shape is per service (FE-28).

### D-FE-06 Explicit timeouts only where a stall hurts
**Decision.** Add a timeout where a hung request freezes a screen. **Why.** The anonymous client had none, so a stalled slots request kept the calendar loading forever with no error or retry (`990ff03`, #330). **Consequence.** Other calls still have no timeout (FE-27).

### D-FE-07 Service worker only for push, registered on demand
**Decision.** `sw.js` handles push display and click only, with the language chosen from `navigator.language`. **Why.** The push payload carries only the kind of event so no name or time leaves the server; the worker stays quiet while Kurz is open and in front (`ee841f1`, #174). **Consequence.** No offline support or asset caching exists. A new push kind needs a text entry in `sw.js` or it shows `fallback`.

### D-FE-08 Fixed build-time API origin
**Decision.** `VITE_BASE_URL` is a build argument, not a runtime setting. **Why.** It is used in the CSP, in bundles and in prerendered pages; the Dockerfile comments say deploys must build "exactly as before" and the security harness overrides it (`.ci/Dockerfile.frontend:16-24`). **Consequence.** One image per API origin.

## Change impact

- **Add or rename an API field or status**: update the action's `.types.ts`, the callers, `api-contract.spec.ts` if the contract is pinned, and the MCP tools if shared. The previous frontend release must survive the new schema (CLAUDE.md "Deploys do not stop the site").
- **New route**: edit `frontend/app/routes.ts`, add the pattern to `ROUTE_NAMESPACES` (`namespaces.ts`), export `meta`, `headers` (framing) and `ssr = false` for app screens; decide strict CSP (`frontend/app/utils/content-security-policy.ts:5`) and robots/sitemap entries.
- **Change cookie name, domain, `SameSite` or CORS list**: `session_cookie.rb`, `cors.rb`, `api.ts` (`withCredentials`), e2e `e2e/support/auth.ts` (injects `kurz_session` for `localhost`), CSP `connect-src`.
- **Change `errors.account_deactivated` text or language**: breaks FE-13.
- **Change a notification kind**: `NotificationPreference::SUPPORTED`, `sw.js` text table, `notices` namespace, `notice-matrix`.
- **Change the share-preview behaviour**: `form-meta.ts`, `form-meta.test.ts`, `e2e/tests/form-share-preview.spec.ts`; bio preview in `frontend/app/routes/bio/$username.tsx`.
- **Change the slots endpoint**: `getFormSlots` (10 s timeout, `monthly=1`), the session picker, [booking-engine](booking-engine.md).
- **Add a language**: follow docs/i18n.md; also `sw.js` `TEXT`, `match()`, `activeLocale()`, `root.tsx` `og:locale`, the backend locale files (`backend/config/locales`).
- **Change the SSR forward secret or header names**: `forward-visitor.ts`, `client_ip.rb`, `.ci/*.yml`, the e2e config.
- **Upgrade Node or React Router**: `Dockerfile`s, CI, `NODE_OPTIONS` workaround (react-router#15255).

## Tests that pin this behaviour

- `npm test` (`frontend/package.json:10`) runs `node --test` over `app/i18n/*.test.ts`, `app/modules/{forms,agenda,notices,appointments-tab}/*.test.ts` and `packages/booking/src/**/*.test.ts` (34 files). No React component tests, no jsdom, no vitest: tests cover pure `.ts` modules that import siblings with explicit `.ts` extensions (`allowImportingTsExtensions`).
- i18n: `locales.test.ts` (resolution, `localeToSave`, cookie parsing), `parity.test.ts`, `namespaces.test.ts`, `time-zones.test.ts`.
- Forms: `form-meta.test.ts`, `booking-*.test.ts`, `linkify.test.ts`, `zone-time.test.ts`, `form-cover.test.ts`, `confirm-email.test.ts`, `field-title.test.ts`, `monthly-booking.test.ts`.
- Other: `agenda-*.test.ts`, `appointment-filters.test.ts`, `notice-matrix.test.ts`, `push-logic.test.ts`.
- CI `frontend` job: `npm ci`, `npm run typecheck` (`react-router typegen && tsc`), `npm test`, `npm run build` with `NODE_OPTIONS`; lint is not run in CI. — `.github/workflows/ci.yml:59-78`.
- e2e (Playwright, `chromium`, `pt-PT`, `Europe/Lisbon`, 1 worker, sign-in by injecting the `kurz_session` cookie): `e2e/tests/static.spec.ts:3,12` (llms.txt, robots.txt), `e2e/tests/smoke.spec.ts:5` (owner opens the editor at `/app/forms/:id`, public form renders `/f/:id`), `form-share-preview.spec.ts` (meta, noindex, SSR IP forwarding), `api-contract.spec.ts` (API behaviour the frontend relies on: publish blocks 422 shape, `email_delivery`, `410 closed`, `429 rate_limited`, `errors.answers[...] = ['unavailable']`), plus feature specs listed in the domain pages. — `e2e/playwright.config.ts`; `e2e/README.md`.

## Drift and open questions

- **D1 (medium)** `export const ssr = false` appears in 23 route files, but `react-router.config.ts` only sets the global `ssr: true`. I could not read React Router's source (no `node_modules`), so I cannot confirm that a route-level `ssr` export is honoured. Observable behaviour is the same either way: these routes have no loader and the app layout shows an overlay until `GET /api/me` returns. `/login` and `/login-confirmation` carry the export and are also prerendered. Verify before relying on it.
- **D2 (low)** Node version: `CLAUDE.md`, `frontend/Dockerfile`, `frontend/README.md` and CI use Node 22; the production image `.ci/Dockerfile.frontend` is `node:26-bookworm`. The tests run on a different major than production. `CLAUDE.md` is also silent on `npm ci --legacy-peer-deps` used by both Dockerfiles but not by CI.
- **D3 (low)** `og:locale` is `en_US` with alternate `pt_BR`, while the second language is `pt-PT`; `<html lang>` follows the real language but the OG tags do not. `site.webmanifest` has `lang: en-US`; the sitemap lists `hreflang pt` pointing to the same URL. — `frontend/app/root.tsx:77-78`; `frontend/public/sitemap.xml`.
- **D4 (medium)** docs/i18n.md says every new UI string goes to `en` and every other language, but large parts are English-only literals: marketing page bodies, all `meta` titles, `notifyError` default title, the root `ErrorBoundary`, admin alerts and descriptions ("Access denied", "Accounts, activate and deactivate"). Legal text is explicitly exempt in the doc; the rest is not. — `frontend/app/routes/about.tsx`, `privacy.tsx`, `admin/index.tsx:42-44,55`; `frontend/packages/ui/src/components/error-boundary/index.tsx:11-24`.
- **D5 (low)** The `home` namespace (`frontend/app/i18n/en/home.json`, `frontend/app/i18n/pt-PT/home.json`, one key `total_links`) is declared in `i18next.d.ts` but used by no route; the component uses `dashboard:total_links`. The "every en key is used" test passes because the string `total_links` appears elsewhere. Dead file.
- **D6 (low)** `create-public-shortlink` (`POST /api/shortlinks`) has a service and hook but no caller, and `backend/config/routes.rb` has no such public route (only `/api/me/shortlinks`). Dead action.
- **D8 (low)** Stale comments: `frontend/packages/core/actions/get-public-page/get-public-page.service.ts:5-7` says the axios instances read the token from a zustand store in localStorage (they do not; the token is an httpOnly cookie since `5a12219`). `sitemap.xml` lists `/app` (disallowed by `robots.txt`) and `/login`, omits `/about`, `/privacy`, `/service`, and has `lastmod 2025-10-13`. `robots.txt` does not disallow `/admin/`. A `Sitemap:` comment says "update with your actual domain".
- **D9 (low)** Hard-coded `https://kurz.fyi` (`SITE_URL`, bio canonical, CORS list in the backend) means a self-hosted instance advertises the public instance in canonical and OG URLs.
- **D10 (low)** `sw.js` picks the notification language from `navigator.language`, not from the app's `kurz_locale` cookie or the account language, so a user who chose English on a Portuguese browser gets Portuguese notices. The click target is always `/app/agenda` whatever the kind.
- **D11 (medium)** The deactivated-account redirect depends on matching an English message string (FE-13). The API does not set a locale per request today, so it works; a localized API message or a changed wording silently turns the redirect into a plain 403.
- **D12 (low)** Error handling has four unrelated patterns (FE-28) and most mutations do not set a timeout (FE-27); query-key naming is inconsistent (FE-23).
- **D13 (low)** ESLint runs only two `react-hooks` rules and is not run in CI; Prettier is configured (80 columns) but not enforced, and many files exceed it. TypeScript `strict` is on.
- **D14 (low)** `docs/i18n.md` is accurate against the code on the points checked: locales, cookie name, resolution order, `Vary` header, prerendered list, `clientMiddleware` fallback, `namespaces.test.ts` and `parity.test.ts` behaviour, `i18nFor(matches[0]?.loaderData)` in `frontend/app/routes/f/preview.tsx:14`. Gaps in the doc: it does not mention that the server loader ignores the account `locale`, that `ROUTE_NAMESPACES` keys use route patterns without the `(index)` distinction, or that prefix `pt` (any region) maps to `pt-PT`.
- **D15 (low)** Not verified: how the production edge routes `kurz.fyi` to the Node server and `api.kurz.fyi` to Rails (see [platform-and-operations](platform-and-operations.md)); the local dev API/frontend ports (the CORS list allows `http://localhost:5173` outside production and docker-compose publishes Rails on 3000; `VITE_BASE_URL` for `npm run dev` is not documented in the repo, `frontend/.env` is git-ignored). In e2e the frontend runs on 3001 and Rails on 3000 on `localhost`; the cookie is `SameSite=Strict` and cookies ignore ports, so it is sent cross-port.

## How to add a new screen

1. **Endpoint first**. Create `packages/core/actions/<verb>-<noun>/` with `<name>.service.ts` (use `api` for `/api/me`/`/api/admin`, `publicApi` for anonymous; unwrap `response.data`; encode path params with `encodeURIComponent` for tokens and slugs), `<name>.types.ts`, and `<name>.hook.ts` (export a key constant or function; accept optional TanStack options and spread them last). Add a timeout if a stall would freeze the screen. Pick one error pattern from FE-28 and keep it consistent in the folder.
2. **Route file** under `app/routes/<area>/…`, register it in `frontend/app/routes.ts` inside the right layout (`frontend/app/layout/index.tsx` for signed-in screens, `frontend/app/layout/bio-layout.tsx` for public pages without site chrome, `frontend/app/layout/guest.tsx` for sign-in screens; static marketing pages import `Layout` from `frontend/app/layout/web-layout.tsx`).
3. **Rendering decision**: signed-in screen -> `export const ssr = false`, no loader, data through hooks, no auth code (the layout gates it); admin screen -> also check `data.user.admin` and render an access-denied alert; public page with user content -> server `loader` using a plain `fetch` + `forwardVisitor(request)`, 404 via `data(..., {status: 404})`; token page -> `clientLoader` + `HydrateFallback`.
4. **Head and framing**: export `meta` (title, `noindex` if private, canonical and OG for public pages, `ogImageMeta()`), and `headers()` with `frame-ancestors 'none'` and `X-Frame-Options: DENY` for any public page; add `Referrer-Policy: no-referrer` for token pages. If the page renders user content, add its prefix to `STRICT_CSP_PATHS` and list any new origin in `strictCsp`.
5. **Strings**: add keys to `app/i18n/en/<ns>.json` and `pt-PT/<ns>.json` (flat snake_case, `{{placeholders}}`, `_one`/`_other` plurals); use `useTranslation('<ns>')`; outside components only in browser-only code (`i18n.t('ns:key')`); never at module scope; dates and numbers through `frontend/app/i18n/format.ts`. Run `npm test` and copy the namespace list it prints into `ROUTE_NAMESPACES`.
6. **UI**: Mantine components and `@internal/ui` (`PageContainer`, `Card`, `Alert`, `Loading`); Tailwind utilities with the semantic tokens (`bg-background`, `text-muted-foreground`); mobile-first, add bottom padding for the mobile nav; `aria-label` on icon buttons, `role="alert"` on errors, `role="status"` on loading, `motion-safe:` on animations.
7. **Feedback**: `notifySuccess` / `notifyError` with translated title and message; map API errors with the folder's pattern; invalidate the relevant query keys after mutations.
8. **Navigation**: add entries to `app-sidebar.tsx`, `mobile-nav.tsx` and `app-header.tsx` (wrapped in `AdminGuard` for admin), plus breadcrumbs if nested.
9. **Pure logic** (parsing, formatting, state machines) goes into React-free `.ts` modules imported with explicit `.ts` extensions, with a `*.test.ts` using `node:test`; add the folder to the `npm test` globs in `package.json:10` if it is new (otherwise the test does not run).
10. **Verify** in containers (CLAUDE.md): `npm run typecheck`, `npm test`, `npm run build` with `NODE_OPTIONS=--dns-result-order=ipv4first`; add an e2e spec under `e2e/tests/` for a user-visible flow; update `frontend/public/sitemap.xml` and `llms.txt` if the page is public and indexable, and the domain wiki page and this route map.
