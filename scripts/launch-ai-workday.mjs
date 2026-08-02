import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  AI_WORKDAY_MIGRATION_ID,
  aiWorkdayCourses,
  onboardingCopy,
} from "../content/ai-workday/blueprint.mjs";

const apply = process.argv.includes("--apply");
const actorId = "codex-ai-workday-migration";
const actorEmail = "system@coursiv.local";
const reason = "Launch AI Workday while preserving and unpublishing all existing course content";
const targetCourseIds = new Set(aiWorkdayCourses.map((course) => course.id));
const root = process.cwd();

const app = getApps()[0] ?? initializeApp({ credential: applicationDefault() });
const database = getFirestore(app);
database.settings({ preferRest: true });

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function checksum(documents) {
  const canonical = [...documents].sort(
    (left, right) =>
      left.collection.localeCompare(right.collection) ||
      left.documentId.localeCompare(right.documentId),
  );
  return createHash("sha256").update(stable(canonical)).digest("hex");
}

function slug(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function compactAuditValue(value) {
  const json = JSON.stringify(value);
  return json.length > 12_000
    ? {
        truncated: true,
        bytes: Buffer.byteLength(json),
        sha256: createHash("sha256").update(json).digest("hex"),
      }
    : value;
}

function auditRecord({ action, targetType, targetId, before = null, after = null }) {
  const now = new Date();
  return {
    id: randomUUID(),
    actorId,
    actorEmail,
    actorRole: "admin",
    action,
    targetType,
    targetId,
    reason,
    before: compactAuditValue(before),
    after: compactAuditValue(after),
    requestId: `${AI_WORKDAY_MIGRATION_ID}-${randomUUID()}`,
    ipHash: null,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 730 * 86_400_000),
  };
}

async function readAllowlistedContent() {
  const documents = [];
  for (const collection of ["courses", "lessons", "contentMetadata"]) {
    const snapshot = await database.collection(collection).get();
    for (const document of snapshot.docs) {
      documents.push({
        collection,
        documentId: document.id,
        data: document.data(),
      });
    }
  }
  return documents;
}

async function readConsistentContent() {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const before = await database.collection("contentMetadata").doc("learner-app").get();
    const documents = await readAllowlistedContent();
    const after = await database.collection("contentMetadata").doc("learner-app").get();
    const stableVersion =
      (before.updateTime &&
        after.updateTime &&
        before.updateTime.isEqual(after.updateTime)) ||
      (!before.exists && !after.exists);
    if (stableVersion) return documents;
  }
  throw new Error("Content changed while preparing the checkpoint. Run the migration again.");
}

function validateSnapshot(documents) {
  const allowed = new Set(["courses", "lessons", "contentMetadata"]);
  for (const document of documents) {
    if (!allowed.has(document.collection)) {
      throw new Error(`Forbidden checkpoint collection: ${document.collection}`);
    }
  }
  const lessons = new Map(
    documents
      .filter((item) => item.collection === "lessons")
      .map((item) => [item.documentId, item.data]),
  );
  for (const course of documents.filter((item) => item.collection === "courses")) {
    const summaries = Array.isArray(course.data.lessonSummaries)
      ? course.data.lessonSummaries
      : [];
    for (const summary of summaries) {
      if (typeof summary.id !== "string") {
        throw new Error(`Course ${course.documentId} has a lesson summary without an ID`);
      }
      const storedLesson = lessons.get(summary.id);
      if (!storedLesson) {
        throw new Error(`Course ${course.documentId} references missing lesson ${summary.id}`);
      }
      if (storedLesson.courseId !== course.documentId) {
        throw new Error(`Lesson ${summary.id} belongs to the wrong course`);
      }
      if (!Array.isArray(storedLesson.screens)) {
        throw new Error(`Lesson ${summary.id} has invalid screens`);
      }
    }
  }
}

