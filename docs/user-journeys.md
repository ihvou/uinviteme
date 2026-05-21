# User Journey Scenarios

This document captures the main success paths for the product actors and system. It complements the [Architecture](architecture.md), [README](../README.md), [Production MVP Tasks](../tasks.md), [Agent Notes](../AGENTS.md), and [Claude Notes](../CLAUDE.md).

## Actors

| Actor | Goal |
|---|---|
| Host | Publish availability, screen invitees, accept good requests, and manage date safety. |
| Visitor / invitee | Request a date slot from a public invite page, verify phone by SMS, and optionally link Telegram for updates/discovery. |
| Trusted contact | Receive emergency or missed-check-in SMS alerts. |
| System | Enforce auth, privacy, RLS, workflow state, and notifications. |
| Telegram bot | Future interaction surface for host administration, visitor accepted-invite notifications, discovery, and Safety Pack check-ins. |

## Scenario 1: Host Onboards And Publishes A Public Invite Page

| Step | Actor | Interaction | System result |
|---:|---|---|---|
| 1 | Host | Opens `/auth?mode=signup` and creates an account. | Supabase Auth creates a user and profile trigger creates a profile row. |
| 2 | Host | Opens Settings and adds display name, handle, city, bio, and public profile toggle. | Profile becomes discoverable at `/:handle`. |
| 3 | Host | Opens Schedule and adds an availability slot. | Slot is stored under the host schedule. |
| 4 | Host | Activates schedule. | Public invite page can show the next matching slot dates. |
| 5 | Host | Enables screening questions and requirements. | Screening config controls the visitor wizard. |
| 6 | System | Shows public profile link on dashboard. | Host can share the link in dating apps or social DMs. |

Success condition: a signed-out visitor can open `/:handle` and see host profile, availability, tags, and an Invite button.

Current caveat: dashboard token links are still unreliable; public profile links work.

## Scenario 2: Visitor Requests A Date From A Public Profile

| Step | Actor | Interaction | System result |
|---:|---|---|---|
| 1 | Visitor | Opens host public invite link. | App reads public profile, active schedule, active slots, and screening config. |
| 2 | Visitor | Chooses a slot. | Invite wizard opens for that slot/date. |
| 3 | Visitor | Enters name, phone, optional email, and social handle. | Client validates required contact fields. |
| 4 | Visitor | Answers enabled screening questions. | Answers are collected into the invite payload. |
| 5 | Visitor | Adds an optional note and submits. | App inserts invitee and invite records. |
| 6 | System | Shows success message. | Host dashboard shows a pending invite. |

Success condition: the visitor sees "Request Sent" and the host sees one pending invite.

Current caveat: submission is still direct browser writes to Supabase. Before public launch, this should move to a `submit-invite` Edge Function with CAPTCHA, server validation, and moderation.

## Scenario 3: Host Reviews And Accepts An Invite

Status: Implemented, with idempotency hardening still planned.

| Step | Actor | Interaction | System result |
|---:|---|---|---|
| 1 | Host | Opens `/invites`. | App loads pending invites owned by the host schedule. |
| 2 | Host | Reviews visitor identity, contact, slot, and note. | Host decides whether to accept or decline. |
| 3 | Host | Clicks Accept. | `accept-invite` marks invite accepted, creates or finds the date, and notifies linked visitor in Telegram. |
| 4 | System | Removes invite from pending queue. | Date appears under `/dates`. |
| 5 | Host | Opens date detail. | Date detail shows invitee contact, screening responses, slot info, and editable date fields. |

Success condition: exactly one accepted invite creates exactly one date.

Current caveat: acceptance is now server-side through `accept-invite`, but stronger idempotency still needs a transactional RPC or database uniqueness for dates by invite.

## Scenario 4: Host Activates Safety Pack

| Step | Actor | Interaction | System result |
|---:|---|---|---|
| 1 | Host | Opens `/dates/:dateId/safety`. | App loads or creates a Safety Pack draft. |
| 2 | Host | Reviews trusted-contact share text and check-in timing. | System shows check-in and escalation time. |
| 3 | Host | Activates Safety Pack. | Safety Pack status becomes active. |
| 4 | Host | Uses preview actions. | UI shows All good, Call me, and Emergency actions. |
| 5 | Trusted contact | Future: receives emergency or missed-check-in alert. | Future backend sends SMS only when escalation is needed. |

