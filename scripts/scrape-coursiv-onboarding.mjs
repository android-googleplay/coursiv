#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { chromium } from "playwright";

const ROOT = resolve(import.meta.dirname, "..");
const CONTENT_DIR = join(ROOT, "content", "coursiv", "onboarding");
const PAGE_DIR = join(CONTENT_DIR, "pages");
const REFERENCE_DIR = join(CONTENT_DIR, "reference");
const MEDIA_DIR = join(ROOT, "public", "coursiv-onboarding-media");
const MANIFEST_FILE = join(CONTENT_DIR, "manifest.json");
const SHARED_FILE = join(CONTENT_DIR, "shared.json");
const REPORT_FILE = join(CONTENT_DIR, "verify-report.json");
const DEFAULT_ENTRY =
  "https://coursiv.io/dynamic?prc_id=1185&page_name=home&component_name=cta_hero&utm_source=organic_seo_website&utm_type=Product&utm_platform=Webblog&utm_placement=page&content_id=Homepage_Hero";
const DEFAULT_ASSET_ORIGIN = "https://d3kigabz1zn79w.cloudfront.net";
const EXPECTED_QUESTION_COUNT = 16;
const EXPECTED_PAGE_COUNT = 29;
const MAX_PAGES = 60;
const RETRIES = 4;
const command = process.argv[2] ?? "scrape";
const rawArgs = process.argv.slice(3);
const args = new Set(rawArgs);
const optionValue = (name) =>
  rawArgs.find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1);
const entryUrl = optionValue("--entry") ?? DEFAULT_ENTRY;
const captureScreenshots = args.has("--screenshots");
const headed = args.has("--headed");

const KNOWN_PAGE_TYPES = new Set([
  "gender-select-landing",
  "classic-social-proof",
  "question-page",
  "wild-page",
  "followup-teaser-page",
  "magic-page",
  "email-page",
  "enter-name-page",
  "personalized-summary-page",
  "before-after-page-personalized",
  "solution-pitch-page",
  "social-proof-testimonials-page",
  "selling-page",
]);

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stable(value[key])]),
  );
}

function stringify(value) {
  return `${JSON.stringify(stable(value), null, 2)}\n`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function atomicWrite(path, value) {
  const next = typeof value === "string" ? value : stringify(value);
  if (existsSync(path) && (await readFile(path, "utf8")) === next) return false;
  const temporary = `${path}.tmp`;
  await writeFile(temporary, next);
  await rename(temporary, path);
  return true;
}

function safeError(error) {
  return error instanceof Error ? error.message : String(error);
}

async function fetchWithRetry(url, options = {}) {
  let lastError;
  for (let attempt = 0; attempt < RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(30_000),
        headers: {
          Accept: options.accept ?? "*/*",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/138 Safari/537.36",
          ...options.headers,
        },
      });
      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(`${response.status} ${response.statusText}`);
      } else {
        return response;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveDelay) =>
      setTimeout(resolveDelay, 650 * 2 ** attempt),
    );
  }
  throw new Error(
    `Request failed after ${RETRIES} attempts: ${url} (${safeError(lastError)})`,
  );
}

function parseNextData(html, url) {
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
  );
  if (!match) throw new Error(`__NEXT_DATA__ is missing from ${url}`);
  try {
    return JSON.parse(match[1]);
  } catch (error) {
    throw new Error(`Invalid __NEXT_DATA__ at ${url}: ${safeError(error)}`);
  }
}

function pageId(pathname, index) {
  const slug = pathname
    .split("/")
    .filter(Boolean)
    .at(-1)
    ?.replace(/[^a-z0-9-]+/gi, "-")
    .replace(/^-|-$/g, "");
  return `${String(index + 1).padStart(2, "0")}-${slug || "home"}`;
}

function pageType(pageProps, pathname) {
  return (
    record(pageProps.pageContent).blockType ||
    (pathname.endsWith("/selling-page") ? "selling-page" : "unknown")
  );
}

function plainText(value) {
  return typeof value === "string"
    ? value
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim()
    : "";
}