async function createCheckpoint(documents) {
  const now = new Date();
  const id = `${now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${randomUUID()}`;
  const reference = database.collection("contentCheckpoints").doc(id);
  const counts = { courses: 0, lessons: 0, contentMetadata: 0 };
  const contentMetadata = documents.find(
    (item) => item.collection === "contentMetadata" && item.documentId === "learner-app",
  );
  const base = {
    id,
    kind: "manual",
    status: "creating",
    label: "Before AI Workday launch",
    reason,
    createdAt: now.toISOString(),
    createdBy: actorId,
    expiresAt: new Date(now.getTime() + 90 * 86_400_000).toISOString(),
    contentVersion:
      typeof contentMetadata?.data.contentVersion === "string"
        ? contentMetadata.data.contentVersion
        : null,
    counts,
    checksum: "",
  };
  await reference.create(base);
  try {
    const chunks = [];
    let chunk = [];
    let chunkBytes = 0;
    for (const document of documents) {
      const documentBytes = Buffer.byteLength(JSON.stringify(document));
      if (chunk.length && (chunk.length >= 40 || chunkBytes + documentBytes > 4_000_000)) {
        chunks.push(chunk);
        chunk = [];
        chunkBytes = 0;
      }
      chunk.push(document);
      chunkBytes += documentBytes;
    }
    if (chunk.length) chunks.push(chunk);
    for (const documentsChunk of chunks) {
      const batch = database.batch();
      for (const document of documentsChunk) {
        counts[document.collection] += 1;
        const documentHash = createHash("sha1").update(document.documentId).digest("hex");
        batch.create(
          reference.collection("documents").doc(`${document.collection}__${documentHash}`),
          document,
        );
      }
      await batch.commit();
    }
    const ready = { ...base, status: "ready", counts, checksum: checksum(documents) };
    await reference.set(ready);
    return ready;
  } catch (error) {
    await reference.set(
      {
        status: "failed",
        error: error instanceof Error ? error.message : "Checkpoint failed",
      },
      { merge: true },
    );
    throw error;
  }
}

