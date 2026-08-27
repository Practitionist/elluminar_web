import { render } from "@react-email/components";
import * as Sentry from "@sentry/nextjs";
import { Resend } from "resend";

import { env } from "@/env";

type SendEmailInput = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  /**
   * A React Email element. Rendered to HTML *and* to a plain-text alternative,
   * so we stop shipping `<pre>`-wrapped plaintext as the HTML part.
   */
  react?: React.ReactElement;
};

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

/**
 * Transactional email. Falls back to console logging in dev when RESEND_API_KEY
 * is absent so auth flows (verification, reset) remain testable.
 */
export async function sendEmail(input: SendEmailInput) {
  // A React template is rendered to both parts: HTML for clients that show it,
  // plain text for those that don't — and for spam scoring, which penalises
  // HTML-only mail.
  const rendered = input.react
    ? {
        html: await render(input.react),
        text: await render(input.react, { plainText: true }),
      }
    : { html: input.html, text: input.text };

  if (!resend) {
    console.info(
      `[email:dev] to=${input.to} subject="${input.subject}"\n${rendered.text ?? rendered.html ?? ""}`,
    );
    return { id: "dev-noop" };
  }

  const { data, error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: input.to,
    subject: input.subject,
    html: rendered.html ?? `<pre>${rendered.text ?? ""}</pre>`,
    text: rendered.text,
  });
  if (error) {
    const sendError = new Error(`Email send failed: ${error.message}`);
    Sentry.captureException(sendError, { tags: { vendor: "resend" } });
    throw sendError;
  }
  return data!;
}

/**
 * Non-fatal variant for BetterAuth's lifecycle hooks.
 *
 * `sendEmail` throws, and BetterAuth awaits these hooks inside the request —
 * so a Resend outage took down sign-up entirely, and the account was rolled
 * back over an email we could have retried. Here the account is created, the
 * failure goes to Sentry, and the user can hit "resend" on /verify-email.
 *
 * Use `sendEmail` directly where delivery IS the outcome the caller is waiting
 * on and a failure should surface (e.g. an explicit "resend" the user asked for).
 */
export async function sendAuthEmail(input: SendEmailInput) {
  try {
    return await sendEmail(input);
  } catch (err) {
    Sentry.captureException(err, {
      tags: { vendor: "resend", channel: "auth" },
      extra: { subject: input.subject },
    });
    console.error("[email:auth] delivery failed", input.subject, err);
    return null;
  }
}
