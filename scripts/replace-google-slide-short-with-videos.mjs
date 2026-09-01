import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const commit = process.argv.includes("--commit");
const courseId = "google-slide-with-ai-short";
const actor = "codex-google-slide-short-video-replacement";
const course = JSON.parse(await readFile(join(process.cwd(), `content/coursiv/courses/${courseId}.json`), "utf8"));
const lessons = course.units.flatMap((unit) => unit.lessons);
const blocks = lessons.flatMap((lesson) => lesson.screens.flatMap((screen) => screen.blocks));
if (lessons.length !== 3 || blocks.filter((block) => block.type === "video").length !== 3 || blocks.filter((block) => block.type === "callout" && block.tone === "copy-prompt").length !== 3) {
  throw new Error("Expected the replacement course to contain three video lessons and three copy prompts.");
}

const credential = process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY
  ? cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") })
  : applicationDefault();
const app = getApps()[0] ?? initializeApp({ credential, projectId: "courseai-73920" });
const database = getFirestore(app);
const courseReference = database.collection("courses").doc(courseId);
const metadataReference = database.collection("contentMetadata").doc("learner-app");
const [courseSnapshot, existingLessonsSnapshot, metadataSnapshot] = await Promise.all([
  courseReference.get(),
  database.collection("lessons").where("courseId", "==", courseId).get(),
  metadataReference.get(),
]);
if (!courseSnapshot.exists) throw new Error(`${courseId} is missing in Firestore.`);

const newEntries = lessons.map((lesson) => ({ lesson, id: `${courseId}__${lesson.slug}`, reference: database.collection("lessons").doc(`${courseId}__${lesson.slug}`) }));
const allReferences = new Map(existingLessonsSnapshot.docs.map((snapshot) => [snapshot.id, snapshot.ref]));
for (const entry of newEntries) allReferences.set(entry.id, entry.reference);
const before = {
  courseVersion: courseSnapshot.data().version ?? 1,
  lessonVersions: Object.fromEntries(existingLessonsSnapshot.docs.map((snapshot) => [snapshot.id, snapshot.data().version ?? 1])),
};
const staleIds = existingLessonsSnapshot.docs.map((snapshot) => snapshot.id).filter((id) => !newEntries.some((entry) => entry.id === id));

if (!commit) {
  console.log(JSON.stringify({
    mode: "dry-run",
    courseId,
    before,
    creates: newEntries.filter((entry) => !existingLessonsSnapshot.docs.some((snapshot) => snapshot.id === entry.id)).map((entry) => entry.id),
    removesAfterBackup: staleIds,
    expected: { lessons: 3, screens: 3, videos: 3, copyPrompts: 3 },
    next: "Re-run with --commit to replace only this course's lesson documents.",
  }, null, 2));
  process.exit(0);
}

const now = new Date().toISOString();
const migrationId = `${courseId}-video-replacement-${now.replace(/[:.]/g, "-")}`;
const backupRoot = database.collection("migrationBackups").doc(migrationId);

await database.runTransaction(async (transaction) => {
  const currentCourse = await transaction.get(courseReference);
  const currentLessons = [];
  for (const reference of allReferences.values()) currentLessons.push(await transaction.get(reference));
  const currentMetadata = await transaction.get(metadataReference);

  if (!currentCourse.exists || (currentCourse.data().version ?? 1) !== before.courseVersion) throw new Error("The course changed during replacement; no content was written.");
  for (const snapshot of currentLessons) {
    const expectedVersion = before.lessonVersions[snapshot.id];
    if (expectedVersion === undefined && snapshot.exists) throw new Error(`${snapshot.id} was created during replacement; no content was written.`);
    if (expectedVersion !== undefined && (!snapshot.exists || (snapshot.data().version ?? 1) !== expectedVersion)) throw new Error(`${snapshot.id} changed during replacement; no content was written.`);
  }

  transaction.create(backupRoot, {
    id: migrationId, type: "google-slide-short-video-replacement", status: "complete", actor,
    startedAt: now, completedAt: now, scope: { courseId, existingLessonIds: Object.keys(before.lessonVersions), replacementLessonIds: newEntries.map((entry) => entry.id) }, before,
  });
  transaction.create(backupRoot.collection("courses").doc(courseId), { id: courseId, ...currentCourse.data() });
  for (const snapshot of currentLessons) if (snapshot.exists) transaction.create(backupRoot.collection("lessons").doc(snapshot.id), { id: snapshot.id, ...snapshot.data() });
  if (currentMetadata.exists) transaction.create(backupRoot.collection("metadata").doc("learner-app"), currentMetadata.data());

  for (const staleId of staleIds) transaction.delete(allReferences.get(staleId));
  const summaries = [];
  for (const entry of newEntries) {
    const current = currentLessons.find((snapshot) => snapshot.id === entry.id);
    const existing = current?.exists ? current.data() : null;
    const version = existing ? (existing.version ?? 1) + 1 : 1;
    transaction.set(entry.reference, {
      ...entry.lesson, id: entry.id, courseId, status: "published", version, updatedAt: now, updatedBy: actor,
      canonicalChecksum: createHash("sha256").update(JSON.stringify(entry.lesson)).digest("hex"),
    });
    summaries.push({
      id: entry.id, slug: entry.lesson.slug, sourceId: entry.lesson.sourceId, sourceUnitId: entry.lesson.sourceUnitId,
      title: entry.lesson.title, order: entry.lesson.order, screenIds: entry.lesson.screens.map((screen) => screen.id),
      hasAudio: entry.lesson.hasAudio, version, status: "published",
    });
  }

  const { units: _units, ...courseMetadata } = course;
  void _units;
  transaction.set(courseReference, {
    ...courseMetadata,
    unitSummaries: course.units.map((unit) => ({ sourceId: unit.sourceId, title: unit.title, order: unit.order })),
    lessonSummaries: summaries,
    lessonCount: lessons.length,
    displayOrder: currentCourse.data().displayOrder ?? 9,
    imageAlt: course.title,
    status: "published",
    version: before.courseVersion + 1,
    publishedAt: currentCourse.data().publishedAt ?? now,
    archivedAt: null,
    updatedAt: now,
    updatedBy: actor,
  }, { merge: true });
  transaction.set(metadataReference, { contentVersion: now, updatedAt: now }, { merge: true });
});

const [verifiedCourse, verifiedLessons] = await Promise.all([
  courseReference.get(),
  database.collection("lessons").where("courseId", "==", courseId).get(),
]);
const stored = verifiedLessons.docs.map((snapshot) => snapshot.data());
const verifiedBlocks = stored.flatMap((lesson) => lesson.screens.flatMap((screen) => screen.blocks));
const verified = {
  courseVersion: verifiedCourse.data().version,
  lessons: stored.length,
  lessonIds: verifiedLessons.docs.map((snapshot) => snapshot.id).sort(),
  screens: stored.reduce((total, lesson) => total + lesson.screens.length, 0),
  videos: verifiedBlocks.filter((block) => block.type === "video").length,
  copyPrompts: verifiedBlocks.filter((block) => block.type === "callout" && block.tone === "copy-prompt").length,
};
if (verified.lessons !== 3 || verified.screens !== 3 || verified.videos !== 3 || verified.copyPrompts !== 3 || staleIds.some((id) => verified.lessonIds.includes(id))) {
  throw new Error(`Post-replacement verification failed: ${JSON.stringify(verified)}`);
}
console.log(JSON.stringify({ mode: "committed", migrationId, removedAfterBackup: staleIds, verified }, null, 2));
