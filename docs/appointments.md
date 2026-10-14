# Appointments (decision record)

Appointments let a form owner offer bookable services and let visitors book them from the public form. Everything is free: Kurz has no payments and no plans, so prices are informational text only.

This page records the decisions the implementation follows. It is open to every account: there is no feature flag or allow-list (they existed only while it was being built).

## Scope

- Kurz is the **only source of availability**. It does not read or write the owner's other calendars.
- One `booking` question per form. Its configuration (categories, services, weekly availability, exceptions, rules) lives inside `forms.fields` with stable ids, and it is validated like every other field.
- The `label` of the booking question is optional, the only question type where it is. Without one the field has no `label` key (the API drops a null, empty or blank label, so an update with `label: null` clears a stored one) and the public form shows no heading above the services; the group is still named, for assistive technology, by the translated name of the question type. The owner's question list and the responses views use that same name as the title, and the spreadsheet and data export columns say "Booking".
- Out of the first release: monthly fixed bookings, per-weekday time lists, "take X, pay Y" promotions, the category UI, `.ics` feeds, waiting list. They stay in the plan but ship later.
- "Take X, pay Y" packages were built and then removed: with a price per duration the total is no longer a simple multiple, so every session now costs the price of its own duration.

## Data model

| Table | Purpose |
|---|---|
| `forms` | Gains a published snapshot, its version and digest. Visitors read the snapshot, not the draft. |
| `form_responses` | Gains the published version the visitor answered. |
| `appointment_slots` | One row per form, resource and start time, with `capacity` (NULL means unlimited) and a `booked` counter. `service_key` is the service that holds the row; `resource_key` says whose time it is. |
| `appointments` | One row per booked session, tied to its response and its slot. |
| `appointment_tokens` | Single-purpose links (`manage`, `approve`, `decline`). Only a SHA-256 digest is stored. |
| `notifications` | One row per event, recipient and channel (`in_app`, `email`, `push`), written in the same transaction as the event. |

Integrity is enforced by the database: `booked` stays between 0 and `capacity`, a slot is unique per form, resource and start (and per form, service and start), appointments and tokens are deleted with their response, and a slot that still has appointments cannot be deleted.

## Durations and prices

A service has a main `duration` and `price` and up to four `extra_durations`, each with its own price (a priced service needs a price on every one, a free service none). The monthly offer may set its own `duration` and `price`; without a duration it uses the service's.

The visitor picks a duration together with the time. Each session is stored with its own duration and price in the appointment snapshot, and the total is the sum of the prices of the chosen durations. `appointment_slots.duration` remembers how long the booking on that time lasts: a full time blocks the times its length covers (plus the buffer), a time with a long booking stops offering the durations that would run into it, and a partly booked time only offers the duration it was opened with, as long as the service still offers that duration: when the owner has removed it, the time is offered with the durations of the service again (a visitor joining it is booked with the length he chose, and the time keeps the length it was opened with).

## Modes

A booking question has a **mode**, chosen when it is created and never changed (`mode` on the field; absent means `services`). `Booking::Modes` has one module per mode. A mode validates the question, says what blocks publishing and compiles the stored definition into the services the engine reads. The compiled definition is what `Forms::PublicDefinition` serves to visitors and what `Appointments::Impact` compares against, so the engine, the slots endpoint and the public form never know which mode a question has.

