# Bio Pages

> Scope: bio pages (`/u/:slug`), their links, themes and custom colors, avatars, templates (built-in, own, Community), link safety checks, click tracking and page statistics, QR code, deletion. State as of commit `bc7f65c` (2026-10-17).
> Main code: `backend/app/models/page*.rb`, `backend/app/controllers/api/me/{pages,page_links,page_templates,community_templates,color_palettes}_controller.rb`, `backend/app/controllers/api/public/{pages,page_link_clicks}_controller.rb`, `backend/app/services/{apply_page_template,built_in_page_templates,avatar_upload,image_upload}.rb`, `backend/app/jobs/{page_link_safety,recheck_page_links_safety,optimize_avatar,cleanup_stale_avatar_uploads}_job.rb`, `backend/app/services/mcp/tools/*page*.rb`, `frontend/app/routes/pages/`, `frontend/app/routes/bio/$username.tsx`, `frontend/app/modules/bio-page/`.

## Summary

A bio page is a public link-in-bio page owned by one user and served at `/u/:slug`. It has a title, a bio text, a theme (or three custom colors), an optional avatar and an ordered list of up to 50 items of three kinds: button links, social icons and section headers. A page is public only when it is published, not expired, not soft-deleted and its owner is active. Owners start a page from a built-in template, one of their own saved templates or a Community template (always as placeholders), and can publish their own templates to the Community gallery, where three reports hide a template until an admin looks at it. Link URLs are checked against Google Safe Browsing (when enabled) and flagged links disappear from the public page. Each click on a public link is stored with coarse visitor data and aggregated into the owner's statistics. The same pages can be drafted through the MCP server (draft-only unless the grant has full access).

## Glossary

- **Page** (`Page`): one bio page; the table is `pages`. A user can own many.
- **Slug** (`Page#slug`): the address segment in `/u/:slug`. Called "username" in the frontend route (`routes/bio/$username.tsx`) and "address" in the editor.
- **Page link / item** (`PageLink`): one entry of a page. `kind` is `link` (button), `social` (icon in the row under the title) or `header` (section title, no URL).
- **Network** (`PageLink::NETWORKS`): one of nine brand icons the frontend can draw: instagram, tiktok, facebook, linkedin, snapchat, youtube, x, onlyfans, whatsapp. Stored in `PageLink#icon`.
- **Theme** (`Page::THEMES`): one of six presets: default, midnight, sunset, forest, ocean, paper.
- **Custom colors** (`custom_colors`): a `{background, text, accent}` object of `#RRGGBB` values that overrides the theme. Shared with forms through the `CustomColors` concern.
- **Palette** (`ColorPalette`): a named, saved set of custom colors owned by a user.
- **Avatar** (`avatar`): the page photo, a WebP of at most 1024 px. `avatar_upload` is the raw upload waiting for `OptimizeAvatarJob`.
- **Template** (`PageTemplate`): a snapshot of a page's items and theme. Ids: built-in key (`creator`), `custom-<id>` (own, with originals) and `community-<id>` (someone else's published one, placeholders only).
- **Community gallery**: the list of `public` and not hidden templates (`PageTemplate.listed`).
- **Placeholder**: the neutral replacement of an item in a public template (`PageTemplate#public_items`); the placeholder URL is `https://example.com/replace-me` (`BuiltInPageTemplates::PLACEHOLDER`).
- **Safe** (`PageLink#safe`): false when Safe Browsing flagged the URL. Unsafe links are never shown or clickable publicly.
- **Visible** (`Page.visible`, `PageLink.visible`): what anonymous visitors can see.

## Data

Full catalogue in [data-model](data-model.md). Tables owned by this domain:

| Table | Key columns and constraints | Source |
|---|---|---|
| `pages` | `slug` string not null, unique index; `user_id` FK to `users` (no cascade); `published` bool default `true`; `theme` default `default`; `display_title`, `bio` text; `custom_colors` jsonb null; `expires_at`; `deleted_at` (soft delete, indexed). Avatars are Active Storage attachments `avatar` and `avatar_upload`. | `backend/db/schema.rb:435`, `backend/app/models/page.rb:97-102` |
| `page_links` | `page_id` FK ON DELETE cascade; `kind` default `link`; `label` not null; `url` null; `icon`; `position` int default 0; `active` default `true`; `safe` default `true`; `safe_checked_at`; `clicks_count` default 0. Index `(page_id, position)`. | `backend/db/schema.rb:388` |
| `page_link_clicks` | `page_link_id` FK ON DELETE cascade; `clicked_at` not null; `ip_address`, `user_agent`, `referer`, `country_code`, `region`, `platform`, `browser` (all nullable strings). Indexes `(page_link_id)`, `(page_link_id, clicked_at)` and partial `(clicked_at) WHERE ip_address IS NOT NULL` for the IP purge. | `backend/db/schema.rb:373` |
| `page_templates` | `user_id` FK cascade; `author_page_id` FK ON DELETE nullify; `items` jsonb default `[]`; `theme`; `visibility` default `private`; `hidden_at`; `published_at`; `reports_count`, `uses_count`; `author_label`; `description`. Index `(visibility, hidden_at, uses_count)`. | `backend/db/schema.rb:415` |
| `page_template_reports` | FKs cascade to template and user; `reason`; unique `(page_template_id, user_id)`. | `backend/db/schema.rb:404` |
| `color_palettes` | `user_id` FK cascade; `name`; `custom_colors` jsonb not null. | `backend/db/schema.rb:163` |

