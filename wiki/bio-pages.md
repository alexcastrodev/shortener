# Bio Pages

> Scope: bio pages (`/u/:slug`), their links, themes and custom colors, avatars, templates (built-in, own, Community), link safety checks, click tracking and page statistics, QR code, deletion. State as of 2026-10-17.
> AI-app access to pages is described in the MCP guide.

## Summary

A bio page is a public link-in-bio page owned by one user and served at `/u/:slug`. It has a title, a bio text, a theme (or three custom colors), an optional avatar and an ordered list of up to 50 items of three kinds: button links, social icons and section headers. A page is public only when it is published, not expired, not deleted and its owner is active. Owners start a page from a built-in template, one of their own saved templates or a Community template (always as placeholders), and can publish their own templates to the Community gallery, where three reports hide a template until an admin looks at it. Link URLs are checked against Google Safe Browsing (when enabled) and flagged links disappear from the public page. Each click on a public link is stored with coarse visitor data and aggregated into the owner's statistics. The same pages can be drafted by AI apps through MCP (draft-only unless the grant has full access).

## Glossary

- **Page**: one bio page. A user can own many.
- **Slug**: the address segment in `/u/:slug`. Called "address" in the page editor.
- **Page link / item**: one entry of a page. Its kind is `link` (a button), `social` (an icon in the row under the title) or `header` (a section title, no URL).
- **Network**: one of nine brand icons a social item can show: Instagram, TikTok, Facebook, LinkedIn, Snapchat, YouTube, X, OnlyFans, WhatsApp.
- **Theme**: one of six presets: default, midnight, sunset, forest, ocean, paper.
- **Custom colors**: a set of three colors (background, text, accent) in `#RRGGBB` form that overrides the theme. Forms use the same mechanism (see [forms](forms.md)).
- **Palette**: a named, saved set of custom colors owned by a user.
- **Avatar**: the page photo, shown as a small WebP image. The uploaded original is only kept until it has been optimized.
- **Template**: a snapshot of a page's items and theme. A template is either built-in, one of the user's own (with originals), or a Community template published by someone else (placeholders only).
- **Community gallery**: the list of templates that are public and not hidden by moderation.
- **Placeholder**: the neutral replacement of an item in a public template. The placeholder URL is `https://example.com/replace-me`.
- **Safe**: a link is not safe when Safe Browsing flagged its URL. Unsafe links are never shown or clickable publicly.
- **Visible**: what anonymous visitors can see: a public page, and on it only the active, safe items.

## Business rules

### Slug (address)

- **BP-01** The slug is stripped of surrounding spaces and lowercased when it is saved, so `"  Alex.Castro "` is stored as `alex.castro`. Lookups are case-insensitive: the public address `/u/Alex.Castro` finds the same page.
- **BP-02** A slug is 3 to 30 characters: lowercase ASCII letters and digits plus `_`, `.` and `-`, starting and ending with a letter or digit. Dots, repeated separators and all-digit slugs are allowed. Unicode, spaces and a leading dash are rejected.
- **BP-03** These 19 slugs are reserved: `about admin api app dashboard help kurz login logout me new pages report settings signup status support u www`. The check runs after normalization, so `Admin` is also rejected. Reason: they would be confusing as `/u/:slug` or collide with product words.
- **BP-04** A slug is globally unique across all users, including deleted pages (see BP-69). A clash is reported as a validation error; a simultaneous race between two users for the same slug is reported as a conflict.
- **BP-05** The slug can be changed at any time, also while the page is published. The old slug is released at once and nobody is redirected from it, so printed QR codes and shared links to the old address stop working. There is no slug history. The reason renaming is free is not recorded.
- **BP-06** The slug format is enforced by the server and repeated in the dashboard forms; the API itself only requires a non-empty string at the input stage. Case-insensitivity depends on the normalization in BP-01.

### Pages per user, states and visibility

