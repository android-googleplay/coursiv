import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const commit = process.argv.includes("--commit");
const actor = "codex-short-courses-publisher";
const specs = [
  { id: "google-sheet-with-ai-shorts", lessons: 4, screens: 4, images: 0, videos: 4, prompts: 4, displayOrder: 7 },
  { id: "google-slide-with-ai-short", lessons: 3, screens: 3, images: 0, videos: 3, prompts: 3, displayOrder: 9 },
];

const courses = await Promise.all(specs.map(async (spec) => {
  const course = JSON.parse(await readFile(join(process.cwd(), `content/coursiv/courses/${spec.id}.json`), "utf8"));
  const lessons = course.units.flatMap((unit) => unit.lessons);
  const blocks = lessons.flatMap((lesson) => lesson.screens.flatMap((screen) => screen.blocks));
  const counts = {
    lessons: lessons.length,
    screens: lessons.reduce((total, lesson) => total + lesson.screens.length, 0),
    images: blocks.filter((block) => block.type === "image").length,
    videos: blocks.filter((block) => block.type === "video").length,
    prompts: blocks.filter((block) => block.type === "callout" && block.tone === "copy-prompt").length,
  };
  for (const key of ["lessons", "screens", "images", "videos", "prompts"]) {
    if (counts[key] !== spec[key]) throw new Error(`${spec.id} ${key}: expected ${spec[key]}, received ${counts[key]}`);
  }
  return { spec, course, lessons };
}));

const credential = process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY
  ? cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    })
  : applicationDefault();
const app = getApps()[0] ?? initializeApp({ credential, projectId: "courseai-73920" });
const database = getFirestore(app);
const metadataReference = database.collection("contentMetadata").doc("learner-app");
const courseReferences = new Map(courses.map(({ spec }) => [spec.id, database.collection("courses").doc(spec.id)]));
const lessonEntries = courses.flatMap(({ spec, lessons }) => lessons.map((lesson) => ({
  courseId: spec.id,
  lesson,
  id: `${spec.id}__${lesson.slug}`,
  reference: database.collection("lessons").doc(`${spec.id}__${lesson.slug}`),
})));

const [courseSnapshots, lessonSnapshots, metadataSnapshot] = await Promise.all([
  Promise.all([...courseReferences.values()].map((reference) => reference.get())),
  Promise.all(lessonEntries.map(({ reference }) => reference.get())),
  metadataReference.get(),
]);
const before = {
  courseVersions: Object.fromEntries(courseSnapshots.map((snapshot) => [snapshot.id, snapshot.exists ? snapshot.data().version ?? 1 : 0])),
  lessonVersions: Object.fromEntries(lessonSnapshots.filter((snapshot) => snapshot.exists).map((snapshot) => [snapshot.id, snapshot.data().version ?? 1])),
};

if (!commit) {
  console.log(JSON.stringify({
    mode: "dry-run",
    courses: specs.map(({ id }) => id),
    creates: {
      courses: courseSnapshots.filter((snapshot) => !snapshot.exists).map((snapshot) => snapshot.id),
      lessons: lessonSnapshots.filter((snapshot) => !snapshot.exists).map((snapshot) => snapshot.id),
    },
    before,
    expected: Object.fromEntries(specs.map((spec) => [spec.id, { lessons: spec.lessons, screens: spec.screens, images: spec.images, videos: spec.videos, copyPrompts: spec.prompts }])),
    next: "Re-run with --commit to publish only these two courses.",
  }, null, 2));
  process.exit(0);
}

const now = new Date().toISOString();
const migrationId = `short-courses-${now.replace(/[:.]/g, "-")}`;
const backupRoot = database.collection("migrationBackups").doc(migrationId);

