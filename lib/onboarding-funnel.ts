export type OnboardingFunnelOption = {
  id: string;
  label: string;
  value: string | null;
  source: Record<string, unknown>;
};

export type OnboardingFunnelMedia = {
  reference: string;
  localSrc: string;
  sourceUrl: string;
  contentType: string;
  bytes: number;
  sha256: string;
};

export type OnboardingFunnelPage = {
  schemaVersion: number;
  id: string;
  index: number;
  path: string;
  slug: string | null;
  type: string;
  title: string;
  interaction: string;
  progress: { current: number | null; total: number };
  navigation: {
    previous: string | null;
    next: string | null;
    routing: { conditions: unknown[]; defaultEndsFlow: boolean };
  };
  content: Record<string, unknown>;
  options: OnboardingFunnelOption[];
  media: OnboardingFunnelMedia[];
  mediaReferences: string[];
  sourceUrl: string;
  raw: unknown;
  version?: number;
  updatedAt?: string;
  updatedBy?: string;
};

export type OnboardingFunnelManifest = {
  schemaVersion: number;
  source: {
    initialUrl: string;
    flowId: string;
    query: Record<string, string>;
  };
  scrapedAt: string;
  totals: {
    pages: number;
    questions: number;
    options: number;
    media: number;
    mediaFailures: number;
    unknownPageTypes: number;
    screenshotFailures: number;
  };
  pages: Array<{
    file: string;
    id: string;
    index: number;
    path: string;
    slug: string | null;
    title: string;
    type: string;
    interaction: string;
    optionCount: number;
    sha256: string;
  }>;
};

export type OnboardingFunnel = {
  manifest: OnboardingFunnelManifest;
  pages: OnboardingFunnelPage[];
};

const editableTextKeys = [
  "title",
  "subtitle",
  "description",
  "quizDuration",
  "loadingText",
  "listTitle",
] as const;

export type OnboardingPageEditableFields = {
  title: string;
  subtitle: string;
  description: string;
  options: OnboardingFunnelOption[];
};

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function onboardingPlainText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function nestedPageContent(page: OnboardingFunnelPage) {
  const blocks = page.content.blocks;
  if (!Array.isArray(blocks)) return null;
  const first = blocks[0] as { page?: unknown[] } | undefined;
  const nested = first?.page?.[0];
  return nested && typeof nested === "object" && !Array.isArray(nested)
    ? nested as Record<string, unknown>
    : null;
}

export function editableFields(page: OnboardingFunnelPage): OnboardingPageEditableFields {
  const nested = nestedPageContent(page);
  return {
    title:
      stringValue(page.content.title) ||
      page.title ||
      stringValue(nested?.title) ||
      (page.type === "selling-page" ? "Your Personalized AI Certificate Program is Ready!" : ""),
    subtitle:
      stringValue(page.content.subtitle) ||
      stringValue(page.content.quizDuration) ||
      stringValue(nested?.subtitle),
    description:
      stringValue(page.content.description) ||
      stringValue(page.content.loadingText) ||
      stringValue(page.content.listTitle) ||
      stringValue(nested?.description),
    options: page.options.map((option) => ({ ...option, source: { ...option.source } })),
  };
}

export function applyEditableFields(
  page: OnboardingFunnelPage,
  fields: OnboardingPageEditableFields,
): OnboardingFunnelPage {
  const content = { ...page.content };
  content.title = fields.title.trim();
  if ("quizDuration" in content && !("subtitle" in content)) content.quizDuration = fields.subtitle;
  else content.subtitle = fields.subtitle;
  if ("loadingText" in content) content.loadingText = fields.description;
  else if ("listTitle" in content && !("description" in content)) content.listTitle = fields.description;
  else content.description = fields.description;

  const options = fields.options.map((option, index) => {
    const source = { ...option.source };
    if ("title" in source) source.title = option.label;
    else if ("text" in source) source.text = option.label;
    else source.title = option.label;
    return {
      ...option,
      id: option.id || `option-${index + 1}`,
      label: option.label.trim(),
      source,
    };
  });

  if (Array.isArray(content.options)) content.options = options.map((option) => option.source);
  const group = content.optionsGroup;
  if (group && typeof group === "object" && !Array.isArray(group)) {
    content.optionsGroup = { ...(group as Record<string, unknown>), options: options.map((option) => option.source) };
  }

  return {
    ...page,
    title: fields.title.trim(),
    content,
    options,
  };
}

export function validateOnboardingPage(page: OnboardingFunnelPage) {
  const errors: string[] = [];
  if (!page.id.trim()) errors.push("Page ID is required.");
  const displayTitle = editableFields(page).title;
  if (!displayTitle.trim()) errors.push("Page title is required.");
  if (displayTitle.length > 180) errors.push("Page title must be 180 characters or fewer.");
  if (!Number.isInteger(page.index) || page.index < 0) errors.push("Page order must be a positive integer.");
  const optionIds = new Set<string>();
  page.options.forEach((option, index) => {
    if (!option.label.trim()) errors.push(`Option ${index + 1} needs a label.`);
    if (!option.id.trim()) errors.push(`Option ${index + 1} needs a stable ID.`);
    if (optionIds.has(option.id)) errors.push(`Option ID "${option.id}" is duplicated.`);
    optionIds.add(option.id);
  });
  if (page.interaction === "selection" && page.options.length < 2) {
    errors.push("Selection pages need at least two options.");
  }
  return errors;
}

export function pageSummary(page: OnboardingFunnelPage) {
  const fields = editableFields(page);
  return {
    id: page.id,
    index: page.index,
    path: page.path,
    slug: page.slug,
    type: page.type,
    title: onboardingPlainText(fields.title),
    interaction: page.interaction,
    optionCount: page.options.length,
    version: page.version ?? 1,
  };
}

export function contentString(content: Record<string, unknown>, key: string) {
  return typeof content[key] === "string" ? content[key] as string : "";
}

export function editableContentKeys() {
  return [...editableTextKeys];
}
