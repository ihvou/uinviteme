# User Journey Scenarios

This document captures the main success paths for the product actors and system. It complements the [Architecture](architecture.md), [README](../README.md), [Production MVP Tasks](../tasks.md), [Agent Notes](../AGENTS.md), and [Claude Notes](../CLAUDE.md).

## Actors

| Actor | Goal |
|---|---|
| Host | Publish availability, screen invitees, accept good requests, and manage date safety. |
| Visitor / invitee | Request a date slot from a public invite page, verify phone by SMS, and optionally link Telegram for updates/discovery. |
| Trusted contact | Receive emergency or missed-check-in SMS alerts. |
| System | Enforce auth, privacy, RLS, workflow state, and notifications. |
| Telegram bot | Interaction surface for host invite administration, visitor accepted-invite notifications, discovery, and future Safety Pack check-ins. |

Status labels:

- Implemented: available in the current product.
- Partially implemented: usable MVP exists, but a production blocker remains.
- To be implemented: tracked in [Production MVP Tasks](../tasks.md).

## Scenario 1: Host Onboards And Publishes A Public Invite Page

Status: Implemented, with token-link caveat still tracked in tasks.

| Step | Actor | Interaction | System result |
|---:|---|---|---|
| 1 | Host | Opens `/auth?mode=signup` and creates an account with email/password or Google. | Supabase Auth creates a user and profile trigger creates a profile row with OAuth name/photo metadata when available. |
| 2 | Host | Opens Settings and adds display name, handle, city, bio, and public profile toggle. | Profile becomes discoverable at `/:handle`. |
| 3 | Host | Opens Schedule and adds an availability slot. | Slot is stored under the host schedule. |
| 4 | Host | Activates schedule. | Public invite page can show the next matching slot dates. |
| 5 | Host | Enables screening questions and requirements. | Screening config controls the visitor wizard. |
| 6 | System | Shows public profile link on dashboard. | Host can share the link in dating apps or social DMs. |

Success condition: a signed-out visitor can open `/:handle` and see host profile, availability, tags, and an Invite button.

Current caveat: dashboard token links are still unreliable; public profile links work.

## Scenario 2: Visitor Requests A Date From A Public Profile

Status: Partially implemented. Submission now uses trusted `submit-invite`; real SMS activation, CAPTCHA, and deeper screening/moderation hardening are still tracked in tasks.

| Step | Actor | Interaction | System result |
|---:|---|---|---|
| 1 | Visitor | Opens host public invite link. | App reads public profile, active schedule, active slots, and screening config. |
| 2 | Visitor | Chooses a slot. | Invite wizard opens for that slot/date. |
| 3 | Visitor | Enters name, phone, optional email, and social handle. | Client validates required contact fields; `submit-invite` re-checks required fields server-side. |
| 4 | Visitor | Answers enabled screening questions. | Answers are collected into the invite payload. |
| 5 | Visitor | Adds an optional note and submits. | App calls `submit-invite`, which validates the schedule, slot, invite link/public profile, phone verification, and duplicate pending invite rule before creating invitee and invite records. |
| 6 | System | Shows success message. | Host dashboard shows a pending invite. |

Success condition: the visitor sees "Request Sent" and the host sees one pending invite.

Current caveat: submission is server-side now, but public launch still needs CAPTCHA, atomic one-time link consumption, stronger target-date validation, and server-side screening/moderation enforcement.

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

Status: Partially implemented as UI/database state; real check-ins and Twilio SMS escalation are to be implemented.

| Step | Actor | Interaction | System result |
|---:|---|---|---|
| 1 | Host | Opens `/dates/:dateId/safety`. | App loads or creates a Safety Pack draft. |
| 2 | Host | Reviews trusted-contact share text and check-in timing. | System shows check-in and escalation time. |
| 3 | Host | Activates Safety Pack. | Safety Pack status becomes active. |
| 4 | Host | Uses preview actions. | UI shows All good, Call me, and Emergency actions. |
| 5 | Trusted contact | Future: receives emergency or missed-check-in alert. | Future backend sends Twilio SMS only when escalation is needed. |

Success condition: Safety Pack is active and visible to the host.