function lessonDocument(course, lessonSpec, lessonIndex, now) {
  const lessonSlug = slug(lessonSpec.title);
  const lessonId = `${course.id}__${lessonSlug}`;
  const sourceUnitId = `${course.id}-core`;
  const baseId = `${course.id}-${lessonIndex + 1}`;
  const screens = [
    {
      id: `${baseId}-learn`,
      sourcePageId: `${baseId}-learn`,
      order: 0,
      type: "content",
      title: "Learn",
      presentation: "content",
      interactionPolicy: "read",
      blocks: [
        {
          id: `${baseId}-learn-heading`,
          type: "heading",
          level: 2,
          text: lessonSpec.title,
        },
        {
          id: `${baseId}-learn-body`,
          type: "paragraph",
          text: lessonSpec.objective,
        },
        {
          id: `${baseId}-learn-list`,
          type: "list",
          ordered: true,
          items: [
            "Start with the outcome and the evidence you already have.",
            "Give AI a narrow role, clear context and explicit constraints.",
            "Review the result with human judgment before using it.",
          ],
        },
      ],
    },
    {
      id: `${baseId}-example`,
      sourcePageId: `${baseId}-example`,
      order: 1,
      type: "content",
      title: "Example",
      presentation: "callout",
      interactionPolicy: "read",
      blocks: [
        {
          id: `${baseId}-example-heading`,
          type: "heading",
          level: 2,
          text: "A Better Way to Approach It",
        },
        {
          id: `${baseId}-example-body`,
          type: "paragraph",
          text: `Instead of asking AI to “handle” ${lessonSpec.title.toLowerCase()}, define the audience, desired result, source facts and the final check you will perform.`,
        },
        {
          id: `${baseId}-example-callout`,
          type: "callout",
          title: "Workday rule",
          tone: "tip",
          text: "Use AI to reduce effort and expose options. Keep accountability, confidential judgment and final approval with a person.",
        },
      ],
    },
    {
      id: `${baseId}-check`,
      sourcePageId: `${baseId}-check`,
      order: 2,
      type: "knowledge-check",
      title: "Check",
      presentation: "knowledge-check",
      interactionPolicy: "required-interaction",
      blocks: [
        {
          id: `${baseId}-check-question`,
          type: "single-choice",
          question: "Which approach creates the safest and most useful AI-assisted workflow?",
          options: [
            {
              id: `${baseId}-check-a`,
              label: "Define the outcome and context, then review the result before using it",
              isCorrect: true,
            },
            {
              id: `${baseId}-check-b`,
              label: "Paste every available document and accept the first answer",
              isCorrect: false,
            },
            {
              id: `${baseId}-check-c`,
              label: "Automate the task before understanding the current process",
              isCorrect: false,
            },
          ],
          feedbackCorrect: {
            text: "Correct. Clear context plus human review makes the workflow both useful and accountable.",
          },
          feedbackIncorrect: {
            text: "Start with a defined outcome and finish with a human review. More data or automation is not automatically safer.",
          },
        },
      ],
    },
    {
      id: `${baseId}-apply`,
      sourcePageId: `${baseId}-apply`,
      order: 3,
      type: "practice",
      title: "Apply",
      presentation: "practice",
      interactionPolicy: "optional-practice",
      blocks: [
        {
          id: `${baseId}-apply-heading`,
          type: "heading",
          level: 2,
          text: "Apply This to Your Work",
        },
        {
          id: `${baseId}-apply-practice`,
          type: "practice",
          title: lessonSpec.practice,
          prompt: "Complete the exercise with a real low-risk work example, then save the result for reuse.",
          practiceId: `${lessonId}-practice`,
          practiceType: "workday-exercise",
          rawContent: { migrationId: AI_WORKDAY_MIGRATION_ID },
        },
        {
          id: `${baseId}-apply-callout`,
          type: "callout",
          title: "Before you finish",
          tone: "success",
          text: "Check accuracy, confidentiality, tone and the next action. Save only a workflow you would trust yourself to repeat.",
        },
      ],
    },
  ];
  return {
    id: lessonId,
    courseId: course.id,
    schemaVersion: 3,
    sourceId: `${AI_WORKDAY_MIGRATION_ID}-${lessonId}`,
    sourceUnitId,
    sourceGuideId: `${AI_WORKDAY_MIGRATION_ID}-${course.id}`,
    slug: lessonSlug,
    title: lessonSpec.title,
    order: lessonIndex,
    readUrl: "",
    hasAudio: false,
    screens,
    blocks: screens.flatMap((screen) => screen.blocks),
    raw: {
      cms: true,
      migrationId: AI_WORKDAY_MIGRATION_ID,
      objective: lessonSpec.objective,
      practice: lessonSpec.practice,
    },
    status: course.status,
    version: 1,
    publishedAt: course.status === "published" ? now : null,
    updatedAt: now,
    updatedBy: actorId,
  };
}

function courseDocument(course, displayOrder, now) {
  const lessons = course.lessons.map((lessonSpec, index) =>
    lessonDocument(course, lessonSpec, index, now),
  );
  return {
    id: course.id,
    sourceId: `${AI_WORKDAY_MIGRATION_ID}-${course.id}`,
    kind: "use-case",
    title: course.title,
    description: course.description,
    imageAlt: course.title,
    duration: course.duration,
    lessonCount: lessons.length,
    categories: course.categories,
    displayOrder,
    unitSummaries: [
      {
        sourceId: `${course.id}-core`,
        title: "Course lessons",
        order: 0,
      },
    ],
    lessonSummaries: lessons.map((lesson) => ({
      id: lesson.id,
      slug: lesson.slug,
      sourceId: lesson.sourceId,
      sourceUnitId: lesson.sourceUnitId,
      title: lesson.title,
      order: lesson.order,
      screenIds: lesson.screens.map((screen) => screen.id),
      hasAudio: false,
      version: 1,
      status: lesson.status,
    })),
    status: course.status,
    publishedAt: course.status === "published" ? now : null,
    archivedAt: null,
    updatedAt: now,
    updatedBy: actorId,
    version: 1,
    migrationId: AI_WORKDAY_MIGRATION_ID,
    lessons,
  };
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

function updateOnboardingPage(page, copy, now) {
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
    version: Number(page.version ?? 1) + 1,
    updatedAt: now,
    updatedBy: actorId,
    migrationId: AI_WORKDAY_MIGRATION_ID,
  };
}

