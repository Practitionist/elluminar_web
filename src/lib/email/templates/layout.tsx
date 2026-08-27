import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

import { BRAND } from "@/lib/brand";

/**
 * Shared shell for transactional email.
 *
 * Everything is inline hex and table-safe markup — email clients support
 * roughly none of the app's stack. OKLCH tokens, CSS variables, and
 * `prefers-color-scheme` are all unreliable here, so the palette below is a
 * hand-converted sRGB approximation of the real brand tokens rather than a
 * reference to them.
 */
export const EMAIL_COLORS = {
  primary: "#e0218a",
  ink: "#26232b",
  muted: "#6f6b76",
  border: "#e6e3ea",
  surface: "#ffffff",
  page: "#f7f6f9",
} as const;

const fontStack =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export function EmailLayout({
  preview,
  heading,
  children,
  footNote,
}: {
  /** Inbox preview line. Without one, clients scrape the first body text. */
  preview: string;
  heading: string;
  children: React.ReactNode;
  footNote?: string;
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: EMAIL_COLORS.page,
          fontFamily: fontStack,
          margin: 0,
          padding: "32px 0",
        }}
      >
        <Container
          style={{
            backgroundColor: EMAIL_COLORS.surface,
            border: `1px solid ${EMAIL_COLORS.border}`,
            borderRadius: "16px",
            margin: "0 auto",
            maxWidth: "480px",
            padding: "32px",
          }}
        >
          <Text
            style={{
              color: EMAIL_COLORS.primary,
              fontSize: "20px",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              margin: "0 0 24px",
            }}
          >
            {BRAND.name}
          </Text>

          <Heading
            as="h1"
            style={{
              color: EMAIL_COLORS.ink,
              fontSize: "22px",
              fontWeight: 600,
              letterSpacing: "-0.02em",
              lineHeight: 1.3,
              margin: "0 0 16px",
            }}
          >
            {heading}
          </Heading>

          <Section>{children}</Section>

          <Hr
            style={{
              borderColor: EMAIL_COLORS.border,
              borderStyle: "solid",
              borderWidth: "1px 0 0",
              margin: "28px 0 16px",
            }}
          />

          <Text style={{ color: EMAIL_COLORS.muted, fontSize: "12px", lineHeight: 1.6, margin: 0 }}>
            {footNote ?? BRAND.tagline}
          </Text>
          <Text style={{ color: EMAIL_COLORS.muted, fontSize: "12px", margin: "8px 0 0" }}>
            Questions? Reply to this email or write to{" "}
            <Link
              href={`mailto:${BRAND.supportEmail}`}
              style={{ color: EMAIL_COLORS.primary }}
            >
              {BRAND.supportEmail}
            </Link>
            .
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function EmailParagraph({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        color: EMAIL_COLORS.ink,
        fontSize: "15px",
        lineHeight: 1.65,
        margin: "0 0 16px",
      }}
    >
      {children}
    </Text>
  );
}

/**
 * A styled anchor rather than a real button: `<button>` is inert in email, and
 * every client renders a padded link reliably.
 */
export function EmailButton({ href, children }: { href: string; children: string }) {
  return (
    <Section style={{ margin: "24px 0" }}>
      <Link
        href={href}
        style={{
          backgroundColor: EMAIL_COLORS.primary,
          borderRadius: "999px",
          color: "#ffffff",
          display: "inline-block",
          fontSize: "15px",
          fontWeight: 600,
          padding: "12px 28px",
          textDecoration: "none",
        }}
      >
        {children}
      </Link>
    </Section>
  );
}

/**
 * Some clients strip or rewrite the button href, and corporate scanners
 * pre-visit links. Always print the URL too.
 */
export function EmailFallbackLink({ href }: { href: string }) {
  return (
    <Text style={{ color: EMAIL_COLORS.muted, fontSize: "12px", lineHeight: 1.6, margin: 0 }}>
      If the button doesn&apos;t work, paste this into your browser:
      <br />
      <Link href={href} style={{ color: EMAIL_COLORS.primary, wordBreak: "break-all" }}>
        {href}
      </Link>
    </Text>
  );
}