- Enumerations (`kind`, `theme`, `visibility`, `reason`, `icon`) have no database check constraint. They are validated in the models and contracts only.
- `clicks_count` on `page_links` is kept by `counter_culture` (`backend/app/models/page_link_click.rb:30`). `PageLinkClick` rows are never updated except by the IP purge.
- Cache keys: `page_link_click:<link_id>:<ip>` (TTL 10 s, click dedup). Rate limit counters use the names in [Limits and configuration](#limits-and-configuration).
- Queues: `safety` (link checks), `images` (avatar optimization, one thread cluster-wide, `backend/config/queue.yml:36`), `default` (avatar cleanup).
- The `Schema Information` comments in `page.rb`, `page_serializer.rb` and the factory omit the `custom_colors` column added by `backend/db/migrate/20261006000000_add_custom_colors_to_pages_and_forms.rb`; the column exists in `schema.rb:435`.
- Related table: `abuse_signals` (written by `DetectPageAbuseJob`, owned by [admin-and-moderation](admin-and-moderation.md)).

## Business rules

### Slug (address)

- **BP-01** The slug is stripped and downcased on assignment (`normalizes`), so `"  Alex.Castro "` is stored as `alex.castro` and lookups are case-insensitive (the public controller also downcases the URL parameter). — `backend/app/models/page.rb:85`, `backend/app/controllers/api/public/pages_controller.rb:14`; test `backend/spec/requests/api/me/pages_spec.rb:53`, `backend/spec/requests/api/public/pages_spec.rb:8`.
- **BP-02** Allowed slugs match `\A[a-z0-9][a-z0-9_.-]{1,28}[a-z0-9]\z`: 3 to 30 characters, lowercase ASCII letters and digits plus `_`, `.` and `-`, starting and ending with a letter or digit. Dots, repeated separators and all-digit slugs are allowed. Unicode, spaces and a leading dash are rejected. — `backend/app/models/page.rb:42,86`; test `backend/spec/requests/api/me/pages_spec.rb:68`.
- **BP-03** These 19 slugs are reserved: `about admin api app dashboard help kurz login logout me new pages report settings signup status support u www`. The check runs after normalization, so `Admin` is also rejected. — `backend/app/models/page.rb:44-64,86`; test `backend/spec/requests/mcp_page_tools_spec.rb:59`. Rationale: "would be confusing as /u/:slug or collide with product words" (code comment, `page.rb:43`, commit `5a12219`).
- **BP-04** A slug is globally unique across all users, including soft-deleted pages. The model checks `Page.with_deleted` to return a validation error instead of a database exception; the unique index `index_pages_on_slug` is the backstop. A race that reaches the index returns 409 `{"message":"Conflict"}`. — `backend/app/models/page.rb:87,132-139`, `backend/db/schema.rb:447`, `backend/app/controllers/application_controller.rb:45`; test `backend/spec/requests/api/me/pages_spec.rb:60`.
- **BP-05** The slug can be changed at any time with `PATCH /api/me/pages/:id`, also while the page is published. The old slug is released at once and nobody is redirected from it, so printed QR codes and shared links to the old address stop working. There is no slug history. — `backend/app/contracts/page_update_contract.rb:3`, `backend/app/models/page.rb:132`. Not recorded: why renaming is free.
- **BP-06** The slug is checked by the model and the frontend only. The contracts only require a non-empty string. The frontend repeats the regex in `routes/pages/index.tsx:34` and `routes/pages/$id.tsx:72`. The slug is a database-unique column but the case-insensitivity depends on the model normalization.

### Pages per user, states and visibility

- **BP-07** There is no limit on the number of pages per user. The only brake is `pages_create`: 10 creations per hour per user on `POST /api/me/pages` (rate limit message "Too many pages created, please try again later"). Rationale: "slows down scripted squatting of slugs and bulk phishing pages from fresh accounts" (code comment). — `backend/app/controllers/api/me/pages_controller.rb:8-15`. No spec pins this REST limit. The MCP `create_page` has its own limits (BP-73).
- **BP-08** `published` defaults to `true` in the database. `POST /api/me/pages` accepts `published` but the dashboard create form sends only `slug`, `display_title` (and the template key), so a page created in the dashboard is public as soon as it exists (empty, showing "No links yet."). Pages created through MCP are always drafts (BP-73). — `backend/db/schema.rb:442`, `frontend/packages/core/actions/create-page/create-page.types.ts:3`, `frontend/app/modules/bio-page/bio-page-view.tsx:169`.
- **BP-09** The public page is served only if the page is not soft-deleted, `published` is true, `expires_at` is null or in the future, and the owner has `deactivated_at IS NULL`. Everything else answers 404 (no distinction between missing, draft, expired, deleted, deactivated). — `backend/app/models/page.rb:74-80`, `backend/app/controllers/api/public/pages_controller.rb:14`; tests `backend/spec/requests/api/public/pages_spec.rb:40,48,56,64`.
- **BP-10** `expires_at` must be in the future at the moment it is written (contract rule). Resending an already past value is rejected too. Nothing unpublishes the page at expiry: it stays `published: true` and simply stops being visible; clearing `expires_at` (`null`) brings it back. — `backend/app/contracts/page_update_contract.rb:16`, `backend/app/contracts/page_contract.rb:18`. Not pinned by a spec.
- **BP-11** A deactivated owner (admin deactivation or pending account deletion) takes all pages offline without changing `published`; reactivation brings them back. See [accounts-and-auth](accounts-and-auth.md). — `backend/app/models/page.rb:79`, `backend/app/models/user.rb:80,98`.
- **BP-12** `display_title` is at most 80 characters and `bio` at most 300, enforced by the model only (errors come back as an array of messages). Both are plain text; markup is stored and returned inertly. — `backend/app/models/page.rb:89-90`; tests `backend/spec/requests/security/injection_spec.rb:53`, `backend/spec/requests/mcp_page_tools_spec.rb:168`.
- **BP-13** The public response carries only `slug, display_title, bio, theme, custom_colors, avatar_url, links` and no owner data or counters. Links are filtered to `active && safe` and keep the page order. — `backend/app/serializers/public_page_serializer.rb:5-14`; test `backend/spec/requests/api/public/pages_spec.rb:8`.

### Link kinds and validation

- **BP-14** `kind` is `link`, `social` or `header` (default `link`). A page has at most 50 items of all kinds together; the limit is checked on create only. The 51st returns 422 "A page can have at most 50 links". — `backend/app/models/page_link.rb:28,62,69,115-119`. No spec pins the limit.
- **BP-15** `label` is required and at most 80 characters (model). The contract only requires a non-empty string. — `backend/app/models/page_link.rb:63`, `backend/app/contracts/page_link_contract.rb:4`.
- **BP-16** `link` and `social` items require a `url` of at most 2048 characters. A `header` must have no URL and one with a URL is rejected. — `backend/app/models/page_link.rb:64-65`, `backend/app/contracts/page_link_contract.rb:13-17`; tests `backend/spec/requests/api/me/page_link_kinds_spec.rb:17,22,26`.
- **BP-17** Only `http` and `https` URLs with a host are accepted (macro `http_url`: `URI.parse(value.strip)` must be `URI::HTTP` with a host). `javascript:`, `data:`, `vbscript:`, `//host`, `https://` and strings with spaces are rejected on create and update. The contract validates the stripped value but the model stores the value as sent (no `strip`), so surrounding whitespace is kept. — `backend/app/contracts/application_contract.rb:16-24`, `backend/app/contracts/page_link_update_contract.rb:11`; tests `backend/spec/requests/api/me/page_links_spec.rb:23`, `backend/spec/requests/security/injection_spec.rb:29,40`, `backend/spec/requests/mcp_page_tools_spec.rb:149`.
- **BP-18** The frontend repeats the scheme rule twice: the editor form uses `z.url({protocol: /^https?$/})` and the label max 80 (`page-content-editor.tsx:56-57`), and the public view only sets `href` for URLs that start with `http://` or `https://`, as "a second line of defense" (`bio-page-view.tsx:8-13`).
- **BP-19** Nothing blocks private, local or non-public hosts, shortener URLs or the page's own URL; the only content check is Safe Browsing (BP-46 to BP-51).
- **BP-20** A `social` item requires `icon` to be one of the nine networks. For other kinds `icon` is optional but, when present, must be a known network (a `link` with an icon is drawn as a button with the brand icon). — `backend/app/models/page_link.rb:66-67`, `backend/app/contracts/page_link_contract.rb:19-21`; tests `backend/spec/requests/api/me/page_link_kinds_spec.rb:30,35,40`.
- **BP-21** The backend never checks that the icon matches the URL host. The frontend does: shortcuts build the URL from a handle (`socialLinkUrl`), `isValidSocialValue` requires a pasted URL to belong to the chosen network's hosts, and the generic "add button" form sets `icon` from the URL host via `detectSocialNetwork` (frontend only). — `frontend/app/modules/bio-page/social-networks.tsx:120,134,142`, `frontend/app/routes/pages/components/page-content-editor.tsx:159-161`.
- **BP-22** `link` and `social` can be switched into each other with `PATCH` (`kind` accepts only those two). A `header` can never become a link or social and the reverse. — `backend/app/contracts/page_link_update_contract.rb:4`, `backend/app/models/page_link.rb:68,98-103`; tests `backend/spec/requests/api/me/page_link_kinds_spec.rb:45,56`.
- **BP-23** `active: false` hides an item from visitors (and blocks clicks on it) without deleting it. Applying a template creates all non-header items inactive (BP-33). — `backend/app/models/page_link.rb:53`, `backend/app/serializers/public_page_serializer.rb:11`.
- **BP-24** The public view groups buttons under the header that precedes them, pulls social items into a row under the title and drops a header that has no visible button below it. This grouping is frontend only. A `social` item whose icon the frontend does not know is rendered as a button. — `frontend/app/modules/bio-page/bio-page-view.tsx:22-35`.

### Ordering

- **BP-25** A new item gets `position = max(position) + 1` of the page (position 1 on an empty page). The API does not accept `position` on create or update. — `backend/app/models/page_link.rb:80,109-113`, `backend/app/contracts/page_link_contract.rb`; test `backend/spec/requests/api/me/page_links_spec.rb:13`.
- **BP-26** Items are always read ordered by `(position, id)`. — `backend/app/models/page.rb:96`; test `backend/spec/requests/api/me/pages_spec.rb:30`.
- **BP-27** `PATCH /api/me/pages/:page_id/links/reorder` takes `{ids: [...]}` and requires every item of the page exactly once (headers, inactive and flagged items included). Anything else is 422 `{errors: {ids: ["must list every link of the page exactly once"]}}`. Positions are rewritten as 1..n inside one transaction, and `updated_at` is touched. — `backend/app/controllers/api/me/page_links_controller.rb:35-52`; tests `backend/spec/requests/api/me/page_links_spec.rb:63,74`, `backend/spec/requests/mcp_page_tools_spec.rb:174`.
- **BP-28** The editor keeps social items first in the stored order ("Social icons are always drawn in their own row"), and when a button is added from a section it is created at the end and then moved with a reorder call. These are frontend conventions; the API accepts any permutation. — `frontend/app/routes/pages/components/page-content-editor.tsx:139-146,159-176`.

### Themes and custom colors

- **BP-29** `theme` must be one of the six presets; the default is `default`. The same list validates `PageTemplate#theme` and `Form#theme`. — `backend/app/models/page.rb:30,88`, `backend/app/models/page_template.rb:47`, `backend/app/models/form.rb:26`; tests `backend/spec/requests/api/me/pages_spec.rb:78,85`.
- **BP-30** `custom_colors` is either `null` or exactly the keys `background`, `text` and `accent`, each `#` plus six hex digits. Values are lowercased on assignment. Anything else (3-digit hex, names, `url(...)`, a missing or extra key) is rejected by the model. Sending `null` clears it. — `backend/app/models/concerns/custom_colors.rb:4-5,15,21-26`; tests `backend/spec/models/custom_colors_spec.rb:12`, `backend/spec/requests/api/me/color_palettes_spec.rb:50`, `backend/spec/requests/mcp_page_tools_spec.rb:159`.
- **BP-31** When `custom_colors` is present the frontend renders it and ignores `theme`; `theme` stays stored. The theme picker clears the colors when a preset is chosen. The text/background contrast is only warned about in the editor (ratio below 4.5) and never enforced by the backend. — `frontend/app/modules/bio-page/themes.ts:132-137`, `frontend/app/modules/bio-page/theme-picker.tsx:83,101-105`. Presets were picked "to keep text and buttons readable (WCAG AA contrast)" (comment, `themes.ts:16-18`).
- **BP-32** Each user can save up to 20 palettes (`ColorPalette::MAX_PER_USER`); a palette needs a name of at most 40 characters and valid custom colors. Palettes are private (list, create, delete only for the owner), are not tied to a page, and have no update endpoint. They are not part of the account data export. — `backend/app/models/color_palette.rb:4-16`, `backend/app/contracts/color_palette_contract.rb`, `backend/app/controllers/api/me/color_palettes_controller.rb`; tests `backend/spec/requests/api/me/color_palettes_spec.rb:16,29,41`. Added by #84 (`dd7ab38`) together with forms colors.

### Templates

- **BP-33** There are six built-in templates: `creator` (theme sunset, 8 items), `business` (paper, 8), `professional` (midnight, 5), `musician` (ocean, 9), `sponsors` (default, 10) and `blank` (default, 0). Their buttons and social icons are created inactive (`active: false`) with placeholder or example-handle URLs, so nothing fake goes live until the owner fills it in; section headers are active. Names and labels are English strings in the backend. — `backend/app/services/built_in_page_templates.rb:1-118`; tests `backend/spec/requests/api/me/page_templates_spec.rb:16,24,35`.
- **BP-34** Applying a template (`POST /api/me/pages/:page_id/apply_template {template}`, or `template` on `POST /api/me/pages`) runs in one transaction: it destroys all existing items of the page, creates the template's items at positions 1..n, sets the page `theme` and sets `custom_colors` to `null`. It does not touch slug, title, bio, avatar, `published` or `expires_at`. Because the old items are destroyed, their click rows and `clicks_count` are deleted with them (`PageLink has_many :page_link_clicks, dependent: :delete_all`). The API does not require the page to be a draft and does not ask for confirmation (the dashboard confirms when the page already has items). — `backend/app/services/apply_page_template.rb:5-21`, `backend/app/models/page_link.rb:75`, `frontend/app/routes/pages/components/template-gallery.tsx:560,638`; tests `backend/spec/requests/api/me/page_templates_spec.rb:43,54`.
- **BP-35** An unknown template id is 404 and the page is untouched. If a stored item turns out to be invalid when applied, `create!` raises and the whole transaction rolls back: `apply_template` answers 422 `{"message":"Resource is invalid","details":[...]}` through the global handler, `POST /api/me/pages` answers 422 `{errors: []}` built from the page's (empty) errors. — `backend/app/controllers/api/me/page_templates_controller.rb`, `backend/app/controllers/concerns/page_template_lookup.rb:14-25`, `backend/app/controllers/api/me/pages_controller.rb:64-66`, `backend/app/controllers/application_controller.rb:57`.
- **BP-36** A user saves one of their own pages as a private template with `POST /api/me/page_templates {name, page_id}`. The snapshot holds the page's items in page order (`kind, label, url, icon, active`, URLs included) and its `theme`; it does not hold custom colors, title, bio or avatar. A user keeps at most 20 templates (private and public together); `name` is required and at most 60 characters; `items` must be an array of at most 50 hashes (item contents are not validated at save time). — `backend/app/models/page_template.rb:33,34,45-50,58-65,133-143`, `backend/app/contracts/page_template_contract.rb`; tests `backend/spec/requests/api/me/page_templates_spec.rb:63,96`.
- **BP-37** Templates are listed by `GET /api/me/page_templates`: built-ins first, then the caller's own newest first, never anyone else's. Own templates are returned with originals (`items`) and the public version (`public_items`). A user can delete only their own (`DELETE .../custom-<id>`); pages created from it keep their copies. — `backend/app/controllers/api/me/page_templates_controller.rb:18-23,62-63`; tests `backend/spec/requests/api/me/page_templates_spec.rb:81,104`.
- **BP-38** Publishing to the Community (`PATCH /api/me/page_templates/custom-<id> {visibility:"public", author_page_id, description}`): the author page must be one of the caller's own pages that is currently visible (published, not expired, owner active), otherwise 404; `author_page_id` is required to publish; `description` is at most 140 characters; name and description must not contain a URL-like text (`http(s)://`, `www.`, or a name ending in `.com .net .org .io .ly .me .co .br .pt .link .xyz .app .site .gg .to .tv`), otherwise 422. Publishing stores `author_label` (`"Title · @slug"`, or `"@slug"` without title) and `published_at = now`. The author's e-mail is never exposed. — `backend/app/controllers/api/me/page_templates_controller.rb:40-58`, `backend/app/models/page_template.rb:36-40,67-84,145-148`, `backend/app/contracts/page_template_publish_contract.rb`; tests `backend/spec/requests/api/me/page_templates_publish_spec.rb:38,47,88,102,112`.
- **BP-39** What others get is derived on every read by `PageTemplate#public_items` and never stored: a `social` item keeps only its network (name, example URL, inactive); a `header` becomes `Section n`; a `link` becomes `Link n` (or `<Network> link` when it had a known icon) with the placeholder URL, inactive. The theme is kept, so the layout and look are shared but no text or URL of the author is. Items whose `social` icon is unknown are dropped. — `backend/app/models/page_template.rb:90-110`; tests `backend/spec/requests/api/me/page_templates_publish_spec.rb:55,67`. Rationale: "none of the author's texts or links… the originals never leave the server in a public response" (comment); "Public text must not smuggle links into the Community gallery" (comment on `URL_LIKE`).
- **BP-40** Unpublishing (`visibility: "private"`) removes the template from the gallery at once; pages already created from it keep their copies. It does not clear `hidden_at`, `reports_count` or the reports, so a hidden template that is unpublished and published again stays hidden. — `backend/app/models/page_template.rb:86-88`; test `backend/spec/requests/api/me/page_templates_publish_spec.rb:79`. The `page_template_publish` limit (5 per day per user) is attached to the whole `update` action, so unpublishing consumes it too.
- **BP-41** The Community gallery (`GET /api/me/community_templates?page&per_page&sort`) lists `visibility = public AND hidden_at IS NULL`, `sort=popular` (default: `uses_count` desc, `published_at` desc) or `sort=new` (`published_at` desc, `id` desc), `per_page` default 12 and clamped to 1..48, `page` at least 1. Items are always the placeholder version. Each entry has `mine` (true for the caller's own templates) and `author {label, slug}`, where `slug` is null unless the author page is currently visible. — `backend/app/controllers/api/me/community_templates_controller.rb:15-33`, `backend/app/controllers/concerns/page_template_lookup.rb:52-80`; tests `backend/spec/requests/api/me/community_templates_spec.rb:37,55`.
- **BP-42** Using a Community template (id `community-<id>`) behaves like a built-in one but with placeholder items; it is a copy, so later edits, hiding or unpublishing of the template do not touch pages already created. Hidden or private templates cannot be used (404). `uses_count` is incremented by one when another user creates a page from it or applies it; the author's own uses and built-in/own templates are not counted. — `backend/app/controllers/concerns/page_template_lookup.rb:14-33`; tests `backend/spec/requests/api/me/community_templates_spec.rb:72,86,100,110`.
- **BP-43** Reporting (`POST /api/me/community_templates/:id/report {reason}`): `reason` is one of `spam offensive impersonation other`; one report per user per template (second one: 422 "User already reported this template"); the author cannot report their own template (422); only listed templates can be reported (hidden or private: 404). The third report sets `hidden_at`; reports are limited to 20 per hour per user. — `backend/app/models/page_template_report.rb:24-37`, `backend/app/models/page_template.rb:36,112-120`, `backend/app/controllers/api/me/community_templates_controller.rb:8-45`; tests `backend/spec/requests/api/me/community_templates_spec.rb:121,140,159`.
- **BP-44** Moderation (admins only, `PageTemplatePolicy#moderate?`): `GET /api/admin/page_templates?status=reported|hidden|public` (public templates only, max 200, originals included) and `POST .../:id/toggle_hidden`. Hiding sets `hidden_at`; unhiding clears `hidden_at`, resets `reports_count` to 0 and deletes the reports ("the template starts over"). The screens belong to [admin-and-moderation](admin-and-moderation.md). — `backend/app/controllers/api/admin/page_templates_controller.rb:8-33`, `backend/app/models/page_template.rb:122-129`, `backend/app/policies/page_template_policy.rb:2`; tests `backend/spec/requests/api/me/community_templates_spec.rb:169,179`.
- **BP-45** The owner of a template always sees it with `hidden: true` while moderated and keeps `visibility: "public"`; nothing notifies the owner. — `backend/app/controllers/concerns/page_template_lookup.rb:36-50`. Not recorded: whether a notification is intended.

### Link safety (Safe Browsing)

- **BP-46** Provider: Google Safe Browsing v4 `threatMatches:find`, threat types `MALWARE` and `SOCIAL_ENGINEERING`, platform `WINDOWS`, entry type `URL`, up to 500 URLs per request, key from `GOOGLE_SAFE_LINK_KEY`. — `backend/lib/google_lib.rb:9,21-56`.
- **BP-47** The whole feature is on only when `ENABLE_GOOGLE_SAFE_LINK` is non-empty. An `after_commit` on create and update, when `url` changed and is present, enqueues `PageLinkSafetyJob.perform_later([id])` on queue `safety`. A header never has a URL and is never checked. — `backend/app/models/page_link.rb:84,105-107`; tests `backend/spec/requests/api/me/page_link_kinds_spec.rb:77`, `backend/spec/jobs/page_link_safety_job_spec.rb:27`. Rationale: "a link approved once can later be swapped for something malicious" (comment, `page_link.rb:81-83`).
- **BP-48** `PageLinkSafetyJob` sets `safe = false` and `safe_checked_at = now` on the URLs Safe Browsing returns (exact string match against the stored URL) and `safe = true` plus `safe_checked_at` on the rest. A failed API call raises `GoogleLib::SafeBrowsing::V4::Services::Error`, which is retried (`wait: :polynomially_longer`, 3 attempts) and leaves the links as they were: "Hiding every link on a transient API error would take down pages that did nothing wrong." — `backend/app/jobs/page_link_safety_job.rb:7-20`, `backend/lib/google_lib.rb:21-30`; tests `backend/spec/jobs/page_link_safety_job_spec.rb:8,19,51,66`.
- **BP-49** `RecheckPageLinksSafetyJob` runs daily at 4am on queue `safety`, selects every link with a URL whose `safe_checked_at` is null or older than 1 day (no filter on page state: drafts, expired and deleted pages included) and enqueues one `PageLinkSafetyJob` per 500 ids. It returns at once when `ENABLE_GOOGLE_SAFE_LINK` is blank. — `backend/app/jobs/recheck_page_links_safety_job.rb:6-17`, `backend/config/recurring.yml:48-51`; test `backend/spec/jobs/page_link_safety_job_spec.rb:36`.
- **BP-50** What an unsafe link does: `safe: false` links are filtered out of the public JSON, cannot be clicked (the click endpoint 404s them), and are shown to the owner in the editor with a red ring and a warning icon (`pc_flagged`). They stay in the owner's list, statistics and template snapshots. The owner cannot clear the flag; it changes only when the URL is edited and the next check returns it clean, or at the next recheck. There is no notification to the owner. — `backend/app/serializers/public_page_serializer.rb:11`, `backend/app/models/page_link.rb:55-56`, `frontend/app/routes/pages/components/page-content-editor.tsx:571-600`; test `backend/spec/requests/api/public/pages_spec.rb:31`.
- **BP-51** A new link is `safe: true` by default and is public until the first check finishes. Editing the URL of a link does not reset `safe` before the job runs: a flagged link stays hidden until a clean result, a safe link stays visible until a bad one. — `backend/db/schema.rb:398`, `backend/app/models/page_link.rb:84`.
- **BP-52** The page link check is separate from the shortlink check (`SafetyUrlJob`, see [shortlinks](shortlinks.md)). `DetectPageAbuseJob` (hourly at minute 40) raises `abuse_signals` for several new accounts publishing the same text or links; it never changes a page. Heuristics and the admin screen: [admin-and-moderation](admin-and-moderation.md). The page owner sees nothing of it. — `backend/app/jobs/detect_page_abuse_job.rb`, `backend/config/recurring.yml:52-55`.

### Avatars

- **BP-53** `POST /api/me/pages/:page_id/avatar` (multipart field `avatar`) accepts PNG, JPEG, WebP, HEIC and HEIF, identified by magic bytes only; the declared Content-Type and filename are ignored (an SVG renamed to `.png` is refused with "must be a PNG, JPEG, WebP or HEIC image"). HEIC brands: `heic heix heim heis hevc hevx`; HEIF brands: `mif1 msf1`. — `backend/app/services/image_upload.rb:4-28`, `backend/app/services/avatar_upload.rb:13-22`; tests `backend/spec/requests/api/me/pages_avatar_spec.rb:54,61`.
- **BP-54** Size limit 50 MB (`Page::AVATAR_MAX_SIZE`; error "must be at most 50MB"). Dimension limits, read from the header before anything is stored: at most 12 000 px per side and 100 megapixels (`AVATAR_MAX_PIXELS`), else "must be at most 12000px per side and 100 megapixels"; unreadable files give "could not be read as an image". Errors come back as 422 `{errors: {avatar: [message]}}`. The frontend refuses files over 50 MB before uploading. — `backend/app/models/page.rb:34-39`, `backend/app/services/avatar_upload.rb:26-35`, `frontend/app/routes/pages/$id.tsx:361-363`; tests `backend/spec/requests/api/me/pages_avatar_spec.rb:82,97,105`. Rationale: "Full-resolution phone photos (a 48MP HEIC can pass 40MB) are accepted and shrunk in the background"; the header check stops a decompression bomb (comments).
- **BP-55** The raw file is attached as `avatar_upload` (filename `avatar-upload`, sniffed content type) and `OptimizeAvatarJob.perform_later(page_id, blob_id)` is enqueued on queue `images`; the endpoint answers 202 with `avatar_processing: true`. The previous avatar stays visible meanwhile. A new upload replaces a pending one and the old job becomes a no-op because `current_upload?` compares blob ids. — `backend/app/controllers/api/me/pages_controller.rb:97-118`, `backend/app/jobs/optimize_avatar_job.rb:21-49`; tests `backend/spec/requests/api/me/pages_avatar_spec.rb:20,31`, `backend/spec/jobs/optimize_avatar_job_spec.rb:59`.
- **BP-56** `OptimizeAvatarJob` resizes to fit 1024 x 1024 (no upscaling), autorotates from EXIF, strips all metadata (GPS included), converts to WebP at quality 85 with `fail: true` (a truncated file raises), attaches it as `avatar` under `page.with_lock`, purges the raw upload and renders the `thumb` variant (400 x 400 `resize_to_fill`, WebP) up front. Visitors only get the thumb, through Rails (`rails_storage_proxy_url`, never a bucket redirect), so the storage gateway is not public and the URL does not expire. A corrupt file (`Vips::Error`) is logged, the upload is dropped, the previous avatar is kept and the owner gets no error (`avatar_processing` just turns false). A missing blob discards the job. — `backend/app/jobs/optimize_avatar_job.rb:11-64`, `backend/app/models/page.rb:41,97-128`; tests `backend/spec/jobs/optimize_avatar_job_spec.rb:21,33,41,49,70,78`.
- **BP-57** `OptimizeAvatarJob` runs on the `images` queue, which has a single worker thread in a single process (at most one decode at a time across the cluster), and `limits_concurrency to: 1` per user (key: the page's `user_id`, 5 minutes) so a user cannot queue several uploads ahead of everyone else. The decode runs in-process with libvips (`Vips.block_untrusted`, no cache, concurrency 2), not in the `imgproc` sandbox. — `backend/app/jobs/optimize_avatar_job.rb:11-16`, `backend/config/queue.yml:6-8,34-39`, `backend/config/initializers/vips.rb`.
- **BP-58** Upload rate limits (`POST .../avatar`, 429 `{errors:{avatar:["too many uploads, please try again later"]}}`): 5 per 10 minutes and 20 per day per user, 20 per hour per client IP. "Puma has already read the body by now, so these protect storage and the image queue rather than bandwidth." — `backend/app/controllers/api/me/pages_controller.rb:17-38`; test `backend/spec/requests/api/me/pages_avatar_spec.rb:111`.
- **BP-59** `DELETE .../avatar` purges (later) both the raw upload and the avatar and answers 204. `CleanupStaleAvatarUploadsJob` runs every 15 minutes and purges every `avatar_upload` attachment of any `Page` created more than 1 hour ago (job lost or worker down); the page keeps its previous avatar and leaves the "processing" state. The editor polls every 2 s up to 60 times (about 2 minutes), then shows a "stalled" message. Storage is Active Storage: service `seaweedfs` (S3) when `S3_BUCKET` is set, else local disk. — `backend/app/controllers/api/me/pages_controller.rb:120-125`, `backend/app/jobs/cleanup_stale_avatar_uploads_job.rb:4-15`, `backend/config/recurring.yml:44-47`, `backend/config/environments/production.rb:24`, `frontend/app/routes/pages/$id.tsx:367-402`; tests `backend/spec/requests/api/me/pages_avatar_spec.rb:133`, `backend/spec/jobs/cleanup_stale_avatar_uploads_job_spec.rb:8`.

### Clicks and statistics

- **BP-60** `POST /api/public/pages/:slug/links/:page_link_id/click` works only for a visible page and a link that is `active`, `safe` and not a header (`PageLink.visible.clickable`); otherwise 404. Success is 204 with no body. The browser sends it with `fetch(..., {keepalive: true})` from the public page and ignores failures. — `backend/app/controllers/api/public/page_link_clicks_controller.rb:15-23`, `frontend/packages/core/actions/track-page-link-click/track-page-link-click.service.ts`; tests `backend/spec/requests/api/public/page_link_clicks_spec.rb:43,51`, `backend/spec/requests/api/me/page_link_kinds_spec.rb:65`.
- **BP-61** A click stores: `clicked_at`, `ip_address` (client IP, see below), `user_agent` (first 255 chars), `referer` (the `referer` field of the JSON body, which is the browser's `document.referrer`, first 255 chars, empty becomes null, not validated as a URL), `country_code` (header `CF-IPCountry` uppercased, `XX` and `T1` become null), `region` (header `CF-Region`), `platform` and `browser` parsed from the user agent (`UserAgentParser`, same buckets as the edge function). No third party is called (the old region lookup against ip-api.com was removed in #82, `409fc06`). — `backend/app/controllers/api/public/page_link_clicks_controller.rb:34-52`, `backend/app/services/user_agent_parser.rb`; test `backend/spec/requests/api/public/page_link_clicks_spec.rb:18`.
- **BP-62** The client IP is, in order: `X-Visitor-Ip` when `X-Ssr-Secret` matches `SSR_FORWARD_SECRET` (the SSR server forwarding the visitor), else `CF-Connecting-IP`, else the socket address; values must parse as IP addresses. — `backend/app/controllers/concerns/client_ip.rb:6-26`; test `backend/spec/requests/client_ip_spec.rb`.
- **BP-63** Deduplication: the same IP on the same link within 10 seconds counts once (`Rails.cache.write(..., unless_exist: true)`). Rate limit: 30 clicks per minute per IP across all pages (429 with an empty body). Clicks are written synchronously, with no queue, "nothing waits on this request, so a queue would add a moving part without removing any latency" (comment); this differs from shortlink clicks (see [shortlinks](shortlinks.md)). — `backend/app/controllers/api/public/page_link_clicks_controller.rb:1-13,27-32`; test `backend/spec/requests/api/public/page_link_clicks_spec.rb:59` (skipped without `REDIS_URL`).
- **BP-64** Retention: `PurgeOldIpAddressesJob` (daily 04:15) sets `ip_address`, `user_agent` and `referer` to null on clicks older than 90 days. Country, region, platform, browser, timestamp and the link's `clicks_count` are kept until the link, page or account is deleted. — `backend/app/jobs/purge_old_ip_addresses_job.rb:4-19`, `backend/config/recurring.yml:28-31`; test `backend/spec/jobs/purge_old_ip_addresses_job_spec.rb`.
- **BP-65** Statistics (`GET /api/me/pages/:page_id/statistics?days=7|30|90`, owner only; also MCP `get_page_statistics`): any other `days` falls back to 30. Days are UTC; the window starts at the beginning of the UTC day `days - 1` days ago. The response has `period_days`, `total_clicks` (sum of `clicks_count`, all time), `period_clicks`, `timeline` (one entry per day including days with 0), `links` (all non-header items, sorted by period clicks then total clicks), and the rankings `sources`, `devices` (platform), `browsers` and `countries`. Rankings show the top 8 and fold the rest into `Other`; null values become `Unknown`. — `backend/app/services/pages/statistics_service.rb:10-99`; tests `backend/spec/requests/api/me/pages_statistics_spec.rb:32,49,61,68`.
- **BP-66** `sources` come from `TrafficSource`: the in-app browser named in the user agent (Instagram, TikTok, Facebook, LinkedIn, Snapchat, X, WhatsApp) wins, then the host of the referer (adds YouTube, Google, Kurz), `Direct` without a referer and `Other` for an unknown host. `browsers` shows `"<App> app"` for in-app browsers. Statistics include inactive and flagged links. — `backend/app/services/traffic_source.rb:7-61`, `backend/app/services/pages/statistics_service.rb:69-86`.
- **BP-67** The MCP statistics tool returns the same aggregates and never a visitor string. — `backend/app/services/mcp/tools/get_page_statistics.rb`; test `backend/spec/requests/mcp_page_tools_spec.rb:222`.

### QR code

- **BP-68** `GET /api/me/pages/:page_id/qr_code` returns an SVG of `Page#public_url` (`FRONTEND_URL` + `/u/` + slug), error correction level M, black modules on a white background whatever the theme ("low-contrast QR codes fail on cheaper phone cameras"), inline, with a script-blocking CSP. Only the owner can fetch it, also for unpublished pages. The code embeds the slug, so a slug rename (BP-05) invalidates printed codes. — `backend/app/controllers/api/me/pages_controller.rb:132-136`, `backend/app/services/qr_code_service.rb`, `backend/app/models/page.rb:108-110`; test `backend/spec/requests/api/me/qr_codes_spec.rb:22`. The dashboard opens it in a modal with a download named `kurz-<slug>.svg` (`frontend/app/routes/pages/$id.tsx:233-240`).

### Deletion

- **BP-69** `DELETE /api/me/pages/:id` is a soft delete (`deleted_at = now`; `Page` has a default scope hiding deleted rows). The slug stays reserved (BP-04), items, clicks and avatar files are kept, the public URL answers 404, and no endpoint restores or lists deleted pages. `deleted_at` is excluded from the audit trail. — `backend/app/models/page.rb:69,74,104-106`, `backend/app/controllers/api/me/pages_controller.rb:91-95`; tests `backend/spec/requests/api/me/pages_spec.rb:113`, `backend/spec/requests/api/public/pages_spec.rb:56`.
- **BP-70** Individual items are hard-deleted (`DELETE .../links/:id`); their clicks go with them (cascade at database and model level). Own templates and palettes are hard-deleted. — `backend/app/controllers/api/me/page_links_controller.rb:29-33`, `backend/db/schema.rb:699`.
- **BP-71** Hard deletion of pages happens only when the account is purged (30 days after the deletion request, `User::DELETION_GRACE`): `User#purge!` destroys `Page.with_deleted` rows (items, clicks, attachments), the user's templates, reports and palettes, and removes the page audits. A template published from a deleted-then-purged page keeps its `author_label` and loses the link (`author_page_id` set to null). Pages, templates (with originals) and links (with click counts, not click rows) are included in the account data export; palettes and avatars are not. See [accounts-and-auth](accounts-and-auth.md). — `backend/app/models/user.rb:37,66-70,129-150`, `backend/app/services/users/data_export.rb:64-76,122`; tests `backend/spec/requests/account_deletion_spec.rb:146-173`, `backend/spec/requests/data_export_spec.rb:67`.

### MCP access (summary; details in [mcp-and-oauth](mcp-and-oauth.md))

- **BP-72** Scopes: `pages:read` (`list_pages`, `get_page`, `list_page_templates`, `get_page_statistics`), `pages:write` (`create_page`, `update_page`, `add_page_link`, `update_page_link`, `remove_page_link`, `reorder_page_links`, `apply_page_template`), `pages:publish` (`publish_page`, `unpublish_page`) and `account:full` (`delete_page`, which needs the exact slug as `confirm`). — `backend/app/services/mcp/tools/*page*.rb` (`requires` lines); tests `backend/spec/requests/mcp_page_tools_spec.rb:142,235`, `backend/spec/requests/mcp_full_tools_spec.rb:64`.
- **BP-73** `create_page` always creates an unpublished draft, rejects `published`, `expires_at` and unknown keys, accepts built-in and own templates (not `community-` ones), and is limited to 10 per hour and 50 per day per user. `delete_page` is limited to 10 per hour and 30 per day, `publish_page` to 20 per hour and 100 per day, `unpublish_page` to 30 per hour. — `backend/app/services/mcp/tools/create_page.rb:20`, `backend/app/services/mcp/tools/page_tool_helpers.rb:39-49`; tests `backend/spec/requests/mcp_page_tools_spec.rb:42,52,80,89`.
- **BP-74** A published page cannot be edited through MCP without full access: link tools and `apply_page_template` answer `page_published`; `update_page` accepts only `theme` and `custom_colors` on a published page. `account:full` lifts the limit. MCP cannot set `expires_at` or `published` through `create_page`/`update_page`, and `apply_page_template` through MCP does not count Community uses (it cannot use Community templates). All text returned is cleaned (`Mcp::Content.clean`). — `backend/app/services/mcp/guards.rb:9-14,39-44`, `backend/app/services/mcp/tools/page_tool_helpers.rb`; test `backend/spec/requests/mcp_page_tools_spec.rb:123`.

## Flows

1. **Create a page (dashboard).** `POST /api/me/pages {slug, display_title?, template?}` -> `PageContract` -> template lookup (`PageTemplateLookup#find_template`) -> `Page.transaction { page.save!; ApplyPageTemplate }` -> `count_template_use` (Community only) -> 201 with links. The page is published immediately (BP-08). Validation failures: 422 (contract errors as a hash, model errors as an array).
2. **Edit content.** The editor (`routes/pages/$id.tsx`) saves the page card with `PATCH /api/me/pages/:id` (always sends slug, title, bio, theme, custom colors, published and `expires_at`). Items are edited in the phone preview with `POST/PATCH/DELETE .../links` and `PATCH .../links/reorder`. A changed URL enqueues `PageLinkSafetyJob` after commit when safety is enabled.
3. **Visitor opens `/u/:slug`.** The SSR loader calls `GET /api/public/pages/:slug` (120 per minute per IP, using the forwarded visitor IP) -> 404 page with "This page does not exist or is no longer available." or the rendered page. The route sets `frame-ancestors 'none'` and `X-Frame-Options: DENY`, adds the canonical URL and Open Graph tags (avatar as `og:image`, otherwise the Kurz preview image), and adds a footer "Made with Kurz" plus a "Report" link to `/report?page=<slug>`. — `frontend/app/routes/bio/$username.tsx:8-51`, `frontend/app/modules/bio-page/bio-page-view.tsx:174-191`.
4. **Visitor clicks a link.** The browser POSTs the click (BP-60..63) and follows the link; `rel="noopener noreferrer nofollow"`.
5. **Upload an avatar.** Validate -> attach raw -> enqueue `OptimizeAvatarJob` (queue `images`) -> 202. The job swaps the avatar in and renders the thumb; the editor polls the page until `avatar_processing` is false. `CleanupStaleAvatarUploadsJob` is the safety net.
6. **Save and publish a template.** Save: `POST /api/me/page_templates` (private). Publish: `PATCH .../custom-<id>` (author page, description) -> gallery. Others use it with `community-<id>`; three reports hide it; an admin unhides or leaves it hidden.
7. **Link safety.** Save/URL change -> job on `safety` -> Safe Browsing -> `safe` flag. Daily 4am recheck of anything not checked for a day.
8. **Statistics.** The stats screen (`routes/pages/stats.tsx`) calls `GET .../statistics?days=` with a 7/30/90 selector.

## States and transitions

Page visibility (derived from `published`, `expires_at`, `deleted_at` and the owner):

| From | Event | To | Guard | Side effects |
|---|---|---|---|---|
| (new) | `POST /api/me/pages` | published | `published` default true (dashboard) | Public at once |
| (new) | MCP `create_page` | draft | always `published: false` | None |
| draft | PATCH `published: true` / MCP `publish_page` | published | needs `pages:publish` for MCP | None |
| published | PATCH `published: false` / MCP `unpublish_page` | draft | none | Items and stats kept |
| published | `expires_at` passes | expired (still `published: true`) | none | Public 404; clicks 404 |
| expired | PATCH `expires_at` null or future | published | new value must be in the future | Public again |
| any | owner deactivated | hidden | `deactivated_at` set | Back when reactivated |
| any | DELETE | deleted | none | Slug stays reserved; 404 |

Page link safety (`safe`, `safe_checked_at`):

| From | Event | To | Guard | Side effects |
|---|---|---|---|---|
| safe (default, unchecked) | `PageLinkSafetyJob` flags URL | unsafe | `ENABLE_GOOGLE_SAFE_LINK` set | Hidden publicly, clicks 404, `safe_checked_at` set, warning logged |
| safe | job returns clean | safe | none | `safe_checked_at` set |
| unsafe | job returns clean (after URL edit or recheck) | safe | none | Visible again |
| any | Safe Browsing request fails | unchanged | after 3 attempts the job fails | Next daily recheck retries |

Template (`visibility`, `hidden_at`):

| From | Event | To | Guard | Side effects |
|---|---|---|---|---|
| private | `publish!` | public | visible own author page, no links in name/description, 5 per day | `author_label`, `published_at` set |
| public | `unpublish!` | private | none | Leaves the gallery; `hidden_at` and reports kept |
| public, listed | third distinct report | public, hidden | `reports_count >= 3` and `hidden_at` nil | Leaves the gallery |
| public, listed | admin toggle | public, hidden | admin | `hidden_at` set |
| hidden | admin toggle | public, listed | admin | `hidden_at` null, `reports_count` 0, reports deleted |

Avatar: `none` -> (upload) `processing` (raw `avatar_upload` attached) -> (job ok) `ready`; `processing` -> (corrupt, replaced, removed or 1 hour stale) back to the previous state; any -> (DELETE avatar) `none`.

## Limits and configuration

| Name | Value | Where | Notes |
|---|---|---|---|
| Slug length / charset | 3-30, `[a-z0-9_.-]`, alnum at both ends | `page.rb:42` | Model and frontend only |
| Reserved slugs | 19 words | `page.rb:44` | See BP-03 |
| Pages per user | unlimited | | Create limited to 10/hour (`pages_controller.rb:10`) |
| `display_title` / `bio` | 80 / 300 characters | `page.rb:89-90` | Model only |
| Items per page | 50 (`PageLink::MAX_PER_PAGE`) | `page_link.rb:28` | Checked on create only |
| Item `label` / `url` | 80 / 2048 characters | `page_link.rb:63-64` | Model only (MCP schema repeats them) |
| Templates per user | 20 | `page_template.rb:33` | Private and public together |
| Template `name` / `description` | 60 / 140 characters | `page_template.rb:45-46` | Contract and model |
| Template items | at most 50 hashes | `page_template.rb:134` | Shape only |
| Palettes per user / name | 20 / 40 characters | `color_palette.rb:4,8` | |
| Reports to auto-hide | 3 | `page_template.rb:36` | One per user per template |
| `page_template_publish` | 5 per day per user | `page_templates_controller.rb:8` | Counts unpublish too |
| `community_template_report` | 20 per hour per user | `community_templates_controller.rb:8` | |
| Community page size | 12 default, 1..48 | `community_templates_controller.rb:18` | |
| `pages_create` | 10 per hour per user | `pages_controller.rb:10` | |
| Avatar upload | 5 per 10 min and 20 per day per user; 20 per hour per IP | `pages_controller.rb:21-38` | 429 |
| Avatar size / pixels | 50 MB; 12 000 px per side; 100 MP | `page.rb:34-39` | Header check |
| Stored avatar / thumb | 1024 px max edge, WebP q85 / 400x400 WebP | `page.rb:41,98`, `optimize_avatar_job.rb:59-62` | |
| Stale raw upload | 1 hour, sweep every 15 min | `cleanup_stale_avatar_uploads_job.rb:7` | |
| `OptimizeAvatarJob` concurrency | 1 per user (5 min), 1 thread on `images` | `optimize_avatar_job.rb:14`, `queue.yml:36` | |
| `public_pages_show` | 120 per minute per IP | `api/public/pages_controller.rb:6` | 429 |
| `public_page_link_clicks` | 30 per minute per IP | `page_link_clicks_controller.rb:9` | 429, empty body |
| Click dedup | 10 s per link and IP | `page_link_clicks_controller.rb:7` | Needs the Rails cache (Valkey) |
| Click IP/UA/referer retention | 90 days | `purge_old_ip_addresses_job.rb:4` | Daily 04:15 |
| Statistics periods | 7, 30, 90 (default 30), top 8 | `statistics_service.rb:10-12` | UTC |
| Safe Browsing batch | 500 URLs | `google_lib.rb:10` | |
| Link recheck | daily 4am, older than 1 day | `recurring.yml:48`, `recheck_page_links_safety_job.rb:6` | |
| Account purge grace | 30 days | `user.rb:37` | |
| `ENABLE_GOOGLE_SAFE_LINK`, `GOOGLE_SAFE_LINK_KEY` | env, any non-empty value enables | `page_link.rb:106`, `google_lib.rb:34` | Not listed in `.ci/stack.yml` (see Drift) |
| `FRONTEND_URL` | base of `public_url` and QR | `page.rb:109` | |
| `SSR_FORWARD_SECRET` | trusts `X-Visitor-Ip` from SSR | `client_ip.rb:15` | |
| `IMGPROC_URL`, `S3_BUCKET` | imgproc address; picks `seaweedfs` storage | `imgproc.rb:13`, `production.rb:24` | Imgproc is not used by bio pages |

The `backend/imgproc` sandbox (`backend/imgproc/app.rb`) is a separate Rack app (`POST /convert`, `GET /up`): PNG/JPEG/WebP/HEIF by magic bytes, at most 10 MB, 10 000 px per side, 50 MP, output WebP with the longest side capped at 4096 and metadata stripped; the Rails client `Imgproc.convert` uses a 2 s open timeout and 25 s read timeout and maps 411/413/422 to `Rejected` and everything else to `Unavailable`. In this commit only the forms code calls it (`form_covers_controller.rb:33`, `form_uploads_controller.rb:30`); see [forms](forms.md). It was introduced by #74 (`433073f`), which also moved the magic-byte table into `ImageUpload` and made `AvatarUpload` delegate to it.

## Authorization and privacy

- **Anonymous**: can read `GET /api/public/pages/:slug` and post clicks. No authentication, no CSRF concern (JSON, no cookie use).
- **Owner**: every `/api/me/*` page endpoint loads pages through `PagePolicy::Scope` (`where(user: user)`), so another user's page, link, palette or template answers 404 (never 403). — `backend/app/policies/page_policy.rb`; tests `backend/spec/requests/api/me/pages_spec.rb:43,102`, `backend/spec/requests/api/me/page_links_spec.rb:30`.
- **Admin**: moderates Community templates (BP-44). Admins have no special read or write access to other users' pages in this domain (deactivation and abuse screens are in [admin-and-moderation](admin-and-moderation.md)).
- **MCP**: scopes in BP-72..74.
- **Personal data of visitors**: IP, user agent and referer for 90 days; country, region, platform and browser indefinitely (BP-61, BP-64). Visitors are not shown any notice on the page. Bio-page clicks are not subject to the shortlink analytics pipeline.
- **Personal data of owners**: page content is public by design. Avatar metadata (EXIF, GPS) is stripped (BP-56). The Community gallery shows only the `author_label` (title and slug) and a link to the author's page while it is public; the e-mail is never serialized (test `page_templates_publish_spec.rb:38`) except to admins (`owner_email` in the admin template list).
- **Clickjacking and XSS**: the bio route denies framing; text is rendered as React text; `href` only for `http(s)`; custom colors only reach CSS variables after the `#RRGGBB` check. Security spec: `backend/spec/requests/security/injection_spec.rb`.

## API and UI surface

Backend (routes at `backend/config/routes.rb:48,110-132`):

| Endpoint | Controller#action |
|---|---|
| `GET /api/public/pages/:slug` | `api/public/pages#show` |
| `POST /api/public/pages/:slug/links/:page_link_id/click` | `api/public/page_link_clicks#create` |
| `GET/POST /api/me/pages`, `GET/PATCH/PUT/DELETE /api/me/pages/:id` | `api/me/pages#index,create,show,update,destroy` |
| `POST /api/me/pages/:page_id/apply_template` | `api/me/pages#apply_template` |
| `POST/DELETE /api/me/pages/:page_id/avatar` | `api/me/pages#upload_avatar,destroy_avatar` |
| `GET /api/me/pages/:page_id/qr_code`, `.../statistics` | `api/me/pages#qr_code,statistics` |
| `POST /api/me/pages/:page_id/links`, `PATCH/PUT/DELETE .../links/:id`, `PATCH .../links/reorder` | `api/me/page_links#create,update,destroy,reorder` |
| `GET/POST /api/me/page_templates`, `PATCH/PUT/DELETE /api/me/page_templates/:id` | `api/me/page_templates#index,create,update,destroy` |
| `GET /api/me/community_templates`, `POST .../:id/report` | `api/me/community_templates#index,report` |
| `GET/POST /api/me/color_palettes`, `DELETE .../:id` | `api/me/color_palettes#index,create,destroy` |
| `GET /api/admin/page_templates`, `POST .../:id/toggle_hidden` | `api/admin/page_templates#index,toggle_hidden` |

Error shapes: contract failures are 422 `{errors: {field: [...]}}`; model failures from these controllers are 422 `{errors: ["Full message", ...]}`; unhandled invalid records are 422 `{message, details}`; unknown or foreign ids are 404 `{message: "Resource not found"}`. Authorization matrix: `.ci/security/matrix.tsv:93-110`.

MCP tools: see BP-72..74 (`backend/app/services/mcp/tools/`).

Frontend routes: `/u/:username` (`routes/bio/$username.tsx`, layout `layout/bio-layout.tsx` without site header or footer, SSR), `/app/pages` (list and create, `ssr = false`), `/app/pages/:id` (editor with phone preview, theme picker, avatar, template gallery, QR modal), `/app/pages/:id/stats`, `/report?page=<slug>` (prerendered report page). Modules: `modules/bio-page` (`bio-page-view`, `themes` with `BIO_THEMES`, `social-networks`, `theme-picker`, `bio-showcase` and `illustrated-avatar` for the homepage demo, which uses inline SVG data URIs and no network request). Admin screen: `routes/admin/moderation/templates.tsx`. Texts: `frontend/app/i18n/{en,pt-PT}/pages.json` and `templates.json`.

Jobs:

| Job | Queue | Schedule |
|---|---|---|
| `PageLinkSafetyJob` | `safety` | on URL change, and from the recheck |
| `RecheckPageLinksSafetyJob` | `safety` | daily at 4am |
| `OptimizeAvatarJob` | `images` | on avatar upload |
| `CleanupStaleAvatarUploadsJob` | `default` | every 15 minutes |
| `PurgeOldIpAddressesJob` (clicks part) | `default` | daily at 4:15am |
| `DetectPageAbuseJob` | `default` | hourly at minute 40 |

Full schedule: [platform-and-operations](platform-and-operations.md).

## Decisions

### D-BP-01 Click writes are synchronous
**Decision.** Bio-page clicks are written in the request, not through the edge function, RabbitMQ and the analytics worker used by short links. **Why.** "Nothing waits on this request, so a queue would add a moving part without removing any latency from the user" (code comment, commit `5a12219`/`7298ecc`, no PR). **Consequence.** Click volume is bounded by the 30 per minute per IP limit and the DB write cost sits on the web service.

### D-BP-02 Avatars are accepted large and shrunk in the background
**Decision.** Up to 50 MB and 100 MP are accepted, stored raw, and converted by `OptimizeAvatarJob` on a one-thread queue; only a small WebP is served, through Rails. **Why.** Phone photos exceed 40 MB; the header check stops decompression bombs; one decode at a time protects the jobs container; proxy mode keeps the S3 gateway private and URLs stable (code comments in `page.rb`, `optimize_avatar_job.rb`, `storage.yml`; commit `6e4b4ce`). **Consequence.** Upload is eventual (202, polling, stale cleanup) and errors in the job are silent to the owner.

### D-BP-03 Community templates share structure, never content
**Decision.** Public templates are derived into placeholders on every read, and public name/description may not contain links. **Why.** Originals must not leave the server and the gallery must not become a spam channel (comments in `page_template.rb`, commit `6e4b4ce`). **Consequence.** A Community template cannot carry copy or URLs; moderation is report-driven (3 reports) plus admin review; an extra rate limit (5 publishes per day) limits flooding.

### D-BP-04 Link safety fails open
**Decision.** A failed Safe Browsing request leaves links unchanged and retries later; new links are safe until checked. **Why.** "Hiding every link on a transient API error would take down pages that did nothing wrong" (comment). **Consequence.** A malicious URL is public until the first job finishes, and everything stays visible if the check is not enabled (see Drift).

### D-BP-05 Pages edited by MCP are drafts
**Decision.** MCP creates only drafts and edits only drafts (theme and colors excepted) unless the grant has full access. **Why.** See [docs/mcp.md](../docs/mcp.md) lines 15-18: publishing needs a separate scope that can never be combined with response-reading scopes, so untrusted text cannot steer what goes online (#62 `26e0896`). **Consequence.** The REST/dashboard path publishes on create while MCP does not.

### D-BP-06 Custom colors are free-form but strictly shaped
**Decision.** Besides six presets, users may set three `#RRGGBB` colors and save palettes; contrast is advised, not enforced. **Why.** Presets were chosen for WCAG AA contrast (comment in `themes.ts`); #84 (`dd7ab38`) added free colors shared with forms; not recorded why contrast is not enforced. **Consequence.** An unreadable page is possible; the strict shape check is what keeps CSS injection out.

## Change impact

- **Slug rules** (`SLUG_FORMAT`, `RESERVED_SLUGS`): also change `routes/pages/index.tsx:34`, `routes/pages/$id.tsx:72`, the `slug_rule` strings in `i18n/*/pages.json`, MCP `maxLength: 30` in `create_page.rb`/`update_page.rb`, and `mcp_page_tools_spec.rb:59`. Existing slugs must stay valid (the previous release keeps running on the new schema).
- **Add a theme**: `Page::THEMES` (also validates forms and templates), `frontend/packages/core/types/Page.ts` `PAGE_THEMES`, `BIO_THEMES` in `themes.ts`, the form theme code, MCP enums (derived from the constant), i18n names.
- **Add a network**: `PageLink::NETWORKS` (backend, drives `ICONS`, template placeholders and `DetectPageAbuseJob` placeholder list), `social-networks.tsx`, `HANDLE_KEYS` in the editor, `TrafficSource` if it is a traffic source, MCP enum.
- **Add a link kind or field**: `PageLink::KINDS`, both contracts, `PublicPageSerializer` (explicit list), `PageTemplate::ITEM_KEYS`, `public_items`, `ApplyPageTemplate` (copies fields explicitly), the MCP `LINK_FIELDS` and `link_json`, data export, `bio-page-view.tsx` and the editor. Stored template `items` JSON from older releases must keep applying.
- **Change `MAX_PER_PAGE`**: also template `items_shape`, MCP reorder `maxItems`.
- **Change what a template overwrites** (`ApplyPageTemplate`): it deletes click history of replaced items; check statistics expectations, the dashboard confirmation, MCP `apply_page_template` and the `custom_colors: nil` reset.
- **Change publishing defaults** (`published` default true): dashboard create flow, MCP assumptions (BP-08, BP-73) and `DetectPageAbuseJob`, which looks at pages created in the last 24 hours.
- **Change visibility (`Page.visible`)**: used by the public page, click endpoint, template author checks and Community author links. A new state must be added to all of them.
- **Change click storage**: `PurgeOldIpAddressesJob` target list, the partial index, data export, privacy page, statistics service columns, the MCP statistics tool, [shortlinks](shortlinks.md) if the two pipelines are ever unified.
- **Change safety**: `ENABLE_GOOGLE_SAFE_LINK`, `.ci/stack.yml` env, queue `safety` worker, `safe` semantics in `PageLink.visible`, `PublicPageSerializer`, the editor flag and shortlink `SafetyUrlJob` (separate code path, same Google client).
- **Change avatar pipeline**: `Page::AVATAR_*` constants, frontend `AVATAR_MAX_BYTES` and `accept`, `queue.yml` `images` worker, `Imgproc` if moved to the sandbox, `storage.yml` and proxy URL generation (`ActiveStorage::Current.url_options`), cleanup job age.
- **Soft delete**: deleted pages keep slugs reserved and files stored; any hard purge or slug release must handle templates' `author_page_id` and the audit rows.
- **Migrations**: follow the CLAUDE.md rule (previous release runs against the new schema for a few seconds): add nullable or defaulted columns first (as `custom_colors` was); do not drop or rename `pages`/`page_links` columns read by `PublicPageSerializer` in the same release.
- **Docs**: `docs/mcp.md` describes page tools; update it with BP-72..74.

## Tests that pin this behaviour

- Pages and slugs: `backend/spec/requests/api/me/pages_spec.rb`, `backend/spec/requests/api/public/pages_spec.rb`, `backend/spec/requests/client_ip_spec.rb`.
- Links, kinds, reorder: `backend/spec/requests/api/me/page_links_spec.rb`, `backend/spec/requests/api/me/page_link_kinds_spec.rb`, `backend/spec/requests/security/injection_spec.rb`.
- Templates and Community: `backend/spec/requests/api/me/page_templates_spec.rb`, `backend/spec/requests/api/me/page_templates_publish_spec.rb`, `backend/spec/requests/api/me/community_templates_spec.rb`.
- Colors and palettes: `backend/spec/requests/api/me/color_palettes_spec.rb`, `backend/spec/models/custom_colors_spec.rb`.
- Avatars: `backend/spec/requests/api/me/pages_avatar_spec.rb`, `backend/spec/jobs/optimize_avatar_job_spec.rb`, `backend/spec/jobs/cleanup_stale_avatar_uploads_job_spec.rb`, `backend/spec/imgproc_spec.rb`, `backend/spec/services/imgproc_spec.rb`.
- Link safety: `backend/spec/jobs/page_link_safety_job_spec.rb` (job, recheck and Google client).
- Clicks and statistics: `backend/spec/requests/api/public/page_link_clicks_spec.rb`, `backend/spec/requests/api/me/pages_statistics_spec.rb`, `backend/spec/jobs/purge_old_ip_addresses_job_spec.rb`.
- QR, export, deletion: `backend/spec/requests/api/me/qr_codes_spec.rb`, `backend/spec/requests/data_export_spec.rb`, `backend/spec/requests/account_deletion_spec.rb`.
- Abuse detection: `backend/spec/jobs/detect_page_abuse_job_spec.rb`.
- MCP: `backend/spec/requests/mcp_page_tools_spec.rb`, `backend/spec/requests/mcp_full_tools_spec.rb`, `backend/spec/requests/mcp_publish_tools_spec.rb`.
- Not covered: no e2e test and no frontend unit test touches bio pages; rate limits `pages_create`, `community_template_report`, `public_page_link_clicks`; the 50-item limit; label/URL/title length limits; `expires_at` rules; the template item limit of 20 per user.

## Drift and open questions

- **Safety checks are probably off in production (high).** `PageLink#verify_safety` and `RecheckPageLinksSafetyJob` need `ENABLE_GOOGLE_SAFE_LINK`, and the job needs `GOOGLE_SAFE_LINK_KEY`. Neither name appears in `.ci/stack.yml` (`web`, `jobs`), only in `.env.development` (empty) and in `spec_helper.rb`. If the deployed environment is exactly that file, no bio link is ever checked, although `README.md:40` says "a safety check on every link". Could not verify the real production environment.
- **New dashboard pages are public immediately (medium).** `published` defaults to true and the create form does not send it (BP-08), unlike MCP drafts. Not recorded whether intended.
- **Slug rename frees the old slug with no redirect (medium).** Printed QR codes and shared links break and a third party can claim the old slug (BP-05). Template `author_label` keeps the old slug text.
- **Applying a template deletes click history (medium).** BP-34; the API does not warn, only the dashboard confirms when items exist.
- **Link flag lifecycle gaps (medium).** New and edited links stay `safe` until the job runs (BP-51); the owner cannot clear a false positive and is not told; the job retries only the Google client error, not network exceptions raised by HTTParty (inferred from `retry_on`).
- **Recheck cadence (low, inferred).** Daily at 4am with a "older than 1 day" cutoff means a link checked a few seconds after the previous run is skipped by the next run, so some links are rechecked every second day.
- **Contracts do not enforce lengths (low).** Title, bio, label and URL maximums exist only in the model, so error shapes differ between contract errors (hash) and model errors (array); `pages#create` rescues `RecordInvalid` and renders the page's errors even when the failing record is an item from a template (`pages_controller.rb:64-66`).
- **Social icon vs URL is a frontend-only rule (low).** A client can store `icon: "instagram"` with any http(s) URL (BP-21).
- **Whitespace in URLs (low).** The `http_url` macro validates the stripped value but the stored value is not stripped; the public view then fails the `^https?://` test and renders no `href` (BP-17).
- **Expired page cannot be saved without changing `expires_at` (low, inferred for the UI).** The update contract rejects a past `expires_at` even if unchanged and the editor always sends the field.
- **Hardcoded host in meta (low).** `routes/bio/$username.tsx:34` builds the canonical and `og:url` as `https://kurz.fyi/u/<param>` (raw URL param, not the normalized slug) while `Page#public_url` uses `FRONTEND_URL`; `routes/pages/index.tsx:101` also prints `kurz.fyi/u/`.
- **Avatars bypass the imgproc sandbox (low, inferred from chronology).** Avatars (since `6e4b4ce`, 2026-09-23) decode 50 MB / 100 MP files in the jobs container, while forms use the sandbox that limits 10 MB / 50 MP (`433073f`, 2026-10-05). `AvatarUpload` was refactored but not moved. Not recorded whether intentional.
- **Silent avatar failure (low).** A corrupt but header-valid file is dropped without telling the owner (BP-56).
- **Hidden template stays hidden through unpublish and republish (low),** and the owner is not told it is hidden except by the flag in their list (BP-40, BP-45).
- **Unpublish consumes the publish rate limit (low).** The 5 per day limit applies to the whole `update` action (BP-40).
- **Soft-deleted pages (low).** No restore path and no purge until the account is purged; `deleted_at` is excluded from audits, so a page deletion leaves no audit row (inferred from `audited except:`). Orphaned Active Storage files stay.
- **Stale schema comments (low).** `page.rb`, `page_serializer.rb` and the factory annotations omit `custom_colors`.
- **Docs (low).** `docs/mcp.md:15` says deleting stays in the dashboard while `delete_page` exists under `account:full` (line 18 clarifies); line 18 lists "applying templates" under full access, but `apply_page_template` needs only `pages:write` (full access matters only for published pages).
- **Template item content is not validated at save time (low).** A hand-crafted `items` array (not possible through the API, which builds items from a page) would fail only when applied.