function extractOptions(pageContent) {
  const content = record(pageContent);
  const options = list(record(content.optionsGroup).options).length
    ? list(record(content.optionsGroup).options)
    : list(content.options);
  return options.map((option, index) => {
    const source = record(option);
    return {
      id: String(source.id ?? source.value ?? `option-${index + 1}`),
      label: plainText(source.text ?? source.title ?? source.label),
      value: source.value ?? source.answer ?? source.text ?? null,
      source,
    };
  });
}

function isMediaReference(value) {
  if (typeof value !== "string") return false;
  const normalized = value.split("?")[0].split("#")[0];
  return /\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(normalized);
}

function collectMediaReferences(value, output = new Set(), depth = 0) {
  if (depth > 18 || value == null) return output;
  if (Array.isArray(value)) {
    for (const child of value) collectMediaReferences(child, output, depth + 1);
    return output;
  }
  if (typeof value === "object") {
    for (const child of Object.values(value))
      collectMediaReferences(child, output, depth + 1);
    return output;
  }
  if (isMediaReference(value)) output.add(value.trim());
  return output;
}

function resolveMediaUrl(reference) {
  if (/^https?:\/\//i.test(reference)) return reference;
  const path = reference
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${DEFAULT_ASSET_ORIGIN}/${path}`;
}

function extensionFor(contentType, url) {
  const fromContentType = contentType
    .split(";")[0]
    .split("/")[1]
    ?.replace("jpeg", "jpg")
    .replace("svg+xml", "svg");
  return (
    fromContentType ||
    extname(new URL(url).pathname).slice(1).toLowerCase() ||
    "bin"
  );
}

async function downloadMedia(reference) {
  const sourceUrl = resolveMediaUrl(reference);
  const response = await fetchWithRetry(sourceUrl);
  if (!response.ok)
    throw new Error(`Media returned ${response.status}: ${sourceUrl}`);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/"))
    throw new Error(
      `Expected image but received ${contentType || "unknown"}: ${sourceUrl}`,
    );
  const bytes = Buffer.from(await response.arrayBuffer());
  const checksum = sha256(bytes);
  const name = `${checksum}.${extensionFor(contentType, sourceUrl)}`;
  const path = join(MEDIA_DIR, name);
  if (!existsSync(path)) await writeFile(path, bytes);
  return {
    reference,
    sourceUrl,
    localSrc: `/coursiv-onboarding-media/${name}`,
    contentType,
    bytes: bytes.length,
    sha256: checksum,
  };
}

function routeUrl(entry, pathname) {
  const url = new URL(pathname, entry.origin);
  url.search = entry.search;
  if (pathname !== "/dynamic") {
    url.searchParams.set("block", pathname.split("/").filter(Boolean).at(-1));
  }
  return url;
}

async function scrapePages() {
  const entry = new URL(entryUrl);
  if (entry.protocol !== "https:" || entry.hostname !== "coursiv.io")
    throw new Error("--entry must be an https://coursiv.io URL");

  const pages = [];
  const visited = new Set();
  let pathname = entry.pathname.replace(/\/$/, "") || "/dynamic";
  let buildId = "";
  let shared = null;

  for (let index = 0; index < MAX_PAGES; index += 1) {
    if (visited.has(pathname))
      throw new Error(`Onboarding route loop detected at ${pathname}`);
    visited.add(pathname);

    const url = routeUrl(entry, pathname);
    const response = await fetchWithRetry(url, { accept: "text/html" });
    if (!response.ok)
      throw new Error(`Onboarding page returned ${response.status}: ${url}`);
    const html = await response.text();
    const nextData = parseNextData(html, url);
    const pageProps = record(record(nextData.props).pageProps);
    const content = record(pageProps.pageContent);
    const type = pageType(pageProps, pathname);
    const id = pageId(pathname, index);
    const references = [
      ...collectMediaReferences({
        pageContent: content,
        preloadImages: pageProps.preloadImages,
        goalBlock: pageProps.goalBlock,
        ...(index === 0
          ? {
              sellingPage: pageProps.sellingPage,
              discountSellingPage: pageProps.discountSellingPage,
            }
          : {}),
      }),
    ].sort();

    buildId ||= String(nextData.buildId ?? "");
    if (!shared) {
      shared = {
        schemaVersion: 1,
        source: {
          entryUrl: entry.href,
          prcId: Number(record(pageProps.pageMeta).prc_id ?? 0) || null,
          funnelVersion: record(pageProps.pageMeta).funnelVersion ?? null,
          buildId,
          language: record(pageProps.pageMeta).language ?? "en",
        },
        sellingPage: pageProps.sellingPage ?? [],
        discountSellingPage: pageProps.discountSellingPage ?? [],
        colorTokens: pageProps.colorTokens ?? [],
        featureGates: pageProps.featureGates ?? {},
        i18n: record(pageProps._nextI18Next),
      };
    }

    const canonicalContent =
      type === "selling-page"
        ? { blockType: type, blocks: pageProps.sellingPage ?? [] }
        : content;
    const page = {
      schemaVersion: 1,
      id,
      index,
      path: pathname,
      sourceUrl: url.href,
      type,
      title: plainText(
        content.title ?? content.question ?? content.quizDuration,
      ),
      slug: content.slug ?? null,
      progress: {
        current:
          Number(record(pageProps.pageMeta).questionPageCurrentStep) || null,
        total:
          Number(record(pageProps.pageMeta).questionPageTotalSteps) || null,
      },
      interaction:
        type === "question-page" || type === "gender-select-landing"
          ? "selection"
          : type === "email-page"
            ? "email"
            : type === "enter-name-page"
              ? "name"
              : "continue",
      options: extractOptions(content),
      content: canonicalContent,
      navigation: {
        previous: pageProps.prevPageUrl ?? null,
        next: pageProps.nextPageUrl ?? null,
        routing: pageProps.nextPageRouting ?? content.routing ?? null,
      },
      mediaReferences: references,
      raw: {
        pageMeta: pageProps.pageMeta ?? {},
        pageContent: pageProps.pageContent ?? null,
        prevPageUrl: pageProps.prevPageUrl ?? null,
        nextPageUrl: pageProps.nextPageUrl ?? null,
        nextPageRouting: pageProps.nextPageRouting ?? null,
        preloadImages: pageProps.preloadImages ?? [],
        preloadLotties: pageProps.preloadLotties ?? [],
        goalBlock: pageProps.goalBlock ?? null,
      },
    };
    pages.push(page);

    const nextPath = page.navigation.next;
    if (!nextPath) break;
    const resolvedNext = new URL(nextPath, entry.origin);
    if (
      resolvedNext.origin !== entry.origin ||
      !resolvedNext.pathname.startsWith("/dynamic")
    )
      throw new Error(`Refusing to crawl external onboarding route: ${nextPath}`);
    pathname = resolvedNext.pathname.replace(/\/$/, "");
  }

  if (!pages.length) throw new Error("No onboarding pages were discovered");
  return { entry, buildId, pages, shared };
}

async function downloadAllMedia(pages, shared) {
  const references = [
    ...collectMediaReferences({
      pages: pages.map((page) => ({
        content: page.content,
        raw: page.raw,
      })),
      sellingPage: shared.sellingPage,
      discountSellingPage: shared.discountSellingPage,
    }),
  ].sort();
  const assets = [];
  const failures = [];
  const concurrency = 8;

  for (let start = 0; start < references.length; start += concurrency) {
    const batch = references.slice(start, start + concurrency);
    const results = await Promise.allSettled(batch.map(downloadMedia));
    results.forEach((result, index) => {
      if (result.status === "fulfilled") assets.push(result.value);
      else
        failures.push({
          reference: batch[index],
          sourceUrl: resolveMediaUrl(batch[index]),
          message: safeError(result.reason),
        });
    });
  }

  assets.sort((a, b) => a.reference.localeCompare(b.reference));
  return { assets, failures };
}

async function captureReferenceScreenshots(entry, pages) {
  const browser = await chromium.launch({ headless: !headed });
  const capture = { viewports: {}, failures: [] };
  const viewports = [
    { id: "mobile", width: 393, height: 852, isMobile: true },
    { id: "desktop", width: 1440, height: 900, isMobile: false },
  ];

  try {
    for (const viewport of viewports) {
      const directory = join(REFERENCE_DIR, viewport.id);
      await mkdir(directory, { recursive: true });
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        isMobile: viewport.isMobile,
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      capture.viewports[viewport.id] = {
        width: viewport.width,
        height: viewport.height,
        screenshots: [],
      };

      for (const onboardingPage of pages) {
        const url = routeUrl(entry, onboardingPage.path);
        const file = `${onboardingPage.id}.png`;
        const path = join(directory, file);
        try {
          await page.goto(url.href, {
            waitUntil: "domcontentloaded",
            timeout: 45_000,
          });
          await page.waitForFunction(
            () =>
              (document.body?.innerText.trim().length ?? 0) > 15 &&
              !document.querySelector('img[alt="loader"]'),
            null,
            { timeout: 30_000 },
          );
          if (
            await page
              .locator(
                'iframe[src*="captcha"], iframe[src*="challenge"], [data-captcha]',
              )
              .count()
          )
            throw new Error("CAPTCHA encountered; capture stopped");
          await page.addStyleTag({
            content:
              "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}",
          });
          await page.screenshot({ path, fullPage: true });
          capture.viewports[viewport.id].screenshots.push({
            pageId: onboardingPage.id,
            file: `reference/${viewport.id}/${file}`,
            sha256: sha256(await readFile(path)),
          });
        } catch (error) {
          capture.failures.push({
            pageId: onboardingPage.id,
            viewport: viewport.id,
            message: safeError(error),
          });
        }
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
  return capture;
}

async function runScrape() {
  await Promise.all([
    mkdir(PAGE_DIR, { recursive: true }),
    mkdir(MEDIA_DIR, { recursive: true }),
    mkdir(REFERENCE_DIR, { recursive: true }),
  ]);
  const { entry, buildId, pages, shared } = await scrapePages();
  const { assets, failures: mediaFailures } = await downloadAllMedia(
    pages,
    shared,
  );
  const assetByReference = new Map(
    assets.map((asset) => [asset.reference, asset]),
  );
  const pageEntries = [];

  for (const page of pages) {
    const localizedPage = {
      ...page,
      media: page.mediaReferences
        .map((reference) => assetByReference.get(reference))
        .filter(Boolean),
    };
    const file = `pages/${page.id}.json`;
    const serialized = stringify(localizedPage);
    await atomicWrite(join(CONTENT_DIR, file), serialized);
    pageEntries.push({
      id: page.id,
      index: page.index,
      path: page.path,
      type: page.type,
      title: page.title,
      slug: page.slug,
      interaction: page.interaction,
      optionCount: page.options.length,
      file,
      sha256: sha256(serialized),
    });
  }

  const sharedSerialized = stringify(shared);
  await atomicWrite(SHARED_FILE, sharedSerialized);
  const capture = captureScreenshots
    ? await captureReferenceScreenshots(entry, pages)
    : null;
  const unknownPageTypes = pageEntries
    .filter((page) => !KNOWN_PAGE_TYPES.has(page.type))
    .map((page) => ({ pageId: page.id, type: page.type }));
  const manifest = {
    schemaVersion: 1,
    scrapedAt: new Date().toISOString(),
    source: {
      entryUrl: entry.href,
      prcId: shared.source.prcId,
      funnelVersion: shared.source.funnelVersion,
      buildId,
      language: shared.source.language,
    },
    shared: {
      file: "shared.json",
      sha256: sha256(sharedSerialized),
    },
    totals: {
      pages: pageEntries.length,
      questions: pageEntries.filter((page) => page.type === "question-page")
        .length,
      options: pageEntries.reduce(
        (total, page) => total + page.optionCount,
        0,
      ),
      media: assets.length,
      mediaFailures: mediaFailures.length,
      unknownPageTypes: unknownPageTypes.length,
      screenshotFailures: capture?.failures.length ?? 0,
    },
    pages: pageEntries,
    media: assets,
    mediaFailures,
    unknownPageTypes,
    capture,
  };
  await atomicWrite(MANIFEST_FILE, manifest);
  console.log(
    JSON.stringify(
      {
        source: manifest.source,
        totals: manifest.totals,
        output: CONTENT_DIR,
      },
      null,
      2,
    ),
  );
  if (mediaFailures.length || unknownPageTypes.length || capture?.failures.length)
    process.exitCode = 2;
}

async function runVerify() {
  const failures = [];
  if (!existsSync(MANIFEST_FILE))
    throw new Error(
      `Onboarding manifest is missing. Run npm run coursiv:onboarding:scrape first.`,
    );
  const manifest = JSON.parse(await readFile(MANIFEST_FILE, "utf8"));
  const pages = [];
  const ids = new Set();
  const paths = new Set();

  for (const pageEntry of list(manifest.pages)) {
    const path = join(CONTENT_DIR, pageEntry.file);
    if (!existsSync(path)) {
      failures.push({ pageId: pageEntry.id, message: "Page file is missing" });
      continue;
    }
    const serialized = await readFile(path, "utf8");
    if (sha256(serialized) !== pageEntry.sha256)
      failures.push({
        pageId: pageEntry.id,
        message: "Page checksum mismatch",
      });
    const page = JSON.parse(serialized);
    pages.push(page);
    if (ids.has(page.id))
      failures.push({ pageId: page.id, message: "Duplicate page id" });
    if (paths.has(page.path))
      failures.push({ pageId: page.id, message: "Duplicate page path" });
    ids.add(page.id);
    paths.add(page.path);
    if (!page.content)
      failures.push({ pageId: page.id, message: "Page content is missing" });
    if (!page.raw)
      failures.push({ pageId: page.id, message: "Raw payload is missing" });
    if (!KNOWN_PAGE_TYPES.has(page.type))
      failures.push({
        pageId: page.id,
        message: `Unknown page type: ${page.type}`,
      });
    if (
      page.type === "question-page" &&
      (!page.slug || !list(page.options).length)
    )
      failures.push({
        pageId: page.id,
        message: "Question is missing slug or options",
      });
  }

  pages.sort((a, b) => a.index - b.index);
  for (let index = 0; index < pages.length - 1; index += 1) {
    if (pages[index].navigation.next !== pages[index + 1].path)
      failures.push({
        pageId: pages[index].id,
        message: `Next route does not match ${pages[index + 1].path}`,
      });
  }

  for (const asset of list(manifest.media)) {
    const path = join(ROOT, "public", asset.localSrc.replace(/^\//, ""));
    if (!existsSync(path))
      failures.push({
        asset: asset.reference,
        message: "Localized media is missing",
      });
    else if (sha256(await readFile(path)) !== asset.sha256)
      failures.push({
        asset: asset.reference,
        message: "Localized media checksum mismatch",
      });
  }

  if (pages.length !== EXPECTED_PAGE_COUNT)
    failures.push({
      message: `Expected ${EXPECTED_PAGE_COUNT} pages, found ${pages.length}`,
    });
  const questionCount = pages.filter(
    (page) => page.type === "question-page",
  ).length;
  if (questionCount !== EXPECTED_QUESTION_COUNT)
    failures.push({
      message: `Expected ${EXPECTED_QUESTION_COUNT} questions, found ${questionCount}`,
    });
  if (list(manifest.mediaFailures).length)
    failures.push({
      message: `${manifest.mediaFailures.length} media downloads failed`,
    });
  if (list(record(manifest.capture).failures).length)
    failures.push({
      message: `${manifest.capture.failures.length} screenshot captures failed`,
    });

  const report = {
    verifiedAt: new Date().toISOString(),
    totals: {
      pages: pages.length,
      questions: questionCount,
      options: pages.reduce(
        (total, page) => total + list(page.options).length,
        0,
      ),
      media: list(manifest.media).length,
      failures: failures.length,
    },
    failures,
  };
  await atomicWrite(REPORT_FILE, report);
  console.log(JSON.stringify(report, null, 2));
  if (failures.length) process.exitCode = 2;
}

if (command === "scrape") await runScrape();
else if (command === "verify") await runVerify();
else
  console.log(`Usage:
  npm run coursiv:onboarding:scrape
  npm run coursiv:onboarding:scrape -- --screenshots [--headed] [--entry=<url>]
  npm run coursiv:onboarding:verify`);
