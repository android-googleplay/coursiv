import { expect, test, type Page } from "@playwright/test";

const debugAdminEnabled = process.env.E2E_ADMIN_DEBUG === "true";

async function openContentCms(page: Page) {
  await page.goto("/admin/content");
  await expect(page.getByRole("heading", { name: "Content CMS" })).toBeVisible();
  await expect(page.locator(".cms-workspace")).toBeVisible();
}

async function computedType(page: Page, selector: string) {
  return page.locator(selector).first().evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      fontSize: Number.parseFloat(style.fontSize),
      fontWeight: Number.parseInt(style.fontWeight, 10),
      lineHeight: Number.parseFloat(style.lineHeight),
    };
  });
}

test.describe("Admin readability contracts", () => {
  test.skip(!debugAdminEnabled, "Run against the localhost debug-admin build with E2E_ADMIN_DEBUG=true.");

  test("uses a calm, readable hierarchy across the CMS chrome", async ({ page }) => {
    await openContentCms(page);

    await expect.poll(() => computedType(page, ".admin-stage header h1")).toMatchObject({
      fontSize: 24,
      fontWeight: 700,
    });
    await expect.poll(() => computedType(page, ".admin-stage header p")).toMatchObject({
      fontSize: 12,
      fontWeight: 400,
    });
    await expect.poll(() => computedType(page, ".cms-course-tree > div > button strong")).toMatchObject({
      fontSize: 14,
      fontWeight: 600,
    });
    await expect.poll(() => computedType(page, ".cms-course-tree > div > button small")).toMatchObject({
      fontSize: 12,
      fontWeight: 400,
    });

    await expect(page.locator(".cms-toolbar button.primary")).toHaveCount(1);
    await expect(page.locator(".cms-course-tree > div > button strong").first()).toHaveAttribute("title", /.+/);

    const firstCourse = page.locator(".cms-course-tree [data-cms-course-id]").first();
    const courseButton = firstCourse.locator(":scope > button");
    if (await courseButton.getAttribute("aria-expanded") === "false") await courseButton.click();
    await firstCourse.locator(":scope > div > button:not(.cms-tree-add)").first().click();

    await expect(page.locator(".cms-screen-tabs")).toBeVisible();
    await expect(page.locator(".cms-screen-tabs [role=tab][aria-selected=true]")).toHaveCount(1);
    await expect(page.locator(".cms-screen-tabs [role=tab]").first()).toHaveAttribute("title", /.+/);
    await expect.poll(() => computedType(page, ".cms-screen-tabs button strong")).toMatchObject({
      fontSize: 13,
      fontWeight: 600,
    });
    await expect.poll(() => computedType(page, ".cms-screen-identity small")).toMatchObject({
      fontSize: 12,
      fontWeight: 400,
    });

    await page.getByRole("button", { name: "Preview" }).click();
    await expect(page.locator(".cms-preview-health")).toBeVisible();
    await expect(page.getByRole("button", { name: "Mobile" })).toBeVisible();
    await expect.poll(() => computedType(page, ".cms-preview-health strong")).toMatchObject({
      fontSize: 14,
    });

    await test.info().attach("content-cms-readability", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
  });

  test("edit actions stay in place and activate without layout shift", async ({ page }) => {
    await openContentCms(page);

    const publish = page.locator("[data-cms-publish]");
    const discard = page.locator("[data-cms-discard]");
    const status = page.locator("[data-cms-edit-status]");
    const courseTitle = page.locator(".cms-settings-card input[maxlength='120']").first();

    await expect(publish).toHaveText("Publish changes");
    await expect(discard).toHaveText("Discard changes");
    await expect(publish).toBeDisabled();
    await expect(discard).toBeDisabled();
    await expect(status).toHaveAttribute("data-cms-edit-status", "clean");

    const before = {
      publish: await publish.boundingBox(),
      discard: await discard.boundingBox(),
    };
    const originalTitle = await courseTitle.inputValue();
    await courseTitle.fill(`${originalTitle} updated`);

    await expect(publish).toHaveText("Publish changes");
    await expect(discard).toHaveText("Discard changes");
    await expect(publish).toBeEnabled();
    await expect(discard).toBeEnabled();
    await expect(status).toHaveAttribute("data-cms-edit-status", "dirty");

    const after = {
      publish: await publish.boundingBox(),
      discard: await discard.boundingBox(),
    };
    expect(after.publish?.x).toBeCloseTo(before.publish?.x ?? 0, 0);
    expect(after.publish?.width).toBeCloseTo(before.publish?.width ?? 0, 0);
    expect(after.discard?.x).toBeCloseTo(before.discard?.x ?? 0, 0);
    expect(after.discard?.width).toBeCloseTo(before.discard?.width ?? 0, 0);

    await discard.click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Discard changes", exact: true }).click();
    await expect(publish).toBeDisabled();
    await expect(discard).toBeDisabled();
    await expect(status).toHaveAttribute("data-cms-edit-status", "clean");
  });

  test("shared hierarchy remains readable across every admin workspace", async ({ page }) => {
    for (const route of ["/admin", "/admin/users", "/admin/tickets", "/admin/payments", "/admin/certificates", "/admin/content", "/admin/staff"]) {
      await page.goto(route);
      await expect(page.locator(".admin-stage header h1")).toBeVisible();

      const result = await page.evaluate(() => {
        const visibleMetadata = [...document.querySelectorAll<HTMLElement>(".admin-content > :not(.cms-page) small")]
          .filter((element) => element.offsetParent !== null)
          .map((element) => Number.parseFloat(getComputedStyle(element).fontSize));
        return {
          h1: Number.parseFloat(getComputedStyle(document.querySelector(".admin-stage header h1")!).fontSize),
          minMetadata: visibleMetadata.length ? Math.min(...visibleMetadata) : 12,
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
        };
      });

      expect(result.h1, `${route} should use the shared page-title token`).toBe(24);
      expect(result.minMetadata, `${route} has metadata smaller than 12px`).toBeGreaterThanOrEqual(12);
      expect(result.scrollWidth, `${route} overflows horizontally`).toBeLessThanOrEqual(result.clientWidth + 1);
    }
  });

  for (const viewport of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "compact-desktop", width: 1024, height: 768 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "125-percent-zoom-equivalent", width: 1152, height: 720 },
    { name: "200-percent-zoom-equivalent", width: 720, height: 450 },
  ]) {
    test(`${viewport.name} has no page-level horizontal overflow`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openContentCms(page);
      const geometry = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
    });
  }
});