- **BP-07** There is no limit on the number of pages per user. The only brake is a rate limit of 10 page creations per hour per user ("Too many pages created, please try again later"). Reason: it slows down scripted squatting of slugs and bulk phishing pages from fresh accounts. AI apps creating pages through MCP have their own limits (BP-73).
- **BP-08** A page is published by default. The dashboard create form sends only the slug, the title and the template choice, so a page created in the dashboard is public as soon as it exists (empty, showing "No links yet."). Pages created through MCP are always drafts (BP-73).
- **BP-09** The public page is served only if the page is not deleted, is published, has no expiry or an expiry in the future, and its owner is not deactivated. In every other case the page answers "not found", with no distinction between missing, draft, expired, deleted and deactivated.
- **BP-10** An expiry date must be in the future at the moment it is saved; resending an already past value is rejected too. Nothing unpublishes the page at expiry: it stays published and simply stops being visible. Clearing the expiry brings it back.
- **BP-11** A deactivated owner (admin deactivation or pending account deletion) takes all their pages offline without changing their published state; reactivation brings them back. See [accounts-and-auth](accounts-and-auth.md).
- **BP-12** The title is at most 80 characters and the bio at most 300. Both are plain text; markup is stored and shown inertly. Errors come back as a list of messages.
- **BP-13** The public view of a page carries only the slug, title, bio, theme, custom colors, avatar and links. No owner data and no counters. Only active, safe links appear, in page order.

### Link kinds and validation

- **BP-14** An item is a `link`, a `social` icon or a `header` (default `link`). A page has at most 50 items of all kinds together; the limit is checked when an item is added. The 51st is refused with "A page can have at most 50 links".
- **BP-15** A label is required and is at most 80 characters.
- **BP-16** `link` and `social` items require a URL of at most 2048 characters. A `header` must have no URL, and one with a URL is rejected.
- **BP-17** Only `http` and `https` URLs with a host are accepted. `javascript:`, `data:`, `vbscript:`, `//host`, `https://` on its own and strings with spaces are rejected when an item is added or edited. The check looks at the trimmed value, but the value is stored as sent, so surrounding whitespace is kept (see Drift).
- **BP-18** The editor repeats the scheme rule (http/https only, label up to 80), and the public page only turns a URL into a clickable link when it starts with `http://` or `https://`, as a second line of defense.
- **BP-19** Nothing blocks private, local or non-public hosts, shortener URLs or the page's own URL; the only content check is Safe Browsing (BP-46 to BP-51).
- **BP-20** A `social` item requires its icon to be one of the nine networks. For other kinds the icon is optional but, when present, must be a known network (a `link` with an icon is drawn as a button with the brand icon).
- **BP-21** The server never checks that the icon matches the URL host. The editor does: shortcuts build the URL from a handle, a pasted URL must belong to the chosen network, and the generic "add button" form picks the icon from the URL host. This is a dashboard-only convention.
- **BP-22** `link` and `social` items can be switched into each other. A `header` can never become a link or social item, and the reverse.
- **BP-23** An inactive item is hidden from visitors (and cannot be clicked) without being deleted. Applying a template creates all non-header items inactive (BP-33).
- **BP-24** The public view groups buttons under the header that precedes them, pulls social items into a row under the title and drops a header that has no visible button below it. A social item whose icon the page does not know is shown as a button. This grouping is a display rule only.

### Ordering

- **BP-25** A new item goes to the end of the page (position 1 on an empty page). The position cannot be set when creating or editing an item.
- **BP-26** Items are always read in page order (position, then creation order).
- **BP-27** Reordering takes the full list of item ids and requires every item of the page exactly once (headers, inactive and flagged items included). Anything else is refused with "must list every link of the page exactly once". Positions are rewritten as 1..n in one step.
- **BP-28** The editor keeps social items first ("Social icons are always drawn in their own row"), and when a button is added from a section it is created at the end and then moved. These are dashboard conventions; any order is accepted by the server.

### Themes and custom colors

- **BP-29** The theme must be one of the six presets; the default is `default`. The same list is used by templates and forms.
- **BP-30** Custom colors are either unset or exactly three values (background, text, accent), each `#` plus six hex digits. Values are lowercased when saved. Anything else (3-digit hex, color names, `url(...)`, a missing or extra value) is rejected. Clearing them is allowed.
- **BP-31** When custom colors are set, the page shows them and ignores the theme, which stays stored. Picking a preset in the theme picker clears the colors. The editor only warns when text/background contrast is below 4.5; contrast is never enforced. The presets were picked to keep text and buttons readable (WCAG AA contrast).
- **BP-32** Each user can save up to 20 palettes; a palette needs a name of at most 40 characters and valid custom colors. Palettes are private (the owner can list, create and delete them), are not tied to a page, and cannot be edited, only deleted and recreated. They are not part of the account data export.

### Templates