- `services`: the behaviour described on this page. Every service has its own days and times.
- `individual`: one teacher with one availability (`availability`: `days`, `times`, `times_by_day`) and any number of lessons that share it. Lessons (`services`) have a name, duration, price, capacity, other durations and a monthly offer. A lesson has no schedule of its own unless it carries `days` and `times` (and optionally `times_by_day`), for example a 60 minute lesson on some days and a 90 minute lesson on others; without them it uses the availability of the teacher, and a lesson with its own schedule that has no day or no time blocks publishing (`service_incomplete`). Compiling gives every lesson its schedule (its own or the teacher's) and the resource `main`, so lessons always share the teacher's time (see Resources). No categories and no waiting list. Days off and special hours apply to the teacher, or to chosen lessons with `service_ids`. Publishing needs a lesson, and at least one day and one time of the teacher (`availability_incomplete`) only while a lesson has no schedule of its own: when every lesson carries its own `days` and `times` the availability can stay empty. The MCP setup tools do not edit this mode yet (`unsupported_mode`); the impact tool works.

The booking editor in `frontend` has the same shape. `@internal/booking` (`frontend/packages/booking`) holds the React-free logic: `modeFor(field.mode)` returns the module of a mode (`services/`, `individual/`), and a mode builds the form values from a stored question, makes a blank service or lesson, converts the values to the API input, compiles the question for the preview and contributes its part of the validation. What does not depend on the mode (rules, days off, durations, the monthly offer, schedule values) is in `shared/`, so a new rule for every mode goes in `shared/rules.ts` and in `rules-section.tsx` and touches no mode. The React flow of each mode (`Flow`, `ItemFields`, extra rules such as the waiting list) is in `frontend/app/routes/forms/components/booking-modes/<mode>` and registered in `booking-modes/modes.ts`; the shared editor components never test the mode, they render what the mode contributes. A new mode needs a module in the package and a flow in the app, one entry in each registry.

## Resources

The time belongs to a **resource**, not to a service. A service is its own resource unless its definition (compiled by a mode, never typed by the owner) names another one with `resource_key`, so today `resource_key == service_key` everywhere and nothing is shared. Services that name the same resource share its hours: the first booking takes the row, no other service can book that hour while it holds a place (a service with capacity can keep adding places of its own class), and the row goes to another service once it is free again. The hours and durations around a booking of another service are blocked too, with the buffer: `FreeSlots` turns the rows held by other services of the resource into the time `Slots` must stay out of.

A resource that is named explicitly (a mode's compiled `resource_key`, as opposed to a service that is its own resource) is also **exclusive**: one teacher cannot be in two places, so a booking blocks the hours it covers for every lesson, including a class of the same lesson that still has room. The engine hides what overlaps, and the database refuses it as the last guard: `appointment_slots.ends_at` is kept by `Reserve`, and a partial exclusion constraint (`btree_gist`) rejects two booked rows of the same form and resource whose time ranges overlap. `Reserve` turns that violation, and a deadlock between two overlapping bookings made at once, into `Full`. Services that are their own resource keep their old behaviour: the constraint does not apply to them.

## Booking

A booking is created **inside** `Forms::SubmitResponse`, in the same transaction as the response. There is no separate public "create appointment" endpoint, because the visitor's name and email are answers to the form's own questions.

1. Turnstile and the existing rate limits run first.
2. Each requested session is reserved with `UPDATE appointment_slots SET booked = booked + 1 WHERE id = ? AND (capacity IS NULL OR booked < capacity)`. One affected row means reserved, zero means full and the whole request fails.
3. Several days are reserved in `starts_at` order inside one transaction: all or nothing, no deadlocks.
   A request can also hold several times on the same day. They must not overlap each other (the buffer between sessions counts) and, with a per-day limit, every one of them counts towards it; otherwise the whole request fails as unavailable. The public form refuses an overlapping pick before sending it, with a message.
   The per-day limit spans several slot rows, so no row lock covers it: before reserving, `Book.call` takes a transaction-level advisory lock per form and local day (in date order) and counts the day again; a booking that would go over it fails as `slot_full`, like a taken slot.
4. The appointment starts as `confirmed` (automatic approval) or `pending` (manual approval, with an expiry). Pending appointments hold their slot.
5. Cancelling or expiring releases the slot with `booked = GREATEST(booked - 1, 0)`.

## Monthly plan with an allowance

A monthly offer is, by default, a weekly pattern: the visitor picks a month, some weekdays and one time, and every matching date of the month is booked for the monthly price. The owner can turn it into a **plan with an allowance** with `monthly.sessions` (1 to 31) and `monthly.per` (`month`, the default, or `week`, then 1 to 7): "5 massages a month" or "1 lesson a week".

With an allowance the visitor picks the days he wants, each with its own time, up to the allowance: `{service, monthly: {month, sessions: [{date, time}]}}`. At most `sessions` in the month, or at most `sessions` in each Monday-Sunday week of it. Each pick is checked like a single session (`FreeSlots` with the monthly duration, min notice, buffer, days off), the month must be this or the next one and a day in the past is refused; one pick that is taken refuses the whole plan. The price is the whole monthly price whatever the number of sessions chosen. One appointment per picked day, like the weekday pattern, so cancelling, reminders, e-mails and the agenda work unchanged. An offer without `sessions` keeps the weekday pattern exactly as before.

In the editor the number sits under the monthly price ("Included sessions (optional)"), with a "per month / per week" choice once there is a number; leaving it empty removes the allowance, because a service is saved whole. The service card reads "Monthly 120 € · 5 per month".

In the public form a monthly offer with an allowance shows the month chips (this month, next month) and the same calendar and time grid as single sessions, locked to that month and with a counter ("3 of 5 sessions included"). `toggleSession` takes the allowance as a cap and answers `limit` when a pick would go over it, with the message of the period; tapping a chosen time removes it and frees its place, and changing the month clears the picks. The sessions of a plan count for the overlap check against the other services of the booking like any other session, and the waiting list is not offered inside a plan. The review and the bar list the picked days and show the plan price once.

The slots endpoint answers for the monthly duration when asked with `monthly=1` (`only: [Durations.monthly_minutes(service)]`, the same query `Book.cast_plan` makes): a time is offered only if the monthly duration fits, with that duration alone in `durations`, and the waiting list's `full` is left out. Any other value of `monthly`, or a service without a monthly offer, is a 422 `invalid_monthly`. The public form's plan picker asks with it, so the visitor sees only times the server accepts; the server still has the last word.

## Several services in one booking

An owner can switch on the rule `multiple_services` (off by default, both modes). The answer is then `{items: [{service, sessions | monthly}, ...]}`, one item per service (at most 5); the legacy `{service, sessions, monthly?}` stays valid, with the rule on or off, and is the only shape accepted while the rule is off or for a waiting list claim. A request is still one response, one `group_key`, one approval, verification or expiry decision, one reminder and one e-mail; cancelling a booking cancels every session, and `scope=remaining` only the sessions of the same service.

Every item is cast on its own with the rules of its service, then the whole request is checked as one person's time: sessions of different services may not overlap (the buffer counts) and every session of a day counts towards `max_per_day`. The group total is the sum of the items (each priced as before, a monthly item at its monthly price), written on every row next to that row's own price and duration. The receipt, the e-mails and the manage page show each service and the length of each session.

An `unavailable` refusal keeps its body (`errors.answers.<booking_field_id>: ["unavailable"]`) and adds `details.<booking_field_id>` with the `service` id and, when the refusal is about one session, its `date` and `time`: the first pick that is taken, or the later of two services that overlap. A day that is over `max_per_day` blames no service and carries no `details`. The public form uses it to name the service.

Limits: with the rule on every priced service must use one currency and the question cannot have categories; the waiting list stays per service.

## Approval and deadlines

The owner chooses automatic or manual approval per form. With manual approval, an unanswered request is accepted or declined automatically after a configurable time (default: declined). A recurring job resolves expired requests every minute and sends reminders every five minutes; there is no job per appointment and no lazy evaluation on read.

## Publishing and versions

Publishing stores one snapshot of the form. The public form and the validation of submissions read that snapshot through `Forms::PublicDefinition`. Editing creates a draft that does not affect visitors until it is published. A submission made against an older version is refused with `409 form_changed`. Existing appointments follow the new version; the owner sees the impact before publishing.

## Time

Each owner has a time zone (`users.time_zone`, IANA), Europe/Lisbon until the owner chooses another one in the account page. It decides how times are shown to the owner (agenda, e-mails) and the zone a new booking question starts with; whatever is stored is UTC. A copy is kept inside the published configuration, so changing the account time zone never moves existing availability: the zone of a form is what its wall-clock times ("19:30") mean. Slots are stored in UTC. The past is fact (slots and appointments); the future is a projection of the published configuration, expanded by one pure service.

The visitor reads the public form in a view zone: the zone of the form unless they pick another one in the control next to "Horas em", which is remembered in the browser (`localStorage`, one global key) and applied on the next form. Only the display converts: each slot is read from its `starts_at`, so a slot belongs to the day it has in the view zone and the month asked from the slots endpoint grows by the days the offset needs on both ends. The answer keeps the date and time of the form zone, which is what the server reads, and the view zone travels as `client_time_zone`, which the confirmation e-mails and the manage page use. A weekday pattern is defined by weekday and time in the form zone, so it is not converted and the form says so.

## Notifications and email

Email is limited by the platform's free quota (`MailBudget`). When the quota is exhausted the in-platform notification still happens and email is skipped, so the owner is never blocked. Notifications are dispatched from a dedicated `notifications` queue, with immediate delivery after commit and a sweep as the safety net. Web Push is an additional channel, not a replacement. It needs three variables, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (generate the pair once with `WebPush.generate_key` in a Rails console) and `VAPID_SUBJECT` (a `mailto:` or `https:` contact); without all three the channel stays off and nothing fails. The push carries only the event kind and a notification id, never a name or an email, and a subscription the push service reports as gone (404 or 410) is deleted.

## Known limits

- Editing the booking question rewrites the whole `fields` array under a lock, so two tabs editing the same form can overwrite each other.
- Availability is only as complete as what the owner configures in Kurz.
- The waiting list has no duration of its own: whoever claims a freed place books it with the length that time was booked with.
- The impact preview does not flag a duration the owner removed while upcoming appointments still use it.
