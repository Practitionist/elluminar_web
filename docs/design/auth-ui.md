# Auth & account UI

What the auth surface looks like, why, and the rules to keep it coherent as it
grows. Companion to [the auth architecture doc](../auth/README.md).

## The problem it solves

The auth pages were built from the same `Card` idiom repeated seven times, and
had begun to drift. More importantly they were the least accessible screens in
the app: every error was a `sonner` toast, which announces once, disappears, and
is never associated with the control that was wrong. Inputs were 32px tall —
the dashboard default, correct in a dense table, wrong when the form *is* the
page.

## Layout: split screen

```
┌────────────────────┬───────────────────┐
│ gradient-primary   │      elluminar    │
│ + noise + orbs     │                   │
│                    │  Welcome back     │
│ A résumé says      │  ✉ Email          │
│ you can.           │  🔒 Password   👁 │
│ A *proof* shows    │  (   Sign in   )  │
│ you did.           │  ──── or ────     │
│                    │  G  Continue…     │
│ hidden below lg    │  🏢 SSO           │
└────────────────────┴───────────────────┘
```

The left panel reuses treatments already proven elsewhere rather than inventing
any: `gradient-primary` + `.noise` from `site-footer.tsx`, and the blurred
`blur-3xl` orbs from the ink band in `features-section.tsx`. Below `lg` it is
hidden entirely — on a phone the form is the only thing worth the viewport.

`gradient-mesh` sits behind the form column at `opacity-40` (`25` at `lg`).
Every marketing section damps the mesh; auth previously ran it at full strength,
where it competed with input borders.

## Type and colour

Straight from the existing system — nothing new was added to `globals.css`.

| | |
|---|---|
| Page heading | `font-display text-3xl font-medium tracking-tight text-balance` (Newsreader) |
| Body | `text-muted-foreground leading-relaxed` |
| Accent | One word in `italic`, never two |
| CTA | `rounded-full`, `size="lg"`, full width |
| Card | `rounded-2xl border border-border bg-card p-6` |

`font-medium`, never bold, on display headings. The brand voice is editorial;
bold serif reads as a different product.

## Components

New, in `src/components/auth/` and `src/components/ui/`:

| Component | Why it exists |
|---|---|
| `Field` / `FieldLabel` / `FieldControl` / `FieldDescription` / `FieldError` | Wires `htmlFor`/`id`, `aria-invalid`, `aria-describedby` and a polite live region. The thing that was actually missing |
| `TextField`, `PasswordField` | Labelled input with a leading icon; password adds a reveal toggle |
| `PasswordStrengthMeter` | Four segments + a hint |
| `SubmitButton` | `aria-busy` + spinner. Every page previously hand-rolled a `useState` and swapped the label text |
| `FormAlert` | Form-level message that *persists* |
| `Spinner` | There was no spinner anywhere in `src/` |
| `AuthBrandPanel`, `AuthHeader`, `OrDivider` | The shared shell |
| `GoogleIcon` | lucide ships no brand marks; inline SVG costs no request |

`Input` and `InputGroup` gained a `size` variant. **`default` is byte-identical
to the previous `h-8`**, so no existing caller changed; `lg` (`h-10`) is for
auth and account forms.

## Rules

**1. Field errors are inline. Toasts are for outcomes.**

A failed submit needs to persist next to the field the user is about to fix — a
toast has usually gone by the time they look back. Toasts stay right for
"Verification email sent" or "Profile updated": something finished, nothing to
correct.

**2. Never say more than the user needs, and never less than they can act on.**

A 401 on sign-in says "that email and password don't match an account" — it does
not distinguish unknown-email from wrong-password. `/forgot-password` gives the
same answer for a registered and an unregistered address. Both are
enumeration defences and both are load-bearing; don't "improve" the copy.

Everything else is specific: 429 says wait a minute, an expired reset link says
your password hasn't changed, an SSO failure says to ask your IT team.

**3. Pending state must be announced, not just drawn.**

`SubmitButton` sets `aria-busy`. A label that changes from "Sign in" to
"Signing in…" reads as an ordinary button to assistive tech.

**4. Advisory ≠ blocking.**

The strength meter never blocks submission. `passwordSchema` (min 8, matching
Better Auth's floor) does. Showing "Weak" beside a password the server accepts
is fine; refusing it would not be.

**5. Empty and error states are pages, not toasts-on-a-form.**

`/reset-password` with an expired token renders an explanation and a way
forward, decided server-side. It used to render a normal form and only admit the
problem after the user typed a new password twice.

**6. Server component reads, client component writes.**

Each page is an RSC shell that reads `searchParams` and env flags, plus a client
form. This is what removed the fallback-less `<Suspense>` boundaries, and it is
how sign-in knows whether Google is configured.

## Known inconsistency

`Button render={<Link/>}` produces `<a role="button">` — Base UI sets the role
explicitly. Screen readers therefore announce "button" for something that
navigates. This is the app-wide convention and predates this work; changing
`components/ui/button.tsx` would ripple through every page, so it is recorded
here rather than fixed in an auth PR. It also means `getByRole("link")` will not
find these.

## Onboarding and account

`/welcome` uses a bare shell, not the dashboard: a first-run flow surrounded by
a sidebar full of surfaces the user hasn't earned reads as a form they can
ignore. Progress is a numbered stepper; completed steps are links back, future
steps are not.

`/account` uses `DashboardShell` with its own nav section, and one
`AccountSection` card per concern, so every page there reads the same way.
