import { describe, expect, it } from "vitest";

import { issuerLine } from "@/lib/credentials/issuer-line";

describe("issuerLine", () => {
  it("shows a genuine co-brand", () => {
    expect(issuerLine("Demo Academy", "Nalanda University")).toBe(
      "Demo Academy × Nalanda University",
    );
  });

  it("does not repeat the issuer when the co-brand is the same org", () => {
    // The seeded program credential stored both, rendering
    // "Nalanda University × Nalanda University" on the public verify page.
    expect(issuerLine("Nalanda University", "Nalanda University")).toBe("Nalanda University");
  });

  it("ignores casing and stray whitespace, since the field is hand-entered", () => {
    expect(issuerLine("Nalanda University", "  nalanda university ")).toBe("Nalanda University");
    expect(issuerLine("Nalanda University", "NALANDA UNIVERSITY")).toBe("Nalanda University");
  });

  it("falls back to the issuer when there is no co-brand", () => {
    expect(issuerLine("Demo Academy", null)).toBe("Demo Academy");
    expect(issuerLine("Demo Academy", undefined)).toBe("Demo Academy");
    expect(issuerLine("Demo Academy", "")).toBe("Demo Academy");
    expect(issuerLine("Demo Academy", "   ")).toBe("Demo Academy");
  });
});
