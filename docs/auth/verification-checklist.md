# Manual verification checklist — auth, onboarding, SSO

There is no Playwright in this repo and it should not be reintroduced:
`playwright test` spawns its own Next dev server, which is too RAM-heavy on the
primary dev machine. UI is verified through the **chrome-devtools MCP server**
against a browser that is already running, against a dev server the developer
starts themselves.

Everything that can be tested without a server already is —
`pnpm typecheck && pnpm lint && pnpm test` covers the schemas, the OIDC/SAML
discriminated union, the discovery probe, onboarding step arithmetic, slugify,
and email rendering. What follows is what genuinely needs a browser or a live
Better Auth handler.

## Before you start

**Unset `DEV_DISABLE_AUTH`.** It forces every session to a seeded user with
`role: "admin"` and bypasses the proxy and every `requireX` helper, so with it
on you are not testing auth at all. It also does not mint a real Better Auth
cookie, so anything reading Better Auth's own session store (e.g.
`/account/sessions`) behaves differently.

Leave `RESEND_API_KEY` unset and read verification links out of the server
console.

---

## Auth pages

- [ ] `/sign-in` — password and SSO modes toggle; the Google button appears only
      when `GOOGLE_CLIENT_ID` **and** `GOOGLE_CLIENT_SECRET` are set
- [ ] Bad email → inline error under the field with `aria-invalid="true"`, no
      toast
- [ ] Wrong password → a form-level message that stays on screen; 401 copy does
      **not** distinguish unknown-email from wrong-password
- [ ] Unverified account → 403 path offers an inline "resend verification" link
- [ ] Password reveal toggles `type` between `password` and `text`
- [ ] `/sign-in?next=https://evil.example.com` → the off-site target is dropped,
      not followed *(open-redirect regression)*
- [ ] `/sign-up` — mismatch reports on **confirm password**, not password;
      terms unchecked blocks submit; strength meter moves as you type
- [ ] `/reset-password?error=INVALID_TOKEN` and `/reset-password` with no token
      → the expired-link page, **not** a form
- [ ] `/reset-password?token=…` → the form renders
- [ ] `/forgot-password` with an unknown address → same "check your inbox"
      response as a known one *(enumeration regression)*
- [ ] `/two-factor` → backup-code toggle switches the label and `inputMode`
- [ ] `/accept-invitation/{bad-id}` → "This invitation doesn't exist"
- [ ] Every page: both themes, ≥`lg` and mobile widths, full keyboard tab
      order, and a screen-reader pass on the error announcements

## Sign-up → onboarding

- [ ] Sign up → console shows the branded verification email with a working link
- [ ] Follow it → land on `/welcome`, step 1
- [ ] Fill step 1 → step 2. **Refresh mid-wizard** → resumes at step 2
- [ ] `/welcome?step=comms` before finishing step 2 → falls back to step 2
      *(no skipping ahead)*
- [ ] `/welcome?step=profile` after finishing it → allowed *(revision works)*
- [ ] Finish → `/learn`; `User.onboardedAt` is set; revisiting `/learn` does not
      redirect again
- [ ] Repeat with **Skip for now** → `onboardedAt` still stamped, no re-prompt

## /account

- [ ] `/account` → profile saves; timezone datalist type-ahead works
- [ ] `/account/security` → 2FA: password → QR → wrong code rejected → correct
      code enables → backup codes shown → "I've saved them" only enables after
      copy or download
- [ ] Sign out, sign in → TOTP challenge appears
- [ ] Challenge accepts a backup code, and the **same code fails on reuse**
- [ ] Disable 2FA with password → challenge no longer appears
- [ ] Change password with "sign out everywhere" on → other browser is signed out
- [ ] Change email → confirmation arrives at the **old** address; the change
      does not apply until the link is followed
- [ ] `/account/sessions` → a second browser appears as a row; revoke it; that
      browser is signed out on next navigation
- [ ] A Google/SSO-only account shows "managed by your provider" copy rather
      than a password form

## Enterprise SSO

The load-bearing checks. Run against a dev server with the seeded database.

- [ ] Register an OIDC provider with a **deliberately wrong issuer** → inline
      error naming the problem; nothing is persisted
- [ ] Register a valid OIDC provider → the DNS token **is displayed**
      *(it was previously discarded)*
- [ ] **`POST /api/auth/sign-in/sso` with the unverified domain → 401,
      "Provider domain has not been verified"**
- [ ] Same via `{ providerId }` instead of `{ email }` → also 401
      *(the gate is server-side, not a property of our form)*
- [ ] An unknown domain does not fall through to some other provider
- [ ] Verify the domain (or override at `/admin/sso`) → sign-in now reaches the
      IdP; JIT-provisions a `Member` with role **`member`**; an `INVITED` seat
      for that verified email activates
- [ ] Register a SAML provider →
      `GET /api/auth/sso/saml2/sp/metadata?providerId=…&format=xml` returns
      XML containing `EntityDescriptor`, `AssertionConsumerService`, and the ACS
      URL `/api/auth/sso/saml2/sp/acs/{providerId}`
- [ ] Metadata for a nonexistent provider → not found
- [ ] `/admin/sso` → unverified providers sort into the queue; the trust switch
      confirms before acting and states that an override closes the DNS route

The three `POST /api/auth/sign-in/sso` checks can be run with `curl` against a
running dev server, without a browser:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  http://localhost:3000/api/auth/sign-in/sso \
  -H 'content-type: application/json' \
  -d '{"email":"employee@unverified.example","callbackURL":"/learn"}'
# expect 401
```

## Invitations

- [ ] Invite a member → branded email with the org name
- [ ] Signed out, open the link → org, inviter and role are shown, with a
      "sign in to accept" CTA
- [ ] Signed in as the **wrong** user → explains the mismatch, offers no Accept
- [ ] Decline → the invitation is actually rejected, not just navigated away
      from; it disappears from the inviter's pending list
- [ ] Accept as an enterprise/university invitee → lands on `/org/{slug}`, not
      `/studio`
- [ ] Reopen an accepted link → "already accepted"
- [ ] An expired invitation → the expiry page

## Emails

With `RESEND_API_KEY` unset, each of these should appear in the server console
with a working link:

- [ ] verification · password reset · email change · org invitation

Rendering is unit-tested (`tests/unit/email-templates.test.tsx`), but a real
client check is worth doing once before launch — Gmail and Outlook both rewrite
markup in ways no test catches.
