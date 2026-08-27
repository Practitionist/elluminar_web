import { describe, expect, it } from "vitest";

import { resolveStep, stepPosition } from "@/lib/onboarding/steps";
import { slugify } from "@/lib/slug";

describe("stepPosition", () => {
  it("starts at the first step for a brand-new account", () => {
    expect(stepPosition([], false).currentStep).toBe("profile");
  });

  it("advances to the first unfinished step", () => {
    expect(stepPosition(["profile"], false).currentStep).toBe("goals");
    expect(stepPosition(["profile", "goals"], false).currentStep).toBe("comms");
  });

  it("reports no current step once every step is done", () => {
    expect(stepPosition(["profile", "goals", "comms"], true).currentStep).toBeNull();
  });

  it("ignores order — completion is a set, not a sequence", () => {
    expect(stepPosition(["comms", "profile"], false).currentStep).toBe("goals");
  });
});

describe("resolveStep", () => {
  const fresh = stepPosition([], false);
  const midway = stepPosition(["profile"], false);
  const done = stepPosition(["profile", "goals", "comms"], true);

  it("defaults to the first unfinished step", () => {
    expect(resolveStep(undefined, fresh)).toBe("profile");
    expect(resolveStep(undefined, midway)).toBe("goals");
  });

  it("refuses to skip ahead past an unfinished step", () => {
    // A later step's defaults can depend on answers an earlier one collects,
    // so jumping to ?step=comms from a fresh account must not work.
    expect(resolveStep("comms", fresh)).toBe("profile");
    expect(resolveStep("comms", midway)).toBe("goals");
  });

  it("allows going back to revise a completed step", () => {
    expect(resolveStep("profile", midway)).toBe("profile");
  });

  it("lets a finished user revisit any step", () => {
    expect(resolveStep("profile", done)).toBe("profile");
    expect(resolveStep("goals", done)).toBe("goals");
  });

  it("falls back rather than throwing on an unknown step", () => {
    expect(resolveStep("nonsense", midway)).toBe("goals");
    expect(resolveStep("", fresh)).toBe("profile");
  });

  it("lands on the last step for a finished user with no ?step=", () => {
    expect(resolveStep(undefined, done)).toBe("comms");
  });
});

describe("slugify", () => {
  it("collapses repeated separators", () => {
    // The SSO form's private copy skipped this, producing "acme--corp", which
    // then failed slugSchema server-side with an unexplainable error.
    expect(slugify("Acme  Corp")).toBe("acme-corp");
    expect(slugify("Acme___Corp")).toBe("acme-corp");
  });

  it("strips diacritics instead of dropping the letter", () => {
    expect(slugify("Café Systems")).toBe("cafe-systems");
  });

  it("never leaves a leading or trailing hyphen", () => {
    expect(slugify("  -- Systems Academy -- ")).toBe("systems-academy");
  });

  it("does not leave a trailing hyphen after truncation", () => {
    expect(slugify("aaaaaaaaaa bbbbbbbbbb", 11)).toBe("aaaaaaaaaa");
  });

  it("drops characters that slugSchema would reject", () => {
    expect(slugify("Ada's Systems & Co.")).toBe("adas-systems-co");
  });

  it("returns an empty string when there is nothing to slug", () => {
    expect(slugify("!!!")).toBe("");
  });
});