- **BP-33** There are six built-in templates: `creator` (theme sunset, 8 items), `business` (paper, 8), `professional` (midnight, 5), `musician` (ocean, 9), `sponsors` (default, 10) and `blank` (default, 0). Their buttons and social icons are created inactive with placeholder or example-handle URLs, so nothing fake goes live until the owner fills it in; section headers are active. Names and labels are in English.
- **BP-34** Applying a template to a page (or choosing one when creating the page) is all-or-nothing: it deletes all existing items of the page, creates the template's items in order, sets the page theme and clears the custom colors. It does not touch the slug, title, bio, avatar, published state or expiry. Because the old items are deleted, their click history and counters are deleted with them. The server does not require the page to be a draft and does not ask for confirmation; the dashboard confirms when the page already has items.
- **BP-35** An unknown template id is "not found" and the page is untouched. If a stored item turns out to be invalid when applied, the whole operation is rolled back and the owner gets a validation error.
- **BP-36** A user saves one of their own pages as a private template. The snapshot holds the page's items in page order (kind, label, URL, icon, active) and its theme; it does not hold custom colors, title, bio or avatar. A user keeps at most 20 templates (private and public together); the name is required and at most 60 characters; a template has at most 50 items.
- **BP-37** The template list shows built-ins first, then the caller's own newest first, never anyone else's. Own templates are shown with their originals and with the public version others would see. A user can delete only their own templates; pages already created from one keep their copies.
- **BP-38** Publishing a template to the Community requires an author page: one of the caller's own pages that is currently visible (published, not expired, owner active), otherwise "not found". The description is at most 140 characters. Name and description must not contain URL-like text (`http(s)://`, `www.`, or a name ending in `.com .net .org .io .ly .me .co .br .pt .link .xyz .app .site .gg .to .tv`), otherwise it is rejected. Publishing records the author label (`"Title · @slug"`, or `"@slug"` without a title) and the publication time. The author's e-mail is never exposed.
- **BP-39** What others get is derived every time it is read and never stored: a `social` item keeps only its network (name, example URL, inactive); a `header` becomes `Section n`; a `link` becomes `Link n` (or `<Network> link` when it had a known icon) with the placeholder URL, inactive. The theme is kept, so layout and look are shared but no text or URL of the author is. Social items with an unknown icon are dropped. Reason: none of the author's texts or links may leave the server in a public response, and public text must not smuggle links into the gallery.
- **BP-40** Unpublishing a template removes it from the gallery at once; pages already created from it keep their copies. It does not clear moderation state or reports, so a hidden template that is unpublished and published again stays hidden. The publishing limit (5 per day per user) also counts unpublishing.
- **BP-41** The Community gallery lists public, non-hidden templates. Sorting is "popular" (default: most used first, then most recently published) or "new" (most recently published first). Pages of 12 by default, 1 to 48 allowed. Items are always the placeholder version. Each entry says whether it is the caller's own template and shows the author label and the author's page address, which is empty unless the author page is currently visible.
- **BP-42** Using a Community template behaves like a built-in one but with placeholder items. It is a copy, so later edits, hiding or unpublishing of the template do not touch pages already created. Hidden or private templates cannot be used. A template's use counter goes up by one when another user creates a page from it or applies it; the author's own uses and built-in or own templates are not counted.
- **BP-43** Reporting a Community template: the reason is one of spam, offensive, impersonation or other. A user can report a template once ("User already reported this template" the second time); the author cannot report their own template; only listed templates can be reported (hidden or private ones answer "not found"). The third report hides the template. Reports are limited to 20 per hour per user.
- **BP-44** Moderation (admins only): admins can list reported, hidden or public templates (up to 200, originals included) and hide or unhide a template. Hiding takes it out of the gallery; unhiding puts it back, resets the report count to 0 and deletes the reports ("the template starts over"). The screens belong to [admin-and-moderation](admin-and-moderation.md).
- **BP-45** The owner of a moderated template sees it as hidden but still public; nothing notifies the owner. Whether a notification is intended is not recorded.

### Link safety (Safe Browsing)