Current caveat: activation is UI/database state only. Real SMS/Telegram reminders and escalation require Edge Functions plus provider integration.

## Scenario 5: Telegram Bot Extension

Status: Partially implemented: host invite administration is implemented; Safety Pack bot actions are future work.

| Step | Actor | Interaction | System result |
|---:|---|---|---|
| 1 | Host | Creates a Telegram link in Settings and starts the bot. | Bot stores Telegram chat ID against host identity after token verification. |
| 2 | System | New invite arrives. | `submit-invite` sends Telegram notification with summary. |
| 3 | Host | Taps Accept or Decline inline button. | Bot webhook calls trusted accept/decline logic. |
| 4 | System | Date is created or invite declined. | Bot confirms action and app state updates. |
| 5 | Host | Activates Safety Pack or taps check-in action. | Bot can act as notification channel for safety workflow. |

Success condition: Telegram becomes an additional host control surface without bypassing backend validation.

Important design rule: the bot should call the same trusted backend functions as the web app, not duplicate workflow logic in the browser.

## Notification And Telegram Phase Scenarios

These scenarios describe the notification, SMS, and Telegram phases. Each scenario states whether the current behavior is implemented, partially implemented, or still future work.

### Scenario 6: Visitor Submits Invite On Web With SMS Verification

Status: Partially implemented. The web wizard uses trusted `submit-invite`; mock phone verification works locally, Twilio-backed SMS verification is available when Twilio mode is enabled, and a server-only static test code can be enabled for QA.

Telegram is not required before invite submission. The visitor should be able to complete the web invite flow with SMS-verified phone only.

| Step | Actor | Interaction | System result |
|---:|---|---|---|
| 1 | Visitor | Opens `/:handle` or `/i/:token`. | App loads the host profile, active schedule, available slot, and screening config. |
| 2 | Visitor | Chooses a slot and enters contact details. | Web wizard collects name, phone, optional Instagram/email/Telegram username, answers, and note. |
| 3 | Visitor | Requests SMS verification code. | Current default: web wizard shows/sends test code `123456`. With Twilio mode enabled: `send-phone-otp` sends an OTP to UAE, Turkey, Singapore, or Ukraine phone number via Twilio Verify. If `PHONE_VERIFICATION_TEST_CODE` is configured server-side, unsupported/fake E.164 numbers create a no-SMS test challenge instead. |
| 4 | Visitor | Enters OTP in the web wizard. | Current default: correct test code marks phone verified locally. With Twilio mode enabled: `verify-phone-otp` checks Twilio Verify and marks the phone challenge verified server-side. If `PHONE_VERIFICATION_TEST_CODE` is configured, that code is also accepted as a QA override. |
| 5 | Visitor | Submits invite. | `submit-invite` validates slot/date/link, re-checks mock code or approved Twilio verification reference, enforces one pending invite per verified phone per host, and creates invitee + invite server-side. |
| 6 | System | Checks duplicate rule. | One active pending invite per verified phone per host is enforced. |
| 7 | System | Shows success screen. | Visitor sees confirmation plus "Enable Telegram notifications to know when your invite is accepted." |

Success condition: a visitor can submit a real invite without Telegram, but cannot submit without verified phone or create duplicate pending invites for the same host.

Current caveat: Twilio-backed mode needs Twilio secrets, remote migrations, deployed phone verification functions, and production activation. The static server-side test code is for manual QA only and should never be exposed as a frontend variable.

### Scenario 7: Visitor Enables Telegram Notifications After Invite

Status: Implemented for web-host acceptance.

| Step | Actor | Interaction | System result |
|---:|---|---|---|
| 1 | Visitor | Clicks "Enable Telegram notifications" after invite submission. | App opens a Telegram deep link with an invite-specific start payload. |
| 2 | Visitor | Starts the bot. | `telegram-webhook` validates Telegram's secret header and links the Telegram chat to the invite/invitee. |
| 3 | System | Host later accepts invite. | `accept-invite` creates/finds the date and sends accepted-invite notification when Telegram is linked. |
| 4 | Bot | Sends accepted notification to visitor. | Visitor receives acceptance message with host-approved contact channel. |

