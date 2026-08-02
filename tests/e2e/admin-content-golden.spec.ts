import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const debugAdminEnabled = process.env.E2E_ADMIN_DEBUG === "true";
const lessonId = "claude__meet-claude";
const marker = "CMS golden journey verification";

type DebugLesson = {
  id: string;
  title: string;
  version: number;
  updatedAt: string;
  updatedBy: string;
  screens: unknown[];
  [key: string]: unknown;
};

async function getLesson(request: APIRequestContext) {
  const response = await request.get(`/api/admin/content/lessons/${lessonId}`);
  expect(response.ok()).toBeTruthy();
  return (await response.json()).lesson as DebugLesson;
}

function comparableLesson(lesson: DebugLesson) {
  const { version: _version, updatedAt: _updatedAt, updatedBy: _updatedBy, ...content } = lesson;
  void _version;
  void _updatedAt;
  void _updatedBy;
  return JSON.stringify(content);
}

async function restoreLessonIfNeeded(request: APIRequestContext, original: DebugLesson) {
  const current = await getLesson(request);
  if (comparableLesson(current) === comparableLesson(original)) return;
  const response = await request.put(`/api/admin/content/lessons/${lessonId}`, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
    data: {
      lesson: { ...original, version: current.version },
      expectedVersion: current.version,
      changeSummary: "Automated cleanup after CMS golden journey",
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
}

async function openMeetClaude(page: Page, expectedScreens = 27) {
  await page.goto("/admin/content");
  await expect(page.getByRole("heading", { name: "Content CMS" })).toBeVisible();

  const course = page.getByRole("button", {
    name: "Claude 10 lessons · tool · published",
    exact: true,
  });
  if (await course.getAttribute("aria-expanded") === "false") await course.click();
  const lesson = page.locator("[data-cms-course-id='claude'] > div > button").filter({ hasText: "Meet Claude" });
  await expect(lesson).toHaveCount(1);
  await lesson.click();
  await expect(page.getByRole("textbox", { name: "Lesson title", exact: true })).toHaveValue("Meet Claude");
  await expect(page.locator(".cms-screen-tabs [role=tab]")).toHaveCount(expectedScreens);
}

test.describe("Content CMS golden authoring journey", () => {
  test.skip(!debugAdminEnabled, "Run against the localhost debug-admin build with E2E_ADMIN_DEBUG=true.");

  test("@golden Meet Claude edits, previews, publishes, reloads and rolls back", async ({ page, request }) => {
    const original = await getLesson(request);
    await page.addInitScript(() => window.localStorage.clear());

    try {
      await openMeetClaude(page);

      const richText = page.locator("[contenteditable=true][aria-label='Content']");
      await expect(richText).toHaveCount(1);
      const originalRichText = await richText.innerHTML();
      await richText.press("End");
      await richText.type(` ${marker}`);
      await expect(richText).toContainText(marker);

      const imageAlt = page.locator(".cms-media-editor > label input").first();
      const originalAlt = await imageAlt.inputValue();
      await imageAlt.fill(`${originalAlt} · ${marker}`);

      await page.getByRole("button", { name: "Duplicate screen 1", exact: true }).click();
      await expect(page.locator(".cms-screen-tabs [role=tab]")).toHaveCount(28);
      await page.locator(".cms-screen-title-setting input").fill("Temporary QA screen");
      await page.getByRole("button", { name: "Move screen 2 down", exact: true }).click();
      await expect(page.getByText("Editing screen 3 of 28", { exact: false })).toBeVisible();

      await page.getByRole("button", { name: "Preview", exact: true }).click();
      await expect(page.locator(".cms-preview-health.ready")).toBeVisible();
      await expect(page.locator(".cms-lesson-preview section")).toContainText(marker);
      await expect(page.getByRole("button", { name: "Check answers", exact: true })).toBeVisible();

      await page.locator("[data-cms-publish]").click();
      const publishDialog = page.getByRole("dialog", { name: 'Publish “Meet Claude”?' });
      await expect(publishDialog).toBeVisible();
      await publishDialog.getByLabel("Revision note optional but recommended").fill("Verify the complete non-technical CMS workflow");
      await publishDialog.getByRole("button", { name: "Publish now", exact: true }).click();
      await expect(page.getByText(/Published lesson version/)).toBeVisible();
      await expect(page.locator("[data-cms-edit-status]")).toHaveAttribute("data-cms-edit-status", "clean");

      await openMeetClaude(page, 28);
      await expect(page.locator(".cms-screen-tabs [role=tab]")).toHaveCount(28);
      await expect(page.locator("[contenteditable=true][aria-label='Content']")).toContainText(marker);
      await expect(page.locator(".cms-media-editor > label input").first()).toHaveValue(`${originalAlt} · ${marker}`);

      const newestRevision = page.locator(".cms-history article").first();
      await expect(newestRevision).toBeVisible();
      await newestRevision.getByRole("button", { name: "Rollback", exact: true }).click();

      const rollbackDialog = page.getByRole("alertdialog", { name: /Restore lesson version/ });
      await expect(rollbackDialog).toBeVisible();
      await rollbackDialog.getByLabel("Reason for rollback").fill("Restore the baseline after the golden journey");
      await rollbackDialog.getByRole("button", { name: "Restore this version", exact: true }).click();
      await expect(page.getByText(/Restored as lesson version/)).toBeVisible();

      await openMeetClaude(page);
      await expect(page.locator(".cms-screen-tabs [role=tab]")).toHaveCount(27);
      await expect.poll(() => page.locator("[contenteditable=true][aria-label='Content']").innerHTML()).toBe(originalRichText);
      await expect(page.locator(".cms-media-editor > label input").first()).toHaveValue(originalAlt);
    } finally {
      await restoreLessonIfNeeded(request, original);
      await page.evaluate(() => window.localStorage.clear()).catch(() => undefined);
    }
  });
});