- **BP-46** Provider: Google Safe Browsing, looking for malware and social-engineering (phishing) threats, with up to 500 URLs per request.
- **BP-47** The whole feature is on only when link safety checking is enabled for the deployment. When it is, creating or editing an item with a new URL schedules a background check. A header never has a URL and is never checked. Reason: a link approved once can later be swapped for something malicious.
- **BP-48** The check marks the URLs Safe Browsing returns (exact match against the stored URL) as unsafe and the rest as safe, and records when the check happened. If the Safe Browsing request fails, it is retried (3 attempts, increasing waits) and links are left as they were. Reason: hiding every link on a transient API error would take down pages that did nothing wrong.
- **BP-49** Every day at 4am a recheck selects every link with a URL that was never checked or was last checked more than a day ago (no filter on page state: drafts, expired and deleted pages included) and checks them in batches of 500. It does nothing when link safety checking is not enabled.
- **BP-50** An unsafe link is removed from the public page, cannot be clicked, and is shown to the owner in the editor with a red ring and a warning icon. It stays in the owner's list, statistics and template snapshots. The owner cannot clear the flag; it changes only when the URL is edited and the next check returns it clean, or at the next daily recheck. There is no notification to the owner.
- **BP-51** A new link is safe by default and is public until its first check finishes. Editing the URL of a link does not reset its status before the check runs: a flagged link stays hidden until a clean result, a safe link stays visible until a bad one.
- **BP-52** The page link check is separate from the shortlink check (see [shortlinks](shortlinks.md)). A separate hourly abuse detection raises signals for several new accounts publishing the same text or links; it never changes a page. Heuristics and the admin screen: [admin-and-moderation](admin-and-moderation.md). The page owner sees nothing of it.

### Avatars

- **BP-53** An avatar upload accepts PNG, JPEG, WebP, HEIC and HEIF, identified by the file's actual content only; the declared file type and filename are ignored (an SVG renamed to `.png` is refused with "must be a PNG, JPEG, WebP or HEIC image").
- **BP-54** Size limit 50 MB ("must be at most 50MB"). Dimension limits, read from the file header before anything is stored: at most 12 000 px per side and 100 megapixels ("must be at most 12000px per side and 100 megapixels"); unreadable files give "could not be read as an image". The dashboard refuses files over 50 MB before uploading. Reason: full-resolution phone photos (a 48 MP HEIC can pass 40 MB) are accepted and shrunk in the background; the header check stops decompression bombs.
- **BP-55** The original is held aside and a background job optimizes it; the upload answers "accepted, processing". The previous avatar stays visible meanwhile. A new upload replaces a pending one and the earlier job is ignored.
- **BP-56** The optimization job resizes the image to fit 1024 x 1024 (no upscaling), straightens it from its orientation data, strips all metadata (GPS included), converts it to WebP at quality 85, and discards the original. A 400 x 400 thumbnail is prepared up front. Visitors only get the thumbnail, served through Kurz itself so the storage is not public and the URL does not expire. A corrupt file is dropped, the previous avatar is kept and the owner gets no error (the "processing" state just ends).
- **BP-57** Avatar processing is deliberately serialized: only one image is decoded at a time across the whole system, and one per user at a time, so a user cannot queue several uploads ahead of everyone else.
- **BP-58** Upload rate limits (message "too many uploads, please try again later"): 5 per 10 minutes and 20 per day per user, 20 per hour per client IP. These protect storage and the image queue rather than bandwidth.
- **BP-59** Removing an avatar deletes both the original upload and the avatar. A cleanup every 15 minutes discards any original upload more than 1 hour old (lost job or worker down); the page keeps its previous avatar and leaves the "processing" state. The editor checks progress every 2 seconds up to 60 times (about 2 minutes), then shows a "stalled" message.

### Clicks and statistics

- **BP-60** A click is recorded only for a visible page and a link that is active, safe and not a header; otherwise it is "not found". The visitor's browser reports the click from the public page and ignores failures.
- **BP-61** A click stores: the time, the visitor IP (see BP-62), the browser's user-agent text (first 255 characters), the referring page (first 255 characters, empty means none, not validated as a URL), the country and region supplied by the network edge (unknown country markers become empty), and the platform and browser parsed from the user agent. No third party is called for this data.
- **BP-62** The visitor IP is taken from the page server that forwards the visitor (when it proves itself with a shared secret), else from the network edge, else from the connection itself; values must be valid IP addresses.
- **BP-63** Deduplication: the same IP on the same link within 10 seconds counts once. Rate limit: 30 clicks per minute per IP across all pages. Clicks are recorded immediately, with no queue: nothing waits on this request, so a queue would add a moving part without removing any latency. This differs from shortlink clicks (see [shortlinks](shortlinks.md)).
- **BP-64** Retention: a daily job (04:15) erases the IP, user agent and referer from clicks older than 90 days. Country, region, platform, browser, timestamp and the link's click total are kept until the link, page or account is deleted.
- **BP-65** Statistics are for the owner only (and for AI apps with read access, see BP-67). The period is 7, 30 or 90 days (any other value falls back to 30). Days are UTC; the window starts at the beginning of the UTC day `days - 1` days ago. The statistics show the all-time total, the clicks in the period, a per-day timeline (including days with 0), all non-header links (sorted by period clicks, then total clicks), and rankings of sources, devices (platform), browsers and countries. Rankings show the top 8 and fold the rest into "Other"; missing values become "Unknown".
- **BP-66** Sources: the in-app browser named in the user agent (Instagram, TikTok, Facebook, LinkedIn, Snapchat, X, WhatsApp) wins, then the host of the referrer (which adds YouTube, Google and Kurz), "Direct" without a referrer and "Other" for an unknown host. Browsers show `"<App> app"` for in-app browsers. Statistics include inactive and flagged links.
- **BP-67** The MCP statistics tool returns the same aggregates and never a visitor string.

