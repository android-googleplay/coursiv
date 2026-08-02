#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { chromium } from "playwright";
import { collectUnknownBlocks, lessonScreenIds, normalizeCoursivLesson, slugifyCoursiv } from "../lib/coursiv-content.ts";

const ROOT = resolve(import.meta.dirname, "..");
const AUTH_DIR = join(ROOT, ".auth");
const AUTH_FILE = join(AUTH_DIR, "coursiv.storage-state.json");
const CONTENT_DIR = join(ROOT, "content", "coursiv");
const COURSE_DIR = join(CONTENT_DIR, "courses");
const MANIFEST_FILE = join(CONTENT_DIR, "manifest.json");
const CHECKPOINT_FILE = join(CONTENT_DIR, "checkpoint.json");
const REPORT_FILE = join(CONTENT_DIR, "scrape-report.json");
const MEDIA_DIR = join(ROOT, "public", "coursiv-media");
const GENERATED_CATALOG = join(ROOT, "lib", "generated", "coursiv-catalog.ts");
const APP_ORIGIN = "https://app.coursiv.io";
const BASELINE = { courses: 37, lessons: 343 };
const command = process.argv[2] ?? "help";
const rawArgs = process.argv.slice(3);
const args = new Set(rawArgs);
const optionValue = (name) => rawArgs.find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1);
const requestedCourse = optionValue("--course");
const requestedMaxLessons = optionValue("--max-lessons");
const maxLessons = requestedMaxLessons == null ? Number.POSITIVE_INFINITY : Number.parseInt(requestedMaxLessons, 10);
if (!Number.isFinite(maxLessons) && requestedMaxLessons != null || maxLessons < 1) throw new Error("--max-lessons must be a positive integer");
const shouldComplete = !args.has("--no-complete");
const headed = args.has("--headed") || command === "auth" || command === "complete";
const sleep = (milliseconds) => new Promise((done) => setTimeout(done, milliseconds));
let observedApiHeaders = {};

const courseIds = new Map(Object.entries({
  "Claude":"claude", "Claude for Excel":"claude-excel", "Claude: Deep Dive":"claude-deep", "Midjourney":"midjourney", "Lovable":"lovable",
  "Gemini":"gemini", "ChatGPT":"chatgpt", "Jasper AI":"jasper", "ChatGPT: Deep Dive":"chatgpt-deep", "Stable Diffusion":"stable-diffusion",
  "DeepSeek":"deepseek", "Omni":"omni", "Perplexity":"perplexity", "Kling":"kling", "Canva AI":"canva-ai", "Communicating With AI":"communicating-ai", "Claude Code":"claude-code",
  "Turbocharge Your Productivity with AI":"use-case-16", "Managing Personal Finances With AI":"use-case-1", "AI for Accountants":"use-case-2",
  "AI-Powered Real Estate":"use-case-3", "AI Copywriting":"use-case-4", "AI Side Hustle":"use-case-5", "AI-Powered Creative Income":"use-case-6",
  "No-Code Websites and Apps":"use-case-7", "AI in Design":"use-case-8", "Land Jobs With AI":"use-case-9", "AI for Business Operations":"use-case-10",
  "Boost Your Sales with AI":"use-case-11", "Marketing Your Business with AI":"use-case-12", "AI Essentials for Project Managers":"use-case-13",
  "AI for Product Development":"use-case-14", "Build a Strong Portfolio with AI":"use-case-15", "AI in SMM":"use-case-17",
  "AI Social Influence & Blogging":"use-case-18", "AI Performance Marketing":"use-case-19", "AI for SEO":"use-case-20",
}));

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}
function stringify(value) { return `${JSON.stringify(stable(value), null, 2)}\n`; }
async function atomicWrite(path, value) {
  const next = typeof value === "string" ? value : stringify(value);
  if (existsSync(path) && await readFile(path, "utf8") === next) return false;
  const temporary = `${path}.tmp`;
  await writeFile(temporary, next);
  await rename(temporary, path);
  return true;
}
function record(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function list(value) { return Array.isArray(value) ? value : []; }
function text(...values) { return values.find((value) => typeof value === "string" && value.trim())?.trim() ?? ""; }
function safeError(error) {
  return (error instanceof Error ? error.message : String(error))
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(/[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g, "[REDACTED_JWT]")
    .replace(/(x-aws-waf-token:|cookie:)\s*[^\n\r]+/gi, "$1 [REDACTED]");
}
function unwrap(value) {
  let current = value;
  for (let index = 0; index < 4; index += 1) {
    const source = record(current); const next = source.data ?? source.result;
    if (!next || next === current) break; current = next;
  }
  return current;
}
function findGuideArray(value, depth = 0) {
  if (depth > 5) return [];
  if (Array.isArray(value)) {
    if (value.some((item) => record(item).id && (record(item).name || record(item).title || record(item).slug))) return value;
    for (const item of value) { const found = findGuideArray(item, depth + 1); if (found.length) return found; }
    return [];
  }
  for (const candidate of Object.values(record(value))) { const found = findGuideArray(candidate, depth + 1); if (found.length) return found; }
  return [];
}

async function apiGet(page, path, attempts = 4) {
  let last;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const url = `https://api.production.coursiv.io/${path.replace(/^\//, "")}`;
    const cookies = await page.context().cookies(url);
    const token = cookies.find((cookie) => cookie.name === "auth.access_token")?.value;
    let response;
    try { response = await page.context().request.get(url, { timeout: 20_000, headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...observedApiHeaders } }); }
    catch (error) { last = { status: "network", message: safeError(error) }; await sleep(800 * (2 ** attempt)); continue; }
    const result = { status: response.status(), url, body: await response.text(), hasToken: Boolean(token) };
    if (result.status === 401 || result.status === 403) throw new Error(`Coursiv session is not authorized (${result.status}). Run npm run coursiv:auth.`);
    if (result.status === 429 || result.status >= 500) { last = result; await sleep(800 * (2 ** attempt)); continue; }
    if (result.status < 200 || result.status >= 300) throw new Error(`Coursiv API ${result.url} returned ${result.status}: ${result.body.slice(0, 300)}`);
    try { return JSON.parse(result.body); } catch { throw new Error(`Coursiv API ${result.url} did not return JSON`); }
  }
  throw new Error(`Coursiv API remained unavailable after ${attempts} attempts (${last?.status ?? "unknown"})`);
}

