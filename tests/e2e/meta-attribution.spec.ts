import { expect, test } from "@playwright/test";

test("anonymous acquisition stays public and localhost tracking is a strict no-op", async ({ page }) => {
  const metaRequests: string[] = [];
  page.on("request", (request) => {
    if (/facebook\.net|facebook\.com\/tr/.test(request.url())) metaRequests.push(request.url());
  });

  await page.goto("/dynamic?prc_id=1185&utm_source=meta&utm_campaign=e2e");
  await expect(page.getByRole("heading", { name: "Build Your Personal AI Workday Plan", exact: true })).toBeVisible();
  await expect(page.locator(".auth-card")).toHaveCount(0);
  await expect(page.locator('script[src*="connect.facebook.net"]')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => typeof window.fbq)).toBe("undefined");
  expect(metaRequests).toEqual([]);
});

test("paywall requires authentication and preserves its return URL", async ({ page }) => {
  await page.goto("/paywall");
  await expect(page).toHaveURL(/\/login\?next=%2Fpaywall$/);
  await expect(page.getByRole("heading", { name: "Welcome back", exact: true })).toBeVisible();
});

test("privacy region endpoint applies opt-in, regional default, and fail-closed policy", async ({ request }) => {
  const europe = await request.get("/api/privacy/region", { headers: { "x-vercel-ip-country": "DE" } });
  await expect(europe).toBeOK();
  expect(await europe.json()).toMatchObject({ countryCode: "DE", requiresConsent: true, marketingAllowed: false });

  const hongKong = await request.get("/api/privacy/region", { headers: { "x-vercel-ip-country": "HK" } });
  await expect(hongKong).toBeOK();
  expect(await hongKong.json()).toMatchObject({ countryCode: "HK", requiresConsent: false, marketingAllowed: true });

  const unknown = await request.get("/api/privacy/region");
  await expect(unknown).toBeOK();
  expect(await unknown.json()).toMatchObject({ countryCode: null, requiresConsent: true, marketingAllowed: false });
});