### QR code

- **BP-68** Each page has a QR code, an SVG of its public address, with medium error correction and black modules on a white background whatever the theme (low-contrast QR codes fail on cheaper phone cameras). Only the owner can fetch it, also for unpublished pages. The code embeds the slug, so a slug rename (BP-05) invalidates printed codes. The dashboard shows it in a modal with a download named `kurz-<slug>.svg`.

### Deletion

- **BP-69** Deleting a page is a soft delete: it disappears from the owner's list and the public address answers "not found". The slug stays reserved (BP-04), items, clicks and avatar files are kept, and no screen restores or lists deleted pages. A page deletion leaves no audit trail.
- **BP-70** Individual items are deleted for good; their clicks go with them. Own templates and palettes are also deleted for good.
- **BP-71** Pages are erased for good only when the account is purged (30 days after the deletion request): this removes all pages (items, clicks, avatars), the user's templates, reports and palettes. A template published from a purged page keeps its author label and loses the link to the author page. Pages, templates (with originals) and links (with click totals, not individual clicks) are included in the account data export; palettes and avatars are not. See [accounts-and-auth](accounts-and-auth.md).

### MCP access (summary; details in [mcp-and-oauth](mcp-and-oauth.md))

- **BP-72** Access is granted by scope: read (listing pages and templates and reading page statistics), write (creating and editing pages, managing and reordering their links, and applying a template), publish (publishing and unpublishing) and full account access (deleting a page, which needs the exact slug as confirmation).
- **BP-73** Creating a page through an AI app always makes an unpublished draft, rejects publishing and expiry settings and unknown fields, accepts built-in and own templates (not Community ones), and is limited to 10 per hour and 50 per day per user. Deleting a page is limited to 10 per hour and 30 per day, publishing to 20 per hour and 100 per day, unpublishing to 30 per hour.
- **BP-74** A published page cannot be edited through an AI app without full access: editing its links or applying a template answer "page published"; editing accepts only the theme and custom colors on a published page. Full access lifts the limit. An AI app cannot set expiry or the published state when creating or updating a page, and applying a template through an AI app does not count Community uses (it cannot use Community templates). All text returned to the AI app is cleaned.

## Flows

1. **Create a page (dashboard).** The owner enters a slug, an optional title and an optional template. The page and its template items are created together, a Community template use is counted if relevant, and the page is published immediately (BP-08). Validation failures are shown on the form.
2. **Edit content.** The editor saves the page card (slug, title, bio, theme, custom colors, published, expiry) in one go. Items are added, edited, deleted and reordered in the phone preview. A changed URL schedules a link safety check when safety checking is enabled.
3. **Visitor opens `/u/:slug`.** The page is rendered on the server (120 requests per minute per IP) or shows "This page does not exist or is no longer available." The page cannot be framed in other sites, carries a canonical address and social preview tags (avatar as preview image, otherwise the Kurz preview image), and has a footer "Made with Kurz" plus a "Report" link to `/report?page=<slug>`.
4. **Visitor clicks a link.** The browser reports the click (BP-60 to BP-63) and follows the link, opened with no referrer or opener access and marked nofollow.
5. **Upload an avatar.** Validate, hold the original, optimize in the background, answer "accepted". The editor waits until processing ends. The cleanup is the safety net.
6. **Save and publish a template.** Save as private, then publish with an author page and description to put it in the gallery. Others use it as a placeholder copy; three reports hide it; an admin unhides or leaves it hidden.
7. **Link safety.** Save or change a URL, background check, safe flag set. A daily recheck covers anything not checked for a day.
8. **Statistics.** The statistics screen offers a 7 / 30 / 90 day selector.