await database.runTransaction(async (transaction) => {
  const currentCourses = [];
  for (const reference of courseReferences.values()) currentCourses.push(await transaction.get(reference));
  const currentLessons = [];
  for (const entry of lessonEntries) currentLessons.push(await transaction.get(entry.reference));
  const currentMetadata = await transaction.get(metadataReference);

  for (const snapshot of currentCourses) {
    const version = snapshot.exists ? snapshot.data().version ?? 1 : 0;
    if (version !== before.courseVersions[snapshot.id]) throw new Error(`${snapshot.id} changed during the update; no content was written.`);
  }
  for (const snapshot of currentLessons) {
    const expectedVersion = before.lessonVersions[snapshot.id];
    if (expectedVersion === undefined && snapshot.exists) throw new Error(`${snapshot.id} was created during the update; no content was written.`);
    if (expectedVersion !== undefined && (!snapshot.exists || (snapshot.data().version ?? 1) !== expectedVersion)) throw new Error(`${snapshot.id} changed during the update; no content was written.`);
  }

  transaction.create(backupRoot, {
    id: migrationId, type: "short-courses-publish", status: "complete", actor, startedAt: now, completedAt: now,
    scope: { courseIds: specs.map(({ id }) => id), lessonIds: lessonEntries.map(({ id }) => id) }, before,
  });
  for (const snapshot of currentCourses) if (snapshot.exists) transaction.create(backupRoot.collection("courses").doc(snapshot.id), { id: snapshot.id, ...snapshot.data() });
  for (const snapshot of currentLessons) if (snapshot.exists) transaction.create(backupRoot.collection("lessons").doc(snapshot.id), { id: snapshot.id, ...snapshot.data() });
  if (currentMetadata.exists) transaction.create(backupRoot.collection("metadata").doc("learner-app"), currentMetadata.data());

  for (const { spec, course, lessons } of courses) {
    const courseSnapshot = currentCourses.find((snapshot) => snapshot.id === spec.id);
    const existingCourse = courseSnapshot?.exists ? courseSnapshot.data() : null;
    const summaries = [];
    for (const lesson of lessons) {
      const entry = lessonEntries.find((item) => item.courseId === spec.id && item.lesson.slug === lesson.slug);
      const snapshot = currentLessons.find((item) => item.id === entry.id);
      const existing = snapshot.exists ? snapshot.data() : null;
      const version = existing ? (existing.version ?? 1) + 1 : 1;
      if (existing) {
        const revisionId = `${String(existing.version ?? 1).padStart(8, "0")}-${createHash("sha1").update(`${entry.id}:${now}`).digest("hex").slice(0, 8)}`;
        transaction.create(database.collection("contentRevisions").doc(entry.id).collection("versions").doc(revisionId), {
          id: revisionId, entityId: entry.id, version: existing.version ?? 1, snapshot: existing,
          changedBy: actor, changeSummary: "Published the supplied Short course media and prompts.", createdAt: now,
        });
      }
      transaction.set(entry.reference, {
        ...lesson, id: entry.id, courseId: spec.id, status: "published", version, updatedAt: now, updatedBy: actor,
        canonicalChecksum: createHash("sha256").update(JSON.stringify(lesson)).digest("hex"),
      });
      summaries.push({
        id: entry.id, slug: lesson.slug, sourceId: lesson.sourceId, sourceUnitId: lesson.sourceUnitId, title: lesson.title,
        order: lesson.order, screenIds: lesson.screens.map((screen) => screen.id), hasAudio: lesson.hasAudio, version, status: "published",
      });
    }
    const { units: _units, ...courseMetadata } = course;
    void _units;
    transaction.set(courseReferences.get(spec.id), {
      ...courseMetadata,
      unitSummaries: course.units.map((unit) => ({ sourceId: unit.sourceId, title: unit.title, order: unit.order })),
      lessonSummaries: summaries,
      lessonCount: lessons.length,
      displayOrder: spec.displayOrder,
      imageAlt: course.title,
      status: "published",
      version: existingCourse ? (existingCourse.version ?? 1) + 1 : 1,
      publishedAt: existingCourse?.publishedAt ?? now,
      archivedAt: null,
      updatedAt: now,
      updatedBy: actor,
    }, { merge: true });
  }
  transaction.set(metadataReference, { contentVersion: now, updatedAt: now }, { merge: true });
});

const verified = {};
for (const { spec } of courses) {
  const snapshots = await Promise.all(lessonEntries.filter((entry) => entry.courseId === spec.id).map((entry) => entry.reference.get()));
  const stored = snapshots.map((snapshot) => snapshot.data());
  const blocks = stored.flatMap((lesson) => lesson.screens.flatMap((screen) => screen.blocks));
  verified[spec.id] = {
    lessons: stored.length,
    screens: stored.reduce((total, lesson) => total + lesson.screens.length, 0),
    images: blocks.filter((block) => block.type === "image").length,
    videos: blocks.filter((block) => block.type === "video").length,
    copyPrompts: blocks.filter((block) => block.type === "callout" && block.tone === "copy-prompt").length,
  };
  const expected = { lessons: spec.lessons, screens: spec.screens, images: spec.images, videos: spec.videos, copyPrompts: spec.prompts };
  if (JSON.stringify(verified[spec.id]) !== JSON.stringify(expected)) throw new Error(`Post-publish verification failed for ${spec.id}: ${JSON.stringify(verified[spec.id])}`);
}

console.log(JSON.stringify({ mode: "committed", migrationId, before, verified }, null, 2));
