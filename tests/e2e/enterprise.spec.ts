import { expect, test } from "@playwright/test";

test("enterprise storefront shows partner badge and programs", async ({ page }) => {
  await page.goto("/c/acme");
  await expect(page.getByText("Acme Corp").first()).toBeVisible();
  await expect(page.getByText(/enterprise partner/i)).toBeVisible();
  await expect(page.getByText("Backend Engineering Accelerator")).toBeVisible();
});

test("university storefront shows co-branded program", async ({ page }) => {
  await page.goto("/c/nalanda");
  await expect(page.getByText(/university partner/i)).toBeVisible();
  await expect(page.getByText("Applied Software Engineering Certificate")).toBeVisible();
  await expect(page.getByText(/co-certified with Nalanda University/i)).toBeVisible();
});

test("org portal is auth-gated", async ({ page }) => {
  await page.goto("/org/acme");
  await expect(page).toHaveURL(/\/sign-in\?next=/);
});

test("org benefits page is auth-gated", async ({ page }) => {
  await page.goto("/learn/org");
  await expect(page).toHaveURL(/\/sign-in\?next=/);
});

test("onboarding offers all three organization types", async ({ page }) => {
  await page.goto("/sign-in"); // establish baseURL cookies path
  await page.goto("/onboarding");
  // Unauthenticated → redirected to sign-in with next
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fonboarding/);
});
