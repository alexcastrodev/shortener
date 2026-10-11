# Appointments (decision record)

Appointments let a form owner offer bookable services and let visitors book them from the public form. Everything is free: Kurz has no payments and no plans, so prices are informational text only.

This page records the decisions the implementation follows. It is open to every account: there is no feature flag or allow-list (they existed only while it was being built).

## Scope

- Kurz is the **only source of availability**. It does not read or write the owner's other calendars.
- One `booking` question per form. Its configuration (categories, services, weekly availability, exceptions, rules) lives inside `forms.fields` with stable ids, and it is validated like every other field.
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

The visitor picks a duration together with the time. Each session is stored with its own duration and price in the appointment snapshot, and the total is the sum of the prices of the chosen durations. `appointment_slots.duration` remembers how long the booking on that time lasts: a full time blocks the times its length covers (plus the buffer), a time with a long booking stops offering the durations that would run into it, and a partly booked time only offers the duration it was opened with.

## Resources

The time belongs to a **resource**, not to a service. A service is its own resource unless its definition (compiled by a mode, never typed by the owner) names another one with `resource_key`, so today `resource_key == service_key` everywhere and nothing is shared. Services that name the same resource share its hours: the first booking takes the row, no other service can book that hour while it holds a place (a service with capacity can keep adding places of its own class), and the row goes to another service once it is free again. The hours and durations around a booking of another service are blocked too, with the buffer: `FreeSlots` turns the rows held by other services of the resource into the time `Slots` must stay out of.

## Booking

A booking is created **inside** `Forms::SubmitResponse`, in the same transaction as the response. There is no separate public "create appointment" endpoint, because the visitor's name and email are answers to the form's own questions.

1. Turnstile and the existing rate limits run first.
2. Each requested session is reserved with `UPDATE appointment_slots SET booked = booked + 1 WHERE id = ? AND (capacity IS NULL OR booked < capacity)`. One affected row means reserved, zero means full and the whole request fails.
3. Several days are reserved in `starts_at` order inside one transaction: all or nothing, no deadlocks.
4. The appointment starts as `confirmed` (automatic approval) or `pending` (manual approval, with an expiry). Pending appointments hold their slot.
5. Cancelling or expiring releases the slot with `booked = GREATEST(booked - 1, 0)`.

## Approval and deadlines

The owner chooses automatic or manual approval per form. With manual approval, an unanswered request is accepted or declined automatically after a configurable time (default: declined). A recurring job resolves expired requests every minute and sends reminders every five minutes; there is no job per appointment and no lazy evaluation on read.

## Publishing and versions

Publishing stores one snapshot of the form. The public form and the validation of submissions read that snapshot through `Forms::PublicDefinition`. Editing creates a draft that does not affect visitors until it is published. A submission made against an older version is refused with `409 form_changed`. Existing appointments follow the new version; the owner sees the impact before publishing.

## Time

Each owner has a time zone (`users.time_zone`, IANA). A copy is kept inside the published configuration, so changing the account time zone never moves existing availability. Slots are stored in UTC. The past is fact (slots and appointments); the future is a projection of the published configuration, expanded by one pure service.

## Notifications and email

Email is limited by the platform's free quota (`MailBudget`). When the quota is exhausted the in-platform notification still happens and email is skipped, so the owner is never blocked. Notifications are dispatched from a dedicated `notifications` queue, with immediate delivery after commit and a sweep as the safety net. Web Push is an additional channel, not a replacement. It needs three variables, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (generate the pair once with `WebPush.generate_key` in a Rails console) and `VAPID_SUBJECT` (a `mailto:` or `https:` contact); without all three the channel stays off and nothing fails. The push carries only the event kind and a notification id, never a name or an email, and a subscription the push service reports as gone (404 or 410) is deleted.

## Known limits

- Editing the booking question rewrites the whole `fields` array under a lock, so two tabs editing the same form can overwrite each other.
- Availability is only as complete as what the owner configures in Kurz.
- The waiting list has no duration of its own: whoever claims a freed place books it with the length that time was booked with.
- The impact preview does not flag a duration the owner removed while upcoming appointments still use it.
