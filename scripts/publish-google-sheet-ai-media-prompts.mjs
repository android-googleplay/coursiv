import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const commit = process.argv.includes("--commit");
const courseId = process.argv.find((argument) => argument.startsWith("--course="))?.split("=")[1] ?? "google-sheet-with-ai";
const expectedLessonCount = courseId === "google-sheet-with-ai" ? 11 : courseId === "google-slide-with-ai" ? 11 : 0;
if (!expectedLessonCount) throw new Error(`Unsupported AI course: ${courseId}`);
const actor = `codex-${courseId}-media-prompts`;
const coursePath = join(process.cwd(), `content/coursiv/courses/${courseId}.json`);
const course = JSON.parse(await readFile(coursePath, "utf8"));
const lessons = course.units.flatMap((unit) => unit.lessons);
const { units: _units, ...courseMetadata } = course;
void _units;

if (course.id !== courseId || lessons.length !== expectedLessonCount) {
  throw new Error(`Expected ${courseId} with exactly ${expectedLessonCount} lessons.`);
}

for (const lesson of lessons) {
  if (lesson.screens.length !== 4) throw new Error(`${lesson.slug} must contain exactly four screens.`);
  for (const screen of lesson.screens.slice(0, 3)) {
    const images = screen.blocks.filter((block) => block.type === "image");
    if (images.length !== 1) throw new Error(`${lesson.slug}/${screen.id} must contain exactly one image.`);
  }
  if (lesson.screens.at(-1).blocks.some((block) => block.type === "image")) {
    throw new Error(`${lesson.slug} takeaway must not contain an image.`);
  }
  const prompts = lesson.screens.at(-1).blocks.filter(
    (block) => block.type === "callout" && block.tone === "copy-prompt",
  );
  if (prompts.length !== 1) throw new Error(`${lesson.slug} must end with exactly one copy prompt.`);
}

const credential = process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY
  ? cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    })
  : applicationDefault();
const app = getApps()[0] ?? initializeApp({ credential, projectId: "courseai-73920" });
const database = getFirestore(app);
const lessonIds = lessons.map((lesson) => `${courseId}__${lesson.slug}`);
const courseReference = database.collection("courses").doc(courseId);
const lessonReferences = lessonIds.map((id) => database.collection("lessons").doc(id));
const metadataReference = database.collection("contentMetadata").doc("learner-app");

const [courseSnapshot, ...rest] = await Promise.all([
  courseReference.get(),
  ...lessonReferences.map((reference) => reference.get()),
  metadataReference.get(),
]);
const metadataSnapshot = rest.pop();
const lessonSnapshots = rest;
if (!courseSnapshot.exists) throw new Error(`The published ${courseId} course is missing in Firestore.`);

const before = {
  courseVersion: courseSnapshot.data().version ?? 1,
  lessonVersions: Object.fromEntries(
    lessonSnapshots
      .filter((snapshot) => snapshot.exists)
      .map((snapshot) => [snapshot.id, snapshot.data().version ?? 1]),
  ),
};

if (!commit) {
  console.log(JSON.stringify({
    mode: "dry-run",
    courseId,
    lessons: lessonIds,
    creates: lessonSnapshots.filter((snapshot) => !snapshot.exists).map((snapshot) => snapshot.id),
    before,
    expected: {
      screens: expectedLessonCount * 4,
      images: expectedLessonCount * 3,
      copyPrompts: expectedLessonCount,
    },
    next: "Re-run with --commit to publish the scoped update.",
  }, null, 2));
  process.exit(0);
}

const now = new Date().toISOString();
const migrationId = `${courseId}-media-prompts-${now.replace(/[:.]/g, "-")}`;
const backupRoot = database.collection("migrationBackups").doc(migrationId);

