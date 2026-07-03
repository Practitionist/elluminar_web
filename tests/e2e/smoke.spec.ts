import { expect, test } from "@playwright/test";

test("landing page renders the value proposition", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /learn by building/i }),
  ).toBeVisible();
});

test("catalog lists the seeded demo course", async ({ page }) => {
  await page.goto("/courses");
  await expect(page.getByText("Full-Stack Next.js in Production")).toBeVisible();
});

test("project catalog and detail render with mentor pricing", async ({ page }) => {
  await page.goto("/projects");
  await page.getByText("Real-Time Collaborative Editor").click();
  await expect(page.getByText(/mentor review/i).first()).toBeVisible();
  await expect(page.getByText(/₹19,999/).first()).toBeVisible();
});

test("storefront renders", async ({ page }) => {
  await page.goto("/c/demo-academy");
  await expect(page.getByRole("heading", { name: "Demo Academy" })).toBeVisible();
});

test("pricing page shows the full tier ladder", async ({ page }) => {
  await page.goto("/pricing");
  for (const tagline of [
    "Explore the marketplace",
    "The full self-paced library",
    "Guided practice with real mentors",
    "A mentor-backed career outcome",
  ]) {
    await expect(page.getByText(tagline)).toBeVisible();
  }
});

test("auth pages are reachable", async ({ page }) => {
  await page.goto("/sign-up");
  await expect(page.getByText(/create your account/i).first()).toBeVisible();
  await page.goto("/sign-in");
  await expect(page.getByText(/welcome back/i).first()).toBeVisible();
});

test("protected routes redirect to sign-in", async ({ page }) => {
  await page.goto("/learn");
  await expect(page).toHaveURL(/\/sign-in\?next=/);
});

test("certificate verification handles unknown codes", async ({ page }) => {
  await page.goto("/verify/XXXX-XXXX-XXXX");
  await expect(page.getByText(/no credential matches/i)).toBeVisible();
});