Success condition: Safety Pack is active and visible to the host.

Current caveat: activation is UI/database state only. Real SMS/Telegram reminders and escalation require Edge Functions plus provider integration.

## Scenario 5: Telegram Bot Extension

Status: Partially implemented.

| Step | Actor | Interaction | System result |
|---:|---|---|---|
| 1 | Host | Starts the Telegram bot and links account. | Bot stores Telegram chat ID against host identity after verification. |
| 2 | System | New invite arrives. | Edge Function sends Telegram notification with summary. |
| 3 | Host | Taps Accept or Decline inline button. | Bot webhook calls trusted accept/decline logic. |
| 4 | System | Date is created or invite declined. | Bot confirms action and app state updates. |
| 5 | Host | Activates Safety Pack or taps check-in action. | Bot can act as notification channel for safety workflow. |

Success condition: Telegram becomes an additional host control surface without bypassing backend validation.

Important design rule: the bot should call the same trusted backend functions as the web app, not duplicate workflow logic in the browser.

## To Be Implemented Scenarios

These scenarios describe the next notification and Telegram phases. They are future-state paths, not current production behavior.

### Scenario 6: Visitor Submits Invite On Web With SMS Verification

Status: Partially implemented with mock SMS verification.

Telegram is not required before invite submission. The visitor should be able to complete the web invite flow with SMS-verified phone only.

| Step | Actor | Interaction | System result |
|---:|---|---|---|
| 1 | Visitor | Opens `/:handle` or `/i/:token`. | App loads the host profile, active schedule, available slot, and screening config. |
| 2 | Visitor | Chooses a slot and enters contact details. | Web wizard collects name, phone, optional Instagram/email/Telegram username, answers, and note. |
| 3 | Visitor | Requests SMS verification code. | Current mock: web wizard shows/sends test code `123456`. Future: `send-phone-otp` sends an OTP to UAE, Turkey, or Singapore phone number via the configured SMS provider. |
| 4 | Visitor | Enters OTP in the web wizard. | Current mock: correct code marks phone verified locally and stores `invitees.phone_verified = true`. Future: `verify-phone-otp` marks the phone challenge verified server-side. |
| 5 | Visitor | Submits invite. | Current flow still creates invitee + invite from the browser. Future: `submit-invite` validates slot/date/screening/phone verification and creates invitee + invite server-side. |
| 6 | System | Checks duplicate rule. | One active pending invite per verified phone per host is enforced. |
| 7 | System | Shows success screen. | Visitor sees confirmation plus "Enable Telegram notifications to know when your invite is accepted." |

Success condition: a visitor can submit a real invite without Telegram, but cannot submit without verified phone or create duplicate pending invites for the same host.

Current caveat: phone verification is mocked in the web app and must move server-side before public launch.

### Scenario 7: Visitor Enables Telegram Notifications After Invite

Status: Implemented for web-host acceptance.

| Step | Actor | Interaction | System result |
|---:|---|---|---|
| 1 | Visitor | Clicks "Enable Telegram notifications" after invite submission. | App opens a Telegram deep link with an invite-specific start payload. |
| 2 | Visitor | Starts the bot. | `telegram-webhook` validates Telegram's secret header and links the Telegram chat to the invite/invitee. |
| 3 | System | Host later accepts invite. | `accept-invite` creates/finds the date and sends accepted-invite notification when Telegram is linked. |
| 4 | Bot | Sends accepted notification to visitor. | Visitor receives acceptance message with host-approved contact channel. |

Current implementation covers steps 1-4 when the host accepts from the web app. Remaining work: host Telegram account linking and Telegram-side accept/decline.

### Scenario 8: Host Administers Invites In Telegram

Status: To be implemented.

