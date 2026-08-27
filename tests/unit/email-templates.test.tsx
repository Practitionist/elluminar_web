import { render } from "@react-email/components";
import { describe, expect, it } from "vitest";

import {
  ChangeEmailConfirmation,
  OrganizationInvitation,
  ResetPasswordEmail,
  VerifyEmail,
} from "@/lib/email/templates/auth-emails";

const URL = "https://elluminar.test/api/auth/verify?token=abc123";

describe("auth email templates", () => {
  const cases = [
    { name: "verify", element: VerifyEmail({ name: "Ada", url: URL }) },
    { name: "reset", element: ResetPasswordEmail({ name: "Ada", url: URL }) },
    {
      name: "change-email",
      element: ChangeEmailConfirmation({
        name: "Ada",
        newEmail: "new@example.com",
        url: URL,
      }),
    },
    {
      name: "invitation",
      element: OrganizationInvitation({
        organizationName: "Acme",
        inviterName: "Grace",
        url: URL,
      }),
    },
  ];

  for (const { name, element } of cases) {
    it(`${name} renders the action URL in both the button and the fallback`, async () => {
      const html = await render(element);
      // Twice: once in the styled anchor, once in the printed fallback. Some
      // clients strip the button, and corporate scanners pre-visit links.
      expect(html.split(URL).length - 1).toBeGreaterThanOrEqual(2);
    });

    it(`${name} produces a plain-text alternative`, async () => {
      const text = await render(element, { plainText: true });
      expect(text).toContain(URL);
      // HTML-only mail scores badly with spam filters, and the old
      // implementation shipped <pre>-wrapped text AS the HTML part.
      expect(text).not.toContain("<pre>");
      expect(text.trim().length).toBeGreaterThan(40);
    });

    it(`${name} inlines its styles rather than relying on a stylesheet`, async () => {
      const html = await render(element);
      // Email clients strip <style> unpredictably; everything must be inline.
      expect(html).toContain("style=");
    });
  }

  it("tells the recipient what to do if they did not request it", async () => {
    for (const { element } of cases) {
      const text = (await render(element, { plainText: true })).toLowerCase();
      expect(text).toMatch(/didn'?t|wasn'?t|not expecting/);
    }
  });

  it("warns rather than reassures on an email change", async () => {
    // This one is different on purpose: an unexpected change-email confirmation
    // means someone already has a live session, so "ignore this" is wrong advice.
    const text = await render(
      ChangeEmailConfirmation({ name: "Ada", newEmail: "new@example.com", url: URL }),
      { plainText: true },
    );
    expect(text.toLowerCase()).toContain("change your password");
  });
});