Current implementation covers steps 1-4 when the host accepts from the web app or Telegram.

### Scenario 8: Host Administers Invites In Telegram

Status: Implemented as Telegram admin MVP.

| Step | Actor | Interaction | System result |
|---:|---|---|---|
| 1 | Host | Creates a Telegram link from web Settings and opens it. | `create-telegram-link` creates a short-lived token; `/start host_<token>` links Telegram chat to the host user. |
| 2 | System | New invite arrives. | Host gets Telegram message with invite summary and inline Accept/Decline buttons. |
| 3 | Host | Taps Accept or Decline. | Bot callback reuses trusted `accept-invite` backend logic for both decisions. |
| 4 | System | Updates invite lifecycle. | Pending invite is removed; accepted invite becomes a date; opted-in visitor is notified. |
| 5 | Host | Uses `/start`, `/settings`, `/admin`, or the post-link menu to toggle availability. | Bot updates `public_profile_enabled` and `discovery_enabled`; the web Settings page reflects the same state. |

Success condition: a linked host can review invites, accept/decline them, and quickly hide or show public/discovery availability from Telegram without opening the web dashboard.

### Scenario 9: Host Contact Sharing On Acceptance

Status: Implemented as MVP.

| Step | Actor | Interaction | System result |
|---:|---|---|---|
| 1 | Host | Sets accepted-contact method in profile. | Host chooses `telegram` or `instagram`; host phone is not shared by default. |
| 2 | Host | Accepts invite. | `accept-invite` resolves the host-approved contact payload. |
| 3 | System | Notifies opted-in visitor. | Telegram notification includes only the selected host contact method. |

Success condition: accepted invite notifications share exactly the contact method the host selected.

Current caveat: Telegram contact sharing requires the host to link Telegram first; otherwise the visitor gets fallback copy saying the host can message them there.

### Scenario 10: Safety Pack Telegram Check-In And SMS Emergency Alert

Status: To be implemented with Telegram check-ins and Twilio SMS alerts.

| Step | Actor | Interaction | System result |
|---:|---|---|---|
| 1 | Host | Activates Safety Pack. | Backend schedules Telegram check-in reminder. |
| 2 | Bot | Sends check-in reminder at configured time. | Host sees All good, Call me, and Emergency actions in Telegram. |
| 3 | Host | Taps All good. | Safety Pack is marked checked-in; no trusted-contact SMS is sent. |
| 4 | Host | Taps Emergency, or misses check-in after grace period. | Backend sends Twilio SMS alert to trusted contact. |
| 5 | System | Logs delivery outcome. | Notification delivery is recorded for audit/retry. |

Success condition: host receives Telegram check-in, and trusted contact receives SMS only for emergency or missed check-in.

### Scenario 11: Visitor Browses Nearby Profiles In Telegram

Status: Implemented as a Telegram MVP with profile photos, readable cards, inline slot selection, and Twilio-backed phone verification.

| Step | Actor | Interaction | System result |
|---:|---|---|---|
| 1 | Visitor | Clicks "View profiles nearby" after invite flow or starts Browse in bot. | Bot starts discovery. |
| 2 | System | Chooses discovery location. | Uses first viewed/invited host city as initial context. |
| 3 | Visitor | Optionally shares Telegram native location or sends city manually. | Bot updates discovery location and ranking context. |
| 4 | Bot | Shows one profile at a time. | Only public, active, discovery-enabled profiles are eligible. |
| 5 | Visitor | Taps Invite or Skip. | Invite opens the web invite flow; Skip records discovery event and shows next profile. |
| 6 | Visitor | First invites from Telegram discovery before phone validation. | Bot sends a Twilio Verify SMS, checks the reply code, and only then sends the selected invite page link. |

Success condition: visitor can browse public active profiles one by one in Telegram, with invite actions returning to the web flow.

Important rule: discovery can start before phone verification, but the first Telegram-origin invite link is gated until that visitor verifies a phone number in Telegram.

Current caveat: Telegram still hands the verified visitor back to the web invite flow by URL; future work should connect Telegram-origin invite creation to the trusted `submit-invite` flow end to end.

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