## States and transitions

Page visibility (derived from the published state, expiry, deletion and the owner's status):

| From | Event | To | Condition | Effects |
|---|---|---|---|---|
| (new) | Created in the dashboard | published | published by default | Public at once |
| (new) | Created through MCP | draft | always a draft | None |
| draft | Owner publishes (dashboard) or through an AI app | published | the AI app needs the publish permission | None |
| published | Owner unpublishes or through an AI app | draft | none | Items and statistics kept |
| published | Expiry passes | expired (still marked published) | none | Page and clicks answer "not found" |
| expired | Expiry cleared or moved to the future | published | new value must be in the future | Public again |
| any | Owner deactivated | hidden | owner deactivated | Back when reactivated |
| any | Owner deletes | deleted | none | Slug stays reserved; "not found" |

Link safety:

| From | Event | To | Condition | Effects |
|---|---|---|---|---|
| safe (default, unchecked) | Check flags the URL | unsafe | safety checking enabled | Hidden publicly, clicks refused, check time recorded |
| safe | Check returns clean | safe | none | Check time recorded |
| unsafe | Check returns clean (after URL edit or recheck) | safe | none | Visible again |
| any | Safe Browsing request fails | unchanged | after 3 attempts the check gives up | Next daily recheck retries |

Template:

| From | Event | To | Condition | Effects |
|---|---|---|---|---|
| private | Publish | public | visible own author page, no links in name or description, 5 per day | Author label and publication time recorded |
| public | Unpublish | private | none | Leaves the gallery; moderation state and reports kept |
| public, listed | Third distinct report | public, hidden | 3 reports and not already hidden | Leaves the gallery |
| public, listed | Admin hides | public, hidden | admin | Leaves the gallery |
| hidden | Admin unhides | public, listed | admin | Report count reset to 0, reports deleted |

Avatar: none → (upload) processing → (optimized) ready; processing → (corrupt, replaced, removed or 1 hour stale) back to the previous state; any → (remove avatar) none.

## Limits and configuration

| Name | Value | Notes |
|---|---|---|
| Slug length / characters | 3-30, `a-z 0-9 _ . -`, letter or digit at both ends | Server and dashboard forms |
| Reserved slugs | 19 words | See BP-03 |
| Pages per user | unlimited | Creation limited to 10 per hour |
| Title / bio | 80 / 300 characters | |
| Items per page | 50 | Checked when an item is added |
| Item label / URL | 80 / 2048 characters | |
| Templates per user | 20 | Private and public together |
| Template name / description | 60 / 140 characters | |
| Items per template | at most 50 | |
| Palettes per user / name | 20 / 40 characters | |
| Reports to auto-hide a template | 3 | One per user per template |
| Template publishing | 5 per day per user | Unpublishing counts too |
| Template reports | 20 per hour per user | |
| Community page size | 12 default, 1 to 48 | |
| Page creation | 10 per hour per user | |
| Avatar upload | 5 per 10 min and 20 per day per user; 20 per hour per IP | |
| Avatar size / pixels | 50 MB; 12 000 px per side; 100 MP | Checked from the file header |
| Stored avatar / thumbnail | 1024 px max edge, WebP quality 85 / 400x400 WebP | |
| Stale original upload | 1 hour, swept every 15 minutes | |
| Avatar processing concurrency | 1 at a time overall, 1 per user | |
| Public page views | 120 per minute per IP | |
| Link clicks | 30 per minute per IP | Empty "too many" answer |
| Click dedup | 10 s per link and IP | |
| Click IP / user agent / referer retention | 90 days | Daily at 04:15 |
| Statistics periods | 7, 30, 90 days (default 30), top 8 | UTC |
| Safe Browsing batch | 500 URLs | |
| Link recheck | daily at 4am, links not checked for over 1 day | |
| Account purge grace | 30 days | |
| Link safety checking | on or off per deployment | Off means no link is ever flagged |

## Authorization and privacy

- **Anonymous**: can view public pages and record clicks. No authentication needed.
- **Owner**: owners see and change only their own pages, links, palettes and templates; another user's page, link, palette or template answers "not found" (never "forbidden").
- **Admin**: moderates Community templates (BP-44). Admins have no special read or write access to other users' pages in this domain (deactivation and abuse screens are in [admin-and-moderation](admin-and-moderation.md)).
- **MCP**: scopes in BP-72 to BP-74.
- **Personal data of visitors**: IP, user agent and referer for 90 days; country, region, platform and browser indefinitely (BP-61, BP-64). Visitors are not shown any notice on the page. Bio-page clicks are not part of the shortlink analytics pipeline.
- **Personal data of owners**: page content is public by design. Avatar metadata (EXIF, GPS) is stripped (BP-56). The Community gallery shows only the author label (title and slug) and a link to the author's page while it is public; the e-mail is never shown, except to admins in the moderation list.
- **Clickjacking and XSS**: the public page cannot be framed in other sites; text is shown as plain text; links are only made clickable for `http(s)`; custom colors only reach the page style after the `#RRGGBB` check.

## API and UI surface

**Visitors** open `/u/:slug` (a standalone page without the site header or footer), can use the "Report" link to flag a page, and trigger click tracking by following links.

**Owners (dashboard)**
- Page list and create, with template choice.
- Page editor: phone preview, add, edit, hide, delete and reorder items, theme picker with custom colors and saved palettes, avatar upload and removal, expiry, publish and unpublish, template gallery (built-in, own, Community), save and publish own templates, report Community templates, QR code modal.
- Statistics screen with a 7 / 30 / 90 day selector.
- The same capabilities are available through the owner API.

**Admins** review reported and hidden Community templates and hide or unhide them (moderation screen, see [admin-and-moderation](admin-and-moderation.md)).

**AI apps (MCP)** use the page tools listed in BP-72 to BP-74 within the granted scopes.

Errors: validation problems are returned per field or as a list of messages; unknown or foreign ids answer "not found". The dashboard is available in English and Portuguese (Portugal).

Background work: link safety checks (on URL change and daily at 4am), avatar optimization (on upload), stale upload cleanup (every 15 minutes), click personal data purge (daily at 04:15) and page abuse detection (hourly). Full schedule: [platform-and-operations](platform-and-operations.md).

## Decisions

### D-BP-01 Click writes are synchronous
**Decision.** Bio-page clicks are recorded immediately when the request arrives, not through the redirect service and the analytics pipeline used by short links. **Why.** Nothing waits on this request, so a queue would add a moving part without removing any latency from the user. **Consequence.** Click volume is bounded by the 30 per minute per IP limit and the cost of the write sits on the main application.

### D-BP-02 Avatars are accepted large and shrunk in the background
**Decision.** Up to 50 MB and 100 MP are accepted, held aside, and converted by a background job that runs one image at a time; only a small WebP is served, through Kurz itself. **Why.** Phone photos exceed 40 MB; the header check stops decompression bombs; one decode at a time protects the background workers; serving through Kurz keeps storage private and URLs stable. **Consequence.** Upload is eventual (accepted, progress checks, stale cleanup) and errors in the job are silent to the owner.

### D-BP-03 Community templates share structure, never content
**Decision.** Public templates are turned into placeholders every time they are read, and public name and description may not contain links. **Why.** Originals must not leave the server and the gallery must not become a spam channel. **Consequence.** A Community template cannot carry copy or URLs; moderation is report-driven (3 reports) plus admin review; an extra rate limit (5 publishes per day) limits flooding.

### D-BP-04 Link safety fails open
**Decision.** A failed Safe Browsing request leaves links unchanged and retries later; new links are safe until checked. **Why.** Hiding every link on a transient API error would take down pages that did nothing wrong. **Consequence.** A malicious URL is public until its first check finishes, and everything stays visible if checking is not enabled (see Drift).

### D-BP-05 Pages edited by MCP are drafts
**Decision.** MCP creates only drafts and edits only drafts (theme and colors excepted) unless the grant has full access. **Why.** See the MCP guide: publishing needs a separate scope that can never be combined with response-reading scopes, so untrusted text cannot steer what goes online. **Consequence.** The dashboard publishes on create while MCP does not.

### D-BP-06 Custom colors are free-form but strictly shaped
**Decision.** Besides six presets, users may set three `#RRGGBB` colors and save palettes; contrast is advised, not enforced. **Why.** The presets were chosen for WCAG AA contrast; free colors were added together with form colors. Why contrast is not enforced is not recorded. **Consequence.** An unreadable page is possible; the strict shape check is what keeps style injection out.

## Change impact

- **Slug rules** (BP-01 to BP-03, BP-06): also change the dashboard create and editor forms, their validation texts in both languages, and the slug length hint given to AI apps (BP-73). Existing slugs must stay valid.
- **Add a theme** (BP-29): themes are shared with templates and [forms](forms.md); update the dashboard theme picker, the public page look, the choices offered to AI apps and the theme names in both languages.
- **Add a network** (BP-20, BP-21): update the icon set, template placeholders, the abuse detection placeholder list (BP-52), the editor's handle shortcuts, traffic sources (BP-66) if it is also a source, and the choices offered to AI apps.
- **Add a link kind or field** (BP-14 to BP-24): review the public page view, template snapshots and placeholders (BP-36, BP-39), applying a template (BP-34), AI-app tools (BP-72), the account data export (BP-71) and the editor. Stored templates from older releases must keep applying.
- **Change the items-per-page limit** (BP-14): also the template item limit (BP-36) and the reorder limit for AI apps.
- **Change what a template overwrites** (BP-34): it deletes click history of replaced items; review statistics expectations, the dashboard confirmation, applying a template through an AI app and the custom colors reset.
- **Change publishing defaults** (BP-08, BP-73): dashboard create flow, MCP assumptions and page abuse detection (BP-52), which looks at pages created in the last 24 hours.
- **Change visibility** (BP-09, BP-13): the same rule drives the public page, click recording, template author checks and Community author links. A new state must be added to all of them.
- **Change click storage** (BP-61 to BP-64): review the personal data purge, the account data export, the privacy page, the statistics (BP-65), the MCP statistics tool (BP-67) and [shortlinks](shortlinks.md) if the two pipelines are ever unified.
- **Change link safety** (BP-46 to BP-51): review the on/off setting of the deployment, how unsafe links are hidden publicly and flagged in the editor, and the separate shortlink check.
- **Change the avatar pipeline** (BP-53 to BP-59): review size and pixel limits (also in the dashboard), accepted formats, processing concurrency, storage and thumbnail serving, and the stale cleanup age.
- **Soft delete** (BP-69, BP-71): deleted pages keep slugs reserved and files stored; any hard purge or slug release must handle templates' author links and audit records.
- **Migrations**: the previous release keeps running against the new schema for a few seconds during a deploy, so add nullable or defaulted columns first (as custom colors were); do not drop or rename page or item fields that the public page reads in the same release.
- **Docs**: the MCP guide describes page tools; update it with BP-72 to BP-74.

## Drift and open questions

- **New dashboard pages are public immediately (medium).** A page is published by default and the create form does not ask (BP-08), unlike MCP drafts. Not recorded whether intended.
- **Applying a template deletes click history (medium).** See BP-34; the server does not warn, only the dashboard confirms when items exist.
- **Recheck cadence (low).** Daily at 4am with a "older than 1 day" cutoff means a link checked a few seconds after the previous run is skipped by the next run, so some links are rechecked every second day.
- **Lengths are enforced inconsistently (low).** Title, bio, label and URL maximums are enforced at one level only, so error shapes differ (per-field versus a list of messages), and a failing item from a template can surface as an empty error when creating a page.
- **Social icon vs URL is a dashboard-only rule (low).** An API client can store an Instagram icon with any http(s) URL (BP-21).
- **Whitespace in URLs (low).** The URL check looks at the trimmed value but the stored value is not trimmed; the public page then fails its `https?://` test and shows no clickable link (BP-17).
- **Expired page cannot be saved without changing the expiry (low).** A past expiry is rejected even if unchanged, and the editor always sends the field.
- **Hardcoded host in page metadata (low).** The canonical and social preview address use a fixed `https://kurz.fyi/u/<param>` with the raw URL text rather than the normalized slug, while QR codes use the configured site address; the page list also prints `kurz.fyi/u/`.
- **Silent avatar failure (low).** A corrupt but header-valid file is dropped without telling the owner (BP-56).
- **Hidden template stays hidden through unpublish and republish (low),** and the owner is not told it is hidden except by the flag in their list (BP-40, BP-45).
- **Unpublish consumes the publish rate limit (low).** The 5 per day limit covers unpublishing too (BP-40).
- **Soft-deleted pages (low).** No restore path and no purge until the account is purged; a page deletion leaves no audit trail. Orphaned avatar files stay.
- **Docs (low).** The MCP guide says deleting stays in the dashboard, although deletion is in fact available to AI apps under full access (a later line clarifies); it lists "applying templates" under full access, but applying a template needs only write access (full access matters only for published pages).
- **Template item content is not validated at save time (low).** A hand-crafted item list (not possible through normal use, which builds items from a page) would fail only when applied.
