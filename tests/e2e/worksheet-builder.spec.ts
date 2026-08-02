import { expect, test } from "@playwright/test";

test.describe("worksheet builder", () => {
  test("generates, changes subject and downloads on desktop", async ({ page }) => {
    await page.goto("/worksheet-builder");
    await expect(page.getByRole("heading", { name: "幾分鐘製作好教材" })).toBeVisible();
    await page.getByRole("button", { name: "＋ 數學" }).click();
    await expect(page.getByRole("heading", { name: "數學加減練習" }).first()).toBeVisible();
    const originalSeed = await page.getByText(/^Seed /).textContent();
    await page.getByRole("button", { name: "重新生成" }).first().click();
    await expect(page.getByText(/^Seed /)).not.toHaveText(originalSeed ?? "");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "下載 PDF" }).first().click();
    await expect((await download).suggestedFilename()).toMatch(/^worksheet-math-\d+\.pdf$/);
  });

  test("keeps controls and primary actions usable on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/worksheet-builder");
    await expect(page.getByRole("group", { name: "科目" })).toBeVisible();
    await expect(page.getByRole("button", { name: "下載 PDF" }).last()).toBeVisible();
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Make a worksheet in minutes" })).toBeVisible();
  });
});
