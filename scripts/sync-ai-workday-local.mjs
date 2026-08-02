import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  AI_WORKDAY_MIGRATION_ID,
  onboardingCopy,
} from "../content/ai-workday/blueprint.mjs";

const root = join(process.cwd(), "content", "coursiv", "onboarding");
const manifestPath = join(root, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

function slug(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function updateNestedWildPages(content, copy) {
  if (!Array.isArray(content.blocks)) return content;
  return {
    ...content,
    blocks: content.blocks.map((block) => {
      if (!block || typeof block !== "object" || !Array.isArray(block.page)) return block;
      return {
        ...block,
        page: block.page.map((nested) =>
          nested && typeof nested === "object"
            ? {
                ...nested,
                title: copy.title,
                subtitle: copy.subtitle ?? "",
                description: copy.description ?? copy.subtitle ?? "",
              }
            : nested,
        ),
      };
    }),
  };
}

function updatePage(page, copy) {
  let content = {
    ...(page.content ?? {}),
    title: copy.title,
    subtitle: copy.subtitle ?? "",
    description: copy.description ?? "",
  };
  const options = (copy.options ?? []).map((label, index) => {
    const optionSlug = slug(label) || `option-${index + 1}`;
    return {
      id: `${copy.id}--${optionSlug}`,
      label,
      value: optionSlug,
      source: {
        actions: [],
        slug: optionSlug,
        title: label,
      },
    };
  });
  if (copy.options) {
    content.options = options.map((option) => option.source);
    if (content.optionsGroup && typeof content.optionsGroup === "object") {
      content.optionsGroup = {
        ...content.optionsGroup,
        options: options.map((option) => option.source),
      };
    }
  }
  content = updateNestedWildPages(content, copy);
  return {
    ...page,
    title: copy.title,
    content,
    options: copy.options ? options : page.options ?? [],
    migrationId: AI_WORKDAY_MIGRATION_ID,
  };
}

for (const copy of onboardingCopy) {
  const file = `pages/${copy.id}.json`;
  const filePath = join(root, file);
  const page = JSON.parse(await readFile(filePath, "utf8"));
  const updated = updatePage(page, copy);
  const output = `${JSON.stringify(updated, null, 2)}\n`;
  await writeFile(filePath, output);
  const entry = manifest.pages.find((item) => item.id === copy.id);
  if (!entry) throw new Error(`Manifest entry missing for ${copy.id}`);
  entry.title = copy.title;
  entry.optionCount = updated.options.length;
  entry.sha256 = createHash("sha256").update(output).digest("hex");
}

manifest.aiWorkdayMigrationId = AI_WORKDAY_MIGRATION_ID;
manifest.updatedAt = new Date().toISOString();
manifest.totals.options = manifest.pages.reduce(
  (total, page) => total + page.optionCount,
  0,
);
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(
  JSON.stringify({
    ok: true,
    migrationId: AI_WORKDAY_MIGRATION_ID,
    pagesUpdated: onboardingCopy.length,
  }),
);