| Step | Actor | Interaction | System result |
|---:|---|---|---|
| 1 | Host | Starts bot from web Settings or bot `/start`. | Telegram account is linked to the host user. |
| 2 | System | New invite arrives. | Host gets Telegram message with invite summary and inline Accept/Decline buttons. |
| 3 | Host | Taps Accept or Decline. | Bot callback calls trusted `accept-invite` or `decline-invite` backend logic. |
| 4 | System | Updates invite lifecycle. | Pending invite is removed; accepted invite becomes a date; opted-in visitor is notified. |
| 5 | Host | Uses bot menu to disable/enable invite page. | `public_profile_enabled` is updated and `/:handle` becomes hidden or visible. |

Success condition: a linked host can review and act on invites from Telegram without opening the web dashboard.

### Scenario 9: Host Contact Sharing On Acceptance

Status: Partially implemented.

| Step | Actor | Interaction | System result |
|---:|---|---|---|
| 1 | Host | Sets accepted-contact method in profile. | Host chooses `telegram` or `instagram`; host phone is not shared by default. |
| 2 | Host | Accepts invite. | `accept-invite` resolves the host-approved contact payload. |
| 3 | System | Notifies opted-in visitor. | Telegram notification includes only the selected host contact method. |

Success condition: accepted invite notifications share exactly the contact method the host selected.

Current caveat: Instagram contact sharing is usable when the host selects Instagram and has a handle. Telegram contact sharing is still minimal until host Telegram linking exists.

### Scenario 10: Safety Pack Telegram Check-In And SMS Emergency Alert

Status: To be implemented.

| Step | Actor | Interaction | System result |
|---:|---|---|---|
| 1 | Host | Activates Safety Pack. | Backend schedules Telegram check-in reminder. |
| 2 | Bot | Sends check-in reminder at configured time. | Host sees All good, Call me, and Emergency actions in Telegram. |
| 3 | Host | Taps All good. | Safety Pack is marked checked-in; no trusted-contact SMS is sent. |
| 4 | Host | Taps Emergency, or misses check-in after grace period. | Backend sends SMS alert to trusted contact. |
| 5 | System | Logs delivery outcome. | Notification delivery is recorded for audit/retry. |

Success condition: host receives Telegram check-in, and trusted contact receives SMS only for emergency or missed check-in.

### Scenario 11: Visitor Browses Nearby Profiles In Telegram

Status: Implemented as a Telegram MVP with mock phone verification.

| Step | Actor | Interaction | System result |
|---:|---|---|---|
| 1 | Visitor | Clicks "View profiles nearby" after invite flow or starts Browse in bot. | Bot starts discovery. |
| 2 | System | Chooses discovery location. | Uses first viewed/invited host city as initial context. |
| 3 | Visitor | Optionally shares Telegram native location or sends city manually. | Bot updates discovery location and ranking context. |
| 4 | Bot | Shows one profile at a time. | Only public, active, discovery-enabled profiles are eligible. |
| 5 | Visitor | Taps Invite or Skip. | Invite opens the web invite flow; Skip records discovery event and shows next profile. |
| 6 | Visitor | First invites from Telegram discovery before phone validation. | Bot runs mock phone verification in Telegram before sending the selected invite page link. |

Success condition: visitor can browse public active profiles one by one in Telegram, with invite actions returning to the web flow.

Important rule: discovery can start before phone verification, but the first Telegram-origin invite link is gated until that visitor verifies a phone number in Telegram.

Current caveat: Telegram phone verification uses test code `123456`; production still needs provider-backed SMS OTP and the future server-side `submit-invite` function to trust the verification end to end.

Discovery eligibility:

```txt
public_profile_enabled = true
schedule.is_active = true
discovery_enabled = true
```

## Regression Journey

The current hosted regression path is:

1. Landing page renders.
2. Protected route redirects to auth.
3. Host signs up.
4. Host configures profile and schedule.
5. Host enables a screening question.
6. Visitor submits a public invite.
7. Host accepts invite.
8. Date appears.
9. Safety Pack activates.

This path was verified on Cloudflare Pages after independent deployment. See [README](../README.md#regression-checklist) for the operational checklist.

## Related Docs

- [Architecture](architecture.md)
- [Production MVP Tasks](../tasks.md)
- [README](../README.md)
- [Agent Notes](../AGENTS.md)
- [Claude Notes](../CLAUDE.md)