await database.runTransaction(async (transaction) => {
  const currentCourseSnapshot = await transaction.get(courseReference);
  const currentLessonSnapshots = [];
  for (const reference of lessonReferences) currentLessonSnapshots.push(await transaction.get(reference));
  const currentMetadataSnapshot = await transaction.get(metadataReference);

  if (!currentCourseSnapshot.exists) throw new Error("The course changed before the update could begin.");
  if ((currentCourseSnapshot.data().version ?? 1) !== before.courseVersion) {
    throw new Error("The course changed during the update; no content was written.");
  }
  for (const snapshot of currentLessonSnapshots) {
    const expectedVersion = before.lessonVersions[snapshot.id];
    if (expectedVersion === undefined && snapshot.exists) {
      throw new Error(`${snapshot.id} was created during the update; no content was written.`);
    }
    if (expectedVersion !== undefined && (!snapshot.exists || (snapshot.data().version ?? 1) !== expectedVersion)) {
      throw new Error(`${snapshot.id} changed during the update; no content was written.`);
    }
  }

  transaction.create(backupRoot, {
    id: migrationId,
    type: `${courseId}-media-prompts`,
    status: "complete",
    actor,
    startedAt: now,
    completedAt: now,
    scope: { courseId, lessonIds },
    before,
  });
  transaction.create(backupRoot.collection("courses").doc(courseId), {
    id: courseId,
    ...currentCourseSnapshot.data(),
  });
  for (const snapshot of currentLessonSnapshots) {
    if (!snapshot.exists) continue;
    transaction.create(backupRoot.collection("lessons").doc(snapshot.id), {
      id: snapshot.id,
      ...snapshot.data(),
    });
  }
  if (currentMetadataSnapshot.exists) {
    transaction.create(backupRoot.collection("metadata").doc("learner-app"), currentMetadataSnapshot.data());
  }

  const nextSummaries = [];
  for (const [index, lesson] of lessons.entries()) {
    const currentSnapshot = currentLessonSnapshots[index];
    const current = currentSnapshot.exists ? currentSnapshot.data() : null;
    const nextVersion = current ? (current.version ?? 1) + 1 : 1;
    const id = currentSnapshot.id;
    const next = {
      ...lesson,
      id,
      courseId,
      status: "published",
      version: nextVersion,
      updatedAt: now,
      updatedBy: actor,
      canonicalChecksum: createHash("sha256").update(JSON.stringify(lesson)).digest("hex"),
    };

    if (current) {
      const revisionId = `${String(current.version ?? 1).padStart(8, "0")}-${createHash("sha1")
        .update(`${id}:${now}`)
        .digest("hex")
        .slice(0, 8)}`;
      transaction.create(
        database.collection("contentRevisions").doc(id).collection("versions").doc(revisionId),
        {
          id: revisionId,
          entityId: id,
          version: current.version ?? 1,
          snapshot: current,
          changedBy: actor,
          changeSummary: "Updated the AI course from the supplied lesson guide and step images.",
          createdAt: now,
        },
      );
    }
    transaction.set(currentSnapshot.ref, next);

    const summary = {
      id,
      slug: next.slug,
      sourceId: next.sourceId,
      sourceUnitId: next.sourceUnitId,
      title: next.title,
      order: next.order,
      screenIds: next.screens.map((screen) => screen.id),
      hasAudio: next.hasAudio,
      version: nextVersion,
      status: "published",
    };
    nextSummaries.push(summary);
  }

  transaction.set(courseReference, {
    ...courseMetadata,
    unitSummaries: course.units.map((unit) => ({ sourceId: unit.sourceId, title: unit.title, order: unit.order })),
    lessonSummaries: nextSummaries,
    lessonCount: lessons.length,
    status: "published",
    version: before.courseVersion + 1,
    updatedAt: now,
    updatedBy: actor,
  }, { merge: true });
  transaction.set(metadataReference, { contentVersion: now, updatedAt: now }, { merge: true });
});

const verifiedSnapshots = await Promise.all(lessonReferences.map((reference) => reference.get()));
const verifiedLessons = verifiedSnapshots.map((snapshot) => snapshot.data());
const verified = {
  lessons: verifiedLessons.length,
  screens: verifiedLessons.reduce((total, lesson) => total + lesson.screens.length, 0),
  images: verifiedLessons.reduce(
    (total, lesson) => total + lesson.screens.flatMap((screen) => screen.blocks).filter((block) => block.type === "image").length,
    0,
  ),
  copyPrompts: verifiedLessons.reduce(
    (total, lesson) => total + lesson.screens.at(-1).blocks.filter((block) => block.type === "callout" && block.tone === "copy-prompt").length,
    0,
  ),
  lessonVersions: Object.fromEntries(verifiedSnapshots.map((snapshot) => [snapshot.id, snapshot.data().version])),
};
if (
  verified.lessons !== expectedLessonCount
  || verified.screens !== expectedLessonCount * 4
  || verified.images !== expectedLessonCount * 3
  || verified.copyPrompts !== expectedLessonCount
) {
  throw new Error(`Post-publish verification failed: ${JSON.stringify(verified)}`);
}

console.log(JSON.stringify({ mode: "committed", migrationId, courseId, before, verified }, null, 2));