async function readBaselineOnboardingPages() {
  const pages = [];
  for (const copy of onboardingCopy) {
    const value = JSON.parse(
      await readFile(
        join(root, "content", "coursiv", "onboarding", "pages", `${copy.id}.json`),
        "utf8",
      ),
    );
    pages.push(value);
  }
  return pages;
}

async function currentOnboardingPages() {
  const baseline = await readBaselineOnboardingPages();
  const snapshot = await database
    .collection("onboardingFunnels")
    .doc("c-1185")
    .collection("pages")
    .get();
  const overrides = new Map(snapshot.docs.map((document) => [document.id, document.data()]));
  return baseline.map((page) => overrides.get(page.id) ?? page);
}

const markerReference = database.collection("contentOperations").doc(AI_WORKDAY_MIGRATION_ID);
const existingMarker = await markerReference.get();
if (existingMarker.data()?.status === "complete") {
  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: apply ? "apply" : "dry-run",
        skipped: true,
        reason: "Migration already completed",
        migrationId: AI_WORKDAY_MIGRATION_ID,
        marker: existingMarker.data(),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const [liveContent, onboardingPages] = await Promise.all([
  readConsistentContent(),
  currentOnboardingPages(),
]);
validateSnapshot(liveContent);

const existingCourses = liveContent
  .filter((item) => item.collection === "courses")
  .map((item) => ({ id: item.documentId, ...item.data }));
const existingLessons = liveContent.filter((item) => item.collection === "lessons");
const coursesToArchive = existingCourses.filter(
  (course) => !targetCourseIds.has(course.id) && course.status !== "archived",
);
const alreadyArchived = existingCourses.filter(
  (course) => !targetCourseIds.has(course.id) && course.status === "archived",
);
const now = new Date().toISOString();
const newCourses = aiWorkdayCourses.map((course, index) =>
  courseDocument(course, index, now),
);
const newLessons = newCourses.flatMap((course) => course.lessons);

const dryRun = {
  ok: true,
  mode: apply ? "apply" : "dry-run",
  migrationId: AI_WORKDAY_MIGRATION_ID,
  checkpointCollections: ["courses", "lessons", "contentMetadata"],
  existing: {
    courses: existingCourses.length,
    lessons: existingLessons.length,
    coursesToArchive: coursesToArchive.length,
    alreadyArchived: alreadyArchived.length,
    deletedCourses: 0,
    deletedLessons: 0,
  },
  create: {
    courses: newCourses.length,
    lessons: newLessons.length,
    publishedCourses: newCourses.filter((course) => course.status === "published").length,
    draftCourses: newCourses.filter((course) => course.status === "draft").length,
  },
  onboardingPages: onboardingPages.length,
};

if (!apply) {
  console.log(JSON.stringify(dryRun, null, 2));
  process.exit(0);
}

const checkpoint = await createCheckpoint(liveContent);
const batch = database.batch();
let writeCount = 0;

for (const course of coursesToArchive) {
  const previousVersion = Number(course.version ?? 1);
  const next = {
    ...course,
    status: "archived",
    statusBeforeArchive: course.status === "draft" ? "draft" : "published",
    archivedAt: now,
    version: previousVersion + 1,
    updatedAt: now,
    updatedBy: actorId,
  };
  batch.set(database.collection("courses").doc(course.id), next);
  writeCount += 1;
  const revisionId = `${String(previousVersion).padStart(8, "0")}-${AI_WORKDAY_MIGRATION_ID}`;
  batch.set(
    database
      .collection("contentRevisions")
      .doc(course.id)
      .collection("versions")
      .doc(revisionId),
    {
      id: revisionId,
      entityId: course.id,
      entityType: "course",
      version: previousVersion,
      snapshot: course,
      changedBy: actorId,
      changeSummary: reason,
      createdAt: now,
    },
  );
  writeCount += 1;
  const audit = auditRecord({
    action: "content.course.archive",
    targetType: "course",
    targetId: course.id,
    before: {
      status: course.status,
      version: previousVersion,
      lessonCount: course.lessonCount,
    },
    after: {
      status: "archived",
      version: next.version,
      lessonCount: course.lessonCount,
    },
  });
  batch.create(database.collection("adminAuditLogs").doc(audit.id), audit);
  writeCount += 1;
}

for (const course of newCourses) {
  const { lessons, ...storedCourse } = course;
  batch.set(database.collection("courses").doc(course.id), storedCourse);
  writeCount += 1;
  const audit = auditRecord({
    action: "content.course.create",
    targetType: "course",
    targetId: course.id,
    after: {
      title: course.title,
      status: course.status,
      lessonCount: course.lessonCount,
      migrationId: AI_WORKDAY_MIGRATION_ID,
    },
  });
  batch.create(database.collection("adminAuditLogs").doc(audit.id), audit);
  writeCount += 1;
  for (const lesson of lessons) {
    const { id, ...storedLesson } = lesson;
    batch.set(database.collection("lessons").doc(id), storedLesson);
    writeCount += 1;
  }
}

for (const [index, copy] of onboardingCopy.entries()) {
  const existing = onboardingPages[index];
  if (!existing || existing.id !== copy.id) {
    throw new Error(`Onboarding page mismatch at ${copy.id}`);
  }
  const updated = updateOnboardingPage(existing, copy, now);
  const pageReference = database
    .collection("onboardingFunnels")
    .doc("c-1185")
    .collection("pages")
    .doc(copy.id);
  const revisionReference = database
    .collection("contentRevisions")
    .doc(`onboarding-${copy.id}`)
    .collection("versions")
    .doc(`${String(updated.version).padStart(8, "0")}-${AI_WORKDAY_MIGRATION_ID}`);
  batch.set(revisionReference, {
    entityType: "onboarding-page",
    entityId: copy.id,
    version: updated.version,
    snapshot: existing,
    changeSummary: "Repositioned onboarding for the AI Workday program",
    editorId: actorId,
    editorEmail: actorEmail,
    createdAt: now,
  });
  batch.set(pageReference, updated);
  writeCount += 2;
  const audit = auditRecord({
    action: "content.onboarding.publish",
    targetType: "onboarding-page",
    targetId: copy.id,
    before: {
      title: existing.title,
      version: existing.version ?? 1,
    },
    after: {
      title: updated.title,
      version: updated.version,
      migrationId: AI_WORKDAY_MIGRATION_ID,
    },
  });
  batch.create(database.collection("adminAuditLogs").doc(audit.id), audit);
  writeCount += 1;
}

batch.set(
  database.collection("contentMetadata").doc("learner-app"),
  {
    contentVersion: now,
    updatedAt: now,
    updatedBy: actorId,
    aiWorkdayMigrationId: AI_WORKDAY_MIGRATION_ID,
    aiWorkdayPublishedCourseIds: newCourses
      .filter((course) => course.status === "published")
      .map((course) => course.id),
    aiWorkdayDraftCourseIds: newCourses
      .filter((course) => course.status === "draft")
      .map((course) => course.id),
  },
  { merge: true },
);
writeCount += 1;
batch.set(
  database.collection("contentMetadata").doc("onboarding"),
  {
    flowId: "c-1185",
    version: AI_WORKDAY_MIGRATION_ID,
    updatedAt: now,
    updatedBy: actorId,
    aiWorkdayMigrationId: AI_WORKDAY_MIGRATION_ID,
  },
  { merge: true },
);
writeCount += 1;
batch.set(markerReference, {
  migrationId: AI_WORKDAY_MIGRATION_ID,
  status: "committing",
  checkpointId: checkpoint.id,
  startedAt: now,
  actorId,
  reason,
});
writeCount += 1;

if (writeCount > 490) {
  throw new Error(
    `Migration needs ${writeCount} atomic writes, exceeding the guarded Firestore batch limit`,
  );
}

await batch.commit();

const [verifiedCoursesSnapshot, verifiedLessonsSnapshot, verifiedOnboardingSnapshot] =
  await Promise.all([
    database.collection("courses").get(),
    database.collection("lessons").get(),
    database
      .collection("onboardingFunnels")
      .doc("c-1185")
      .collection("pages")
      .get(),
  ]);
const verifiedCourses = verifiedCoursesSnapshot.docs.map((document) => ({
  id: document.id,
  ...document.data(),
}));
const verifiedLessons = verifiedLessonsSnapshot.docs.map((document) => ({
  id: document.id,
  ...document.data(),
}));
const verifiedTargets = verifiedCourses.filter((course) => targetCourseIds.has(course.id));
const unarchivedLegacy = verifiedCourses.filter(
  (course) => !targetCourseIds.has(course.id) && course.status !== "archived",
);
const missingTargetLessons = newCourses.flatMap((course) =>
  course.lessonSummaries
    .filter((summary) => !verifiedLessons.some((lesson) => lesson.id === summary.id))
    .map((summary) => summary.id),
);
const onboardingById = new Map(
  verifiedOnboardingSnapshot.docs.map((document) => [document.id, document.data()]),
);
const staleOnboarding = onboardingCopy
  .filter((copy) => onboardingById.get(copy.id)?.migrationId !== AI_WORKDAY_MIGRATION_ID)
  .map((copy) => copy.id);

const errors = [];
if (verifiedTargets.length !== newCourses.length) {
  errors.push(`Expected ${newCourses.length} AI Workday courses, found ${verifiedTargets.length}`);
}
if (unarchivedLegacy.length) {
  errors.push(`${unarchivedLegacy.length} legacy courses are still published or draft`);
}
if (verifiedLessons.length < existingLessons.length + newLessons.length) {
  errors.push("Lesson count proves that one or more existing lessons were not preserved");
}
if (missingTargetLessons.length) {
  errors.push(`Missing AI Workday lessons: ${missingTargetLessons.join(", ")}`);
}
if (staleOnboarding.length) {
  errors.push(`Onboarding pages were not updated: ${staleOnboarding.join(", ")}`);
}

if (errors.length) {
  await markerReference.set(
    {
      status: "verification-failed",
      errors,
      verificationFailedAt: new Date().toISOString(),
    },
    { merge: true },
  );
  throw new Error(errors.join("; "));
}

await markerReference.set(
  {
    status: "complete",
    completedAt: new Date().toISOString(),
    writeCount,
    checkpointId: checkpoint.id,
    archivedCourseCount: coursesToArchive.length,
    preservedExistingLessonCount: existingLessons.length,
    createdCourseCount: newCourses.length,
    createdLessonCount: newLessons.length,
    onboardingPageCount: onboardingCopy.length,
  },
  { merge: true },
);

console.log(
  JSON.stringify(
    {
      ...dryRun,
      checkpointId: checkpoint.id,
      checkpointChecksum: checkpoint.checksum,
      writes: writeCount,
      verification: {
        legacyCoursesStillActive: 0,
        existingLessonsPreserved: existingLessons.length,
        totalCourses: verifiedCourses.length,
        totalLessons: verifiedLessons.length,
        onboardingPagesUpdated: onboardingCopy.length,
      },
    },
    null,
    2,
  ),
);