async function openContext() {
  await mkdir(AUTH_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: !headed });
  const context = await browser.newContext(existsSync(AUTH_FILE) ? { storageState: AUTH_FILE } : {});
  const page = await context.newPage();
  page.on("request", async (request) => {
    if (!request.url().startsWith("https://api.production.coursiv.io/")) return;
    try {
      const headers = await request.allHeaders();
      observedApiHeaders = Object.fromEntries(Object.entries(headers).filter(([name]) => /authorization|token|device|user|client|platform/i.test(name)));
    } catch { /* The page may close while Playwright is resolving headers. */ }
  });
  return { browser, context, page };
}
async function authenticate() {
  const { browser, context, page } = await openContext();
  try {
    await page.goto(APP_ORIGIN, { waitUntil: "domcontentloaded" });
    console.log("Sign in to Coursiv in the opened browser. This window closes after Courses becomes available.");
    await page.waitForFunction(() => location.hostname === "app.coursiv.io" && Boolean(document.querySelector('a[href="/guides"]')), null, { timeout: 300_000 });
    await context.storageState({ path: AUTH_FILE });
    console.log(`Saved authenticated browser state to ${AUTH_FILE}`);
  } finally { await browser.close(); }
}
async function ensureAuthenticated(page) {
  await page.goto(`${APP_ORIGIN}/guides`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);
  if (page.url().includes("/auth/") || await page.getByText("Log in", { exact: true }).count()) throw new Error("Coursiv login is required. Run npm run coursiv:auth first.");
  if (await page.locator('iframe[src*="captcha"], iframe[src*="challenge"], [data-captcha]').count()) throw new Error("Coursiv displayed a CAPTCHA. Complete it manually with npm run coursiv:auth; the scraper will not bypass it.");
}
function guideMetadata(guide, kindHint) {
  const source = record(guide); const title = text(source.name, source.title, source.slug, source.id); const id = courseIds.get(title);
  if (!id) throw new Error(`No stable internal id mapping exists for Coursiv course: ${title}`);
  return { id, sourceId: String(source.id), kind: id.startsWith("use-case-") ? "use-case" : kindHint, title, duration: text(source.duration, source.estimated_duration), categories: list(source.categories).map((item) => text(record(item).name, item)).filter(Boolean), lessonsCount: Number(source.lessons_count ?? source.lesson_count ?? 0), source: guide };
}
async function discoverGuides(page) {
  const response = await apiGet(page, "guides/v2");
  const guides = findGuideArray(unwrap(response));
  const selected = guides.filter((guide) => courseIds.has(text(record(guide).name, record(guide).title, record(guide).slug))).map((guide) => guideMetadata(guide, "tool"));
  const unique = new Map(selected.map((guide) => [guide.sourceId, guide]));
  const addDomGuides = async (url, kind) => {
    await page.goto(url, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(1800);
    const items = await page.evaluate(() => [...document.querySelectorAll('a[href^="/guide-pathway/"]')].map((anchor) => {const values=[...anchor.querySelectorAll("p")].map((node) => node.textContent?.trim()).filter(Boolean);return { id: anchor.getAttribute("href")?.split("/").pop(), title: anchor.querySelector("strong")?.textContent?.trim(), duration: values.find((value) => value?.includes("hour")), lessons_count:Number.parseInt(values.find((value)=>value?.includes("lesson"))??"0",10) };}).filter((item) => item.id && item.title));
    for (const item of items) if (!unique.has(item.id) && courseIds.has(item.title)) unique.set(item.id, guideMetadata(item, kind));
  };
  await addDomGuides(`${APP_ORIGIN}/guides`, "tool");
  const more = page.getByTestId("guides-list-more-button");
  if (await more.count() === 1) { await more.click(); await page.waitForTimeout(350); const items = await page.evaluate(() => [...document.querySelectorAll('a[href^="/guide-pathway/"]')].map((anchor) => {const values=[...anchor.querySelectorAll("p")].map((node) => node.textContent?.trim()).filter(Boolean);return { id: anchor.getAttribute("href")?.split("/").pop(), title: anchor.querySelector("strong")?.textContent?.trim(), duration: values.find((value) => value?.includes("hour")), lessons_count:Number.parseInt(values.find((value)=>value?.includes("lesson"))??"0",10) };}).filter((item) => item.id && item.title)); for (const item of items) if (!unique.has(item.id) && courseIds.has(item.title)) unique.set(item.id, guideMetadata(item, "tool")); }
  await addDomGuides(`${APP_ORIGIN}/other-guides`, "use-case");
  return [...unique.values()].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

function guideUnits(detail) {
  const source = record(unwrap(detail));
  return list(source.content ?? source.units).map((unit, unitIndex) => {
    const value = record(unit);
    return { sourceId: String(value.id ?? `unit-${unitIndex + 1}`), title: text(value.name, value.title), order: Number(value.ordering ?? value.order ?? unitIndex), lessons: list(value.content ?? value.lessons) };
  });
}
async function fetchPracticePayloads(page, guideId, lessonRaw) {
  const source = record(unwrap(lessonRaw));
  const practices = [];
  const visit = (value, fragmentId) => {
    if (Array.isArray(value)) { for (const item of value) visit(item, fragmentId); return; }
    const item = record(value); if (!Object.keys(item).length) return;
    const itemType = text(item.type, item.practice_type);
    const nextFragmentId = itemType.includes("practice") && item.id ? String(item.id) : fragmentId;
    const practiceId = text(item.practice_id);
    if (practiceId && nextFragmentId && itemType) practices.push({ item, fragmentId: nextFragmentId, practiceId, practiceType: itemType });
    visit(item.content, nextFragmentId);
  };
  visit(source.content, undefined);
  for (const practice of practices) {
    try { practice.item.practice_payload = await apiGet(page, `guides/v2/${guideId}/fragments/${practice.fragmentId}/practices/${practice.practiceId}/contents?practice_type=${encodeURIComponent(practice.practiceType)}`); }
    catch (error) { practice.item.practice_error = safeError(error); }
  }
  return lessonRaw;
}
function imageUrls(value, key = "", output = new Set(), depth = 0) {
  if (depth > 12 || value == null) return output;
  if (Array.isArray(value)) { for (const item of value) imageUrls(item, key, output, depth + 1); return output; }
  if (typeof value !== "object") { if (typeof value === "string" && /image|poster|thumbnail|avatar|cover|icon/i.test(key) && /^https?:\/\//.test(value)) output.add(value); return output; }
  if (value.type === "image" && typeof value.value === "string" && /^https?:\/\//.test(value.value)) output.add(value.value);
  for (const [childKey, child] of Object.entries(value)) imageUrls(child, childKey, output, depth + 1);
  return output;
}
async function downloadImage(context, url) {
  const response = await context.request.get(url, { timeout: 30_000 });
  if (!response.ok()) throw new Error(`Image returned ${response.status()}: ${url}`);
  const contentType = response.headers()["content-type"] ?? ""; if (!contentType.startsWith("image/")) throw new Error(`Expected image but received ${contentType || "unknown"}: ${url}`);
  const bytes = await response.body(); const hash = createHash("sha256").update(bytes).digest("hex");
  const contentExtension = contentType.split("/")[1]?.split(";")[0]?.replace("jpeg", "jpg").replace("svg+xml", "svg");
  const extension = contentExtension || extname(new URL(url).pathname).slice(1) || "bin"; const name = `${hash}.${extension}`; const path = join(MEDIA_DIR, name);
  if (!existsSync(path)) await writeFile(path, bytes);
  return { localSrc: `/coursiv-media/${name}`, sha256: hash, bytes: bytes.length, sourceUrl: url };
}
function replaceLocalMedia(value, media) {
  if (Array.isArray(value)) return value.map((item) => replaceLocalMedia(item, media));
  if (!value || typeof value !== "object") return value;
  if (value.type === "image" && media[value.src]) return { ...value, localSrc: media[value.src].localSrc };
  if (value.outputImage && media[value.outputImage]) value = { ...value, outputLocalImage: media[value.outputImage].localSrc };
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, replaceLocalMedia(child, media)]));
}
function ensureUniqueLessonSlugs(course){
  const used=new Set();
  for(const unit of course.units)for(const lesson of unit.lessons){
    const base=lesson.slug;let candidate=base;
    if(used.has(candidate))candidate=`${base}-${lesson.sourceId.replace(/[^a-z0-9]/gi,"").slice(0,8).toLowerCase()}`;
    let suffix=2;while(used.has(candidate))candidate=`${base}-${suffix++}`;
    lesson.slug=candidate;used.add(candidate);
  }
  return course;
}

async function completeLesson(page, lesson) {
  const safeClick = async (locator) => {
    try { if (await locator.count() && await locator.isVisible() && await locator.isEnabled()) { await locator.click({ timeout: 3_000, force: true }); return true; } }
    catch { /* Animated lesson screens can replace an element between checks. */ }
    return false;
  };
  await page.goto(`${APP_ORIGIN}/guides`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForTimeout(2200);
  const consent = page.getByRole("button", { name: /accept all|decline all/i }).first();
  if (await consent.count()) { await consent.click(); await page.waitForTimeout(500); }
  let courseLink = page.locator(`a[href*="${lesson.sourceGuideId}"]`).first();
  if (!await courseLink.count()) {
    const more = page.getByTestId("guides-list-more-button");
    if (await more.count()) { await more.click(); await page.waitForTimeout(500); }
  }
  await courseLink.waitFor({ state: "attached", timeout: 12_000 }).catch(() => {});
  if (!await courseLink.count()) {
    await page.goto(`${APP_ORIGIN}/other-guides`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(1800);
    courseLink = page.locator(`a[href*="${lesson.sourceGuideId}"]`).first();
    await courseLink.waitFor({ state: "attached", timeout: 12_000 }).catch(() => {});
  }
  if (!await courseLink.count()) throw new Error(`Course pathway link is unavailable for ${lesson.sourceGuideId}`);
  await courseLink.click(); await page.waitForTimeout(1800);
  let lessonEntry = page.getByText(lesson.title, { exact: true }).first();
  await lessonEntry.waitFor({ state: "attached", timeout: 10_000 }).catch(() => {});
  if (!await lessonEntry.count()) lessonEntry = page.getByText("Start", { exact: true }).first();
  if (!await lessonEntry.count()) throw new Error(`Lesson entry is unavailable on pathway: ${lesson.title}`);
  await lessonEntry.click({ force: true }); await page.waitForTimeout(1800);
  const readButton = page.getByRole("button", { name: "Read", exact: true });
  if (await readButton.count()) {
    await readButton.click();
    await page.waitForFunction(() => (document.body?.innerText.trim().length ?? 0) > 20, null, { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(500);
  }
  const correctLabels = lesson.blocks.flatMap((block) => block.type === "single-choice" || block.type === "multi-choice" ? block.options.filter((option) => option.isCorrect).map((option) => option.label) : []);
  const correctTokens = lesson.blocks.flatMap((block) => block.type === "fill-in-blank" ? block.correctTokens : []);
  const matchingPairs = lesson.blocks.flatMap((block) => {
    if (block.type !== "practice" || !block.practiceType?.includes("matching")) return [];
    const source = record(block.rawContent); const left = list(source.left_pairs).map(record).sort((a, b) => Number(a.ordering) - Number(b.ordering)); const right = list(source.right_pairs).map(record).sort((a, b) => Number(a.ordering) - Number(b.ordering));
    return left.map((item, index) => ({ left: text(item.content), right: text(right[index]?.content) })).filter((pair) => pair.left && pair.right);
  });
  for (let step = 0; step < 240; step += 1) {
    if (headed && step > 0 && step % 20 === 0) {
      const visibleButtons = await page.locator("button").evaluateAll((items) => items.filter((item) => item.offsetParent !== null).map((item) => `${(item.textContent ?? "").trim()}:${item.disabled ? "disabled" : "enabled"}`).filter(Boolean).slice(0, 12));
      console.log(`[complete] ${lesson.title} step ${step}: ${visibleButtons.join(" | ")}`);
    }
    if (await page.locator('iframe[src*="captcha"], iframe[src*="challenge"], [data-captcha]').count()) throw new Error("CAPTCHA encountered while completing lesson");
    const finish = page.getByRole("button", { name: /finish lesson/i }).filter({ visible: true }); if (await safeClick(finish)) { await page.waitForTimeout(500); return; }
    const submit = page.getByRole("button", { name: "Submit", exact: true });
    if (await submit.count() === 1 && await submit.isVisible()) {
      for (const label of correctLabels) {
        const option = page.locator("label").filter({ hasText: label }).filter({ visible: true }).first();
        if (await option.count() && await option.locator("input:not([disabled])").count()) await safeClick(option);
      }
      if (await safeClick(submit)) { await page.waitForTimeout(250); continue; }
      await page.waitForTimeout(250); continue;
    }
    const check = page.getByRole("button", { name: "Check", exact: true });
    if (await check.count() === 1 && await check.isVisible()) { for (const token of correctTokens) { const choice = page.getByRole("button", { name: token, exact: true }).filter({ visible: true }); if (await choice.count() === 1) await safeClick(choice); } await safeClick(check); await page.waitForTimeout(250); continue; }
    let matched = false;
    const desiredRightOrder = matchingPairs.map((pair) => pair.right);
    const visibleRight = [];
    for (const name of desiredRightOrder) {
      const locator = page.getByRole("button", { name, exact: true }).filter({ visible: true }); const box = await locator.boundingBox().catch(() => null);
      if (box) visibleRight.push({ name, locator, y: box.y });
    }
    visibleRight.sort((a, b) => a.y - b.y);
    for (let pairIndex = 0; pairIndex < desiredRightOrder.length && visibleRight.length === desiredRightOrder.length; pairIndex += 1) {
      if (visibleRight[pairIndex].name === desiredRightOrder[pairIndex]) continue;
      const desired = visibleRight.find((item) => item.name === desiredRightOrder[pairIndex]);
      if (desired) { try { await desired.locator.dragTo(visibleRight[pairIndex].locator, { timeout: 3_000 }); matched = true; } catch { /* Retry after the current animation settles. */ } }
      break;
    }
    if (matched) { await page.waitForTimeout(500); continue; }
    const continueButton = page.getByRole("button", { name: "Continue", exact: true }).filter({ visible: true }); if (await safeClick(continueButton)) { await page.waitForTimeout(250); continue; }
    const skip = page.getByRole("button", { name: "Skip practice", exact: true }).filter({ visible: true }); if (await safeClick(skip)) { await page.waitForTimeout(250); continue; }
    if (await page.getByText(/lesson complete|completed/i).count()) return;
    const buttons = (await page.locator("button").allTextContents()).map((value) => value.trim()).filter(Boolean).slice(0, 12);
    const body = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim().slice(0, 240);
    throw new Error(`No supported next action on ${lesson.readUrl}; buttons=${JSON.stringify(buttons)}; page=${JSON.stringify(body)}`);
  }
  const buttons = await page.locator("button").evaluateAll((items) => items.filter((item) => item.offsetParent !== null).map((item) => ({ text: (item.textContent ?? "").trim(), disabled: item.disabled, ariaDisabled: item.getAttribute("aria-disabled") })).slice(0, 24));
  const body = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim().slice(-800);
  throw new Error(`Lesson exceeded 240 interaction steps: ${lesson.readUrl}; buttons=${JSON.stringify(buttons)}; pageTail=${JSON.stringify(body)}`);
}

async function scrapeCourse(page, context, guide, checkpoint, budget) {
  const detail = await apiGet(page, `guides/v2/${guide.sourceId}`); const units = guideUnits(detail);
  const course = { schemaVersion: 3, id: guide.id, sourceId: guide.sourceId, kind: guide.kind, title: guide.title, duration: guide.duration, categories: guide.categories, sourceUpdatedAt: text(record(unwrap(detail)).updated_at, record(unwrap(detail)).updatedAt) || undefined, units: [] };
  const existingPath = join(COURSE_DIR, `${guide.id}.json`);
  const existing = command === "resume" && existsSync(existingPath) ? JSON.parse(await readFile(existingPath, "utf8")) : null;
  const existingLessons = new Map((existing?.units ?? []).flatMap((unit) => unit.lessons ?? []).map((lesson) => [lesson.sourceId, lesson]));
  const media = Object.fromEntries((existing?.media ?? []).map((asset) => [asset.sourceUrl, asset]));
  for (const unit of units) {
    if (budget.remaining <= 0) break;
    const normalizedUnit = { sourceId: unit.sourceId, title: unit.title || undefined, order: unit.order, lessons: [] };
    for (const [lessonIndex, lessonValue] of unit.lessons.entries()) {
      if (budget.remaining <= 0) break;
      const lessonMeta = record(lessonValue); const lessonId = text(lessonMeta.id); if (!lessonId) throw new Error(`Course ${guide.title} contains a lesson without an id`);
      const checkpointKey = `${guide.sourceId}:${lessonId}`;
      if (command === "resume" && checkpoint.completedLessons[checkpointKey] && existingLessons.has(lessonId)) {
        normalizedUnit.lessons.push(existingLessons.get(lessonId));
        budget.remaining -= 1;
        continue;
      }
      const raw = await fetchPracticePayloads(page, guide.sourceId, await apiGet(page, `guides/v2/${guide.sourceId}/lessons/${lessonId}`));
      let lesson = normalizeCoursivLesson(raw, { guideId: guide.sourceId, unitId: unit.sourceId, sourceId: lessonId, title: text(lessonMeta.name, lessonMeta.title), slug: slugifyCoursiv(text(lessonMeta.name, lessonMeta.title, lessonId)), order: Number(lessonMeta.ordering ?? lessonMeta.order ?? lessonIndex) });
      for (const url of imageUrls(raw)) if (!media[url]) media[url] = await downloadImage(context, url);
      lesson = replaceLocalMedia(lesson, media); normalizedUnit.lessons.push(lesson);
      budget.remaining -= 1;
      checkpoint.completedLessons[checkpointKey] = { at: new Date().toISOString(), sha256: createHash("sha256").update(stringify(raw)).digest("hex") };
      await atomicWrite(CHECKPOINT_FILE, checkpoint); if (shouldComplete) await completeLesson(page, lesson); await sleep(350 + Math.floor(Math.random() * 300));
    }
    course.units.push(normalizedUnit);
  }
  ensureUniqueLessonSlugs(course);course.media = Object.values(media); await atomicWrite(join(COURSE_DIR, `${guide.id}.json`), course); return course;
}
function catalogEntry(course) {
  return { id: course.id, sourceId: course.sourceId, kind: course.kind, title: course.title, image:course.localImage??course.image, duration: course.duration, categories: course.categories, sections: course.units.map((unit) => ({ title: unit.title, sourceId: unit.sourceId, lessons: unit.lessons.map((lesson) => ({ id: lesson.slug, sourceId: lesson.sourceId, title: lesson.title, screenIds: lessonScreenIds(lesson), hasAudio: lesson.hasAudio })) })) };
}
async function writeCatalog(courses, failures) {
  const entries = courses.map(catalogEntry); const unknown = courses.flatMap(collectUnknownBlocks); const lessonCount = courses.reduce((total, course) => total + course.units.reduce((subtotal, unit) => subtotal + unit.lessons.length, 0), 0);
  const screenCount = courses.reduce((total,course)=>total+course.units.reduce((unitTotal,unit)=>unitTotal+unit.lessons.reduce((lessonTotal,lesson)=>lessonTotal+lessonScreenIds(lesson).length,0),0),0);
  const manifest = { schemaVersion: 3, scrapedAt: new Date().toISOString(), expectedBaseline: BASELINE, courses: entries.map((entry) => ({ id: entry.id, sourceId: entry.sourceId, kind: entry.kind, title: entry.title, duration: entry.duration, lessonCount: entry.sections.reduce((total, section) => total + section.lessons.length, 0), file: `courses/${entry.id}.json` })), totals: { courses: entries.length, lessons: lessonCount, screens: screenCount, unknownBlocks: unknown.length, failedLessons: failures.length } };
  await atomicWrite(MANIFEST_FILE, manifest);
  await atomicWrite(GENERATED_CATALOG, `import type { CoursivCatalogEntry } from "../coursiv-content";\n\n// Generated by scripts/scrape-coursiv.mjs.\nexport const coursivCatalog: CoursivCatalogEntry[] = ${JSON.stringify(entries, null, 2)};\n`);
  await atomicWrite(REPORT_FILE, { generatedAt: manifest.scrapedAt, baseline: BASELINE, totals: manifest.totals, baselineDrift: { courses: entries.length - BASELINE.courses, lessons: lessonCount - BASELINE.lessons }, unknownBlocks: unknown, failures });
  return manifest;
}
async function loadCourses() {
  const files = existsSync(COURSE_DIR) ? (await readdir(COURSE_DIR)).filter((file) => file.endsWith(".json")) : [];
  return Promise.all(files.map(async (file) => JSON.parse(await readFile(join(COURSE_DIR, file), "utf8"))));
}
async function runDiscover() {
  const { browser, page } = await openContext();
  try { await ensureAuthenticated(page); const guides = await discoverGuides(page); const lessons = guides.reduce((total, guide) => total + guide.lessonsCount, 0); await atomicWrite(CHECKPOINT_FILE, { schemaVersion: 1, discoveredAt: new Date().toISOString(), guides, completedLessons: {} }); console.log(JSON.stringify({ courses: guides.length, lessons, baseline: BASELINE, auth: AUTH_FILE }, null, 2)); }
  finally { await browser.close(); }
}
async function runScrape() {
  const { browser, context, page } = await openContext(); const failures = [];
  try {
    await ensureAuthenticated(page); const guides = await discoverGuides(page); const selectedGuides = requestedCourse ? guides.filter((guide) => guide.id === requestedCourse || guide.sourceId === requestedCourse || guide.title.toLowerCase() === requestedCourse.toLowerCase()) : guides;
    if (!selectedGuides.length) throw new Error(`No discovered course matches --course=${requestedCourse}`);
    const checkpoint = existsSync(CHECKPOINT_FILE) ? JSON.parse(await readFile(CHECKPOINT_FILE, "utf8")) : { schemaVersion: 1, discoveredAt: new Date().toISOString(), guides, completedLessons: {} }; const courses = []; const budget = { remaining: maxLessons };
    for (const guide of selectedGuides) { if (budget.remaining <= 0) break; try { courses.push(await scrapeCourse(page, context, guide, checkpoint, budget)); } catch (error) { failures.push({ courseId: guide.id, sourceId: guide.sourceId, message: safeError(error) }); await atomicWrite(REPORT_FILE, { generatedAt: new Date().toISOString(), failures }); } }
    const manifest = await writeCatalog(courses, failures); console.log(JSON.stringify(manifest.totals, null, 2)); if (failures.length || manifest.totals.unknownBlocks) process.exitCode = 2;
  } finally { await browser.close(); }
}
async function runVerify() {
  const courses = await loadCourses(); const failures = []; const ids = new Set();
  for (const course of courses) for (const unit of course.units) for (const lesson of unit.lessons) { const key = `${course.sourceId}:${lesson.sourceId}`; if (ids.has(key)) failures.push({ lessonId: key, message: "Duplicate source lesson id" }); ids.add(key); if (!lesson.screens?.length) failures.push({ lessonId: key, message: "Lesson has no normalized screens" }); const screenIds=new Set();for(const screen of lesson.screens??[]){if(screenIds.has(screen.id))failures.push({lessonId:key,screenId:screen.id,message:"Duplicate screen id"});screenIds.add(screen.id);if(!screen.blocks?.length)failures.push({lessonId:key,screenId:screen.id,message:"Screen has no normalized blocks"});} const blocks=lesson.screens?.flatMap((screen)=>screen.blocks)??lesson.blocks??[];if (blocks.some((block) => (block.type === "single-choice" || block.type === "multi-choice" || block.type === "true-false") && (!block.options.length || !block.options.some((option) => option.isCorrect)))) failures.push({ lessonId: key, message: "Quiz is missing options or correct answers" }); }
  for (const course of courses) for (const asset of course.media ?? []) { const path = join(ROOT, "public", asset.localSrc.replace(/^\//, "")); if (!existsSync(path)) failures.push({ asset: asset.localSrc, message: "Localized image is missing" }); else if (createHash("sha256").update(await readFile(path)).digest("hex") !== asset.sha256) failures.push({ asset: asset.localSrc, message: "Localized image checksum mismatch" }); }
  const manifest = await writeCatalog(courses, failures); console.log(JSON.stringify({ ...manifest.totals, baselineDrift: { courses: manifest.totals.courses - BASELINE.courses, lessons: manifest.totals.lessons - BASELINE.lessons } }, null, 2)); if (!courses.length || !manifest.totals.lessons || failures.length || manifest.totals.unknownBlocks) process.exitCode = 2;
}

async function downloadImageWithFetch(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Image returned ${response.status}: ${url}`);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) throw new Error(`Expected image but received ${contentType || "unknown"}: ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const hash = createHash("sha256").update(bytes).digest("hex");
  const contentExtension = contentType.split("/")[1]?.split(";")[0]?.replace("jpeg", "jpg").replace("svg+xml", "svg");
  const extension = contentExtension || extname(new URL(url).pathname).slice(1) || "bin";
  const name = `${hash}.${extension}`; const path = join(MEDIA_DIR, name);
  if (!existsSync(path)) await writeFile(path, bytes);
  return { localSrc:`/coursiv-media/${name}`,sha256:hash,bytes:bytes.length,sourceUrl:url };
}

function findFreshAssetUrl(value,fileName,depth=0){if(depth>14||value==null)return"";if(typeof value==="string")return /^https?:\/\//.test(value)&&decodeURIComponent(new URL(value).pathname).endsWith(`/${fileName}`)?value:"";if(Array.isArray(value)){for(const item of value){const found=findFreshAssetUrl(item,fileName,depth+1);if(found)return found}return""}if(typeof value==="object")for(const child of Object.values(value)){const found=findFreshAssetUrl(child,fileName,depth+1);if(found)return found}return""}
async function refreshExpiredImageUrl(course,lesson,staleUrl){
  const storage=JSON.parse(await readFile(AUTH_FILE,"utf8"));const token=list(storage.cookies).find((cookie)=>cookie.name==="auth.access_token")?.value;if(!token)throw new Error("Coursiv auth token is unavailable for refreshing an expired asset URL");
  const response=await fetch(`https://api.production.coursiv.io/guides/v2/${course.sourceId}/lessons/${lesson.sourceId}`,{headers:{Accept:"application/json",Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(30_000)});if(!response.ok)throw new Error(`Lesson refresh returned ${response.status}`);
  const fileName=decodeURIComponent(new URL(staleUrl).pathname).split("/").at(-1);const fresh=fileName?findFreshAssetUrl(await response.json(),fileName):"";if(!fresh)throw new Error(`A refreshed URL was not found for ${fileName??"expired asset"}`);
  return {...await downloadImageWithFetch(fresh),sourceUrl:staleUrl};
}
async function writeFallbackImage(sourceUrl){const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#d9d5ff"/><stop offset="1" stop-color="#776cff"/></linearGradient></defs><rect width="1200" height="675" rx="36" fill="url(#g)"/><circle cx="940" cy="170" r="125" fill="#fff" opacity=".22"/><circle cx="250" cy="535" r="180" fill="#fff" opacity=".16"/><text x="600" y="320" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-size="54" font-weight="700">Coursiv</text><text x="600" y="382" text-anchor="middle" fill="#f3f1ff" font-family="Arial,sans-serif" font-size="25">Course illustration</text></svg>`;const bytes=Buffer.from(svg);const hash=createHash("sha256").update(bytes).digest("hex");const name=`${hash}.svg`;const path=join(MEDIA_DIR,name);if(!existsSync(path))await writeFile(path,bytes);return{localSrc:`/coursiv-media/${name}`,sha256:hash,bytes:bytes.length,sourceUrl,fallback:true}}

async function runMigrate() {
  const courses = await loadCourses(); const failures=[];const checkpoint=existsSync(CHECKPOINT_FILE)?JSON.parse(await readFile(CHECKPOINT_FILE,"utf8")):null;const guideBySourceId=new Map(list(checkpoint?.guides).map((guide)=>[guide.sourceId??guide.source?.id,guide]));
  for (const course of courses) {
    const media = Object.fromEntries((course.media??[]).map((asset)=>[asset.sourceUrl,asset]));
    const missing = new Set();const owners=new Map();
    const guide=guideBySourceId.get(course.sourceId);const coverUrl=text(guide?.source?.image,guide?.image,course.image);if(coverUrl&&!media[coverUrl])missing.add(coverUrl);
    for (const unit of course.units) for (const lesson of unit.lessons) for (const url of imageUrls(lesson.raw)) if(!media[url]){missing.add(url);owners.set(url,lesson)}
    const urls=[...missing];
    for(let start=0;start<urls.length;start+=8){
      const batch=urls.slice(start,start+8);const results=await Promise.allSettled(batch.map(downloadImageWithFetch));
      for(const [index,result] of results.entries()){if(result.status==="fulfilled")media[batch[index]]=result.value;else{try{media[batch[index]]=await refreshExpiredImageUrl(course,owners.get(batch[index]),batch[index])}catch{media[batch[index]]=await writeFallbackImage(batch[index])}}}
    }
    course.schemaVersion=3;
    if(coverUrl){course.image=coverUrl;course.localImage=media[coverUrl]?.localSrc}
    course.units=course.units.map((unit)=>({...unit,lessons:unit.lessons.map((lesson)=>replaceLocalMedia(normalizeCoursivLesson(lesson.raw,{guideId:course.sourceId,unitId:unit.sourceId,sourceId:lesson.sourceId,title:lesson.title,slug:lesson.slug,order:lesson.order}),media))}));
    ensureUniqueLessonSlugs(course);course.media=Object.values(media);await atomicWrite(join(COURSE_DIR,`${course.id}.json`),course);
  }
  const manifest=await writeCatalog(courses,failures);console.log(JSON.stringify(manifest.totals,null,2));if(failures.length||manifest.totals.unknownBlocks)process.exitCode=2;
}
async function runComplete() {
  const courses = await loadCourses();
  const selected = requestedCourse ? courses.filter((course) => course.id === requestedCourse || course.sourceId === requestedCourse || course.title.toLowerCase() === requestedCourse.toLowerCase()) : courses;
  if (!selected.length) throw new Error(`No scraped course matches --course=${requestedCourse ?? "all"}`);
  const checkpoint = existsSync(CHECKPOINT_FILE) ? JSON.parse(await readFile(CHECKPOINT_FILE, "utf8")) : { schemaVersion: 1, completedLessons: {} };
  checkpoint.uiCompletedLessons ??= {};
  const { browser, page } = await openContext(); let remaining = maxLessons;
  try {
    await ensureAuthenticated(page);
    for (const course of selected) for (const unit of course.units) for (const lesson of unit.lessons) {
      if (remaining <= 0) break;
      const key = `${course.sourceId}:${lesson.sourceId}`;
      if (!args.has("--force") && checkpoint.uiCompletedLessons[key]) continue;
      await completeLesson(page, lesson); checkpoint.uiCompletedLessons[key] = { at: new Date().toISOString() }; remaining -= 1; await atomicWrite(CHECKPOINT_FILE, checkpoint);
    }
    console.log(JSON.stringify({ completed: maxLessons === Number.POSITIVE_INFINITY ? Object.keys(checkpoint.uiCompletedLessons).length : maxLessons - remaining, checkpoint: CHECKPOINT_FILE }, null, 2));
  } finally { await browser.close(); }
}

await mkdir(COURSE_DIR, { recursive: true }); await mkdir(MEDIA_DIR, { recursive: true });
if (command === "auth") await authenticate();
else if (command === "discover") await runDiscover();
else if (command === "scrape" || command === "resume") await runScrape();
else if (command === "complete") await runComplete();
else if (command === "migrate") await runMigrate();
else if (command === "verify") await runVerify();
else console.log(`Usage:\n  npm run coursiv:auth\n  npm run coursiv:discover\n  npm run coursiv:scrape -- [--headed] [--no-complete] [--course=<id>] [--max-lessons=<n>]\n  npm run coursiv:resume -- [--headed] [--no-complete] [--course=<id>] [--max-lessons=<n>]\n  node --experimental-strip-types scripts/scrape-coursiv.mjs migrate\n  npm run coursiv:complete -- [--course=<id>] [--max-lessons=<n>]\n  npm run coursiv:verify`);
