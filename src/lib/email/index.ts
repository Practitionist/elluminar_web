import { Resend } from "resend";

import { env } from "@/env";

type SendEmailInput = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
};

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

/**
 * Transactional email. Falls back to console logging in dev when RESEND_API_KEY
 * is absent so auth flows (verification, reset) remain testable.
 */
export async function sendEmail(input: SendEmailInput) {
  if (!resend) {
    console.info(
      `[email:dev] to=${input.to} subject="${input.subject}"\n${input.text ?? input.html ?? ""}`,
    );
    return { id: "dev-noop" };
  }
  const { data, error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: input.to,
    subject: input.subject,
    html: input.html ?? `<pre>${input.text ?? ""}</pre>`,
    text: input.text,
  });
  if (error) throw new Error(`Email send failed: ${error.message}`);
  return data!;
}
