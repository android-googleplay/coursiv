import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";
import { getAdminDb, isFirebaseAdminConfigured } from "./platform/firebase-admin";
import { coursivCatalog } from "./generated/coursiv-catalog";
import type { CoursivCatalogEntry, CoursivCourse, CoursivLesson, CoursivUnit } from "./coursiv-content";

const contentRoot = join(process.cwd(), "content", "coursiv", "courses");
type ContentSource = "json" | "firestore" | "shadow";
type UnitSummary = { sourceId: string; title?: string; order: number };
type LessonSummary = { id: string; slug: string; sourceId: string; sourceUnitId: string; title: string; order: number; screenIds: string[]; hasAudio: boolean; version?: number; status?: "draft" | "published" };
type StoredCourse = Omit<CoursivCourse, "units"> & {
  unitSummaries?: UnitSummary[];
  lessonSummaries?: LessonSummary[];
  status?: "draft" | "published" | "archived";
  displayOrder?: number;
  lessonCount?: number;
  imageAlt?: string;
  version?: number;
  updatedAt?: string;
};

export type RuntimeCatalogEntry = CoursivCatalogEntry & {
  localImage?: string;
  imageAlt?: string;
  displayOrder: number;
  status: "published" | "archived";
  version: number;
};

function configuredSource(): ContentSource {
  const value = process.env.CONTENT_SOURCE?.toLowerCase();
  return value === "firestore" || value === "shadow" ? value : "json";
}

async function readJsonCourse(courseId: string): Promise<CoursivCourse | null> {
  try {
    return JSON.parse(await readFile(join(contentRoot, `${courseId}.json`), "utf8")) as CoursivCourse;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function checksum(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function reportShadowDifference(scope: string, local: unknown, remote: unknown) {
  if (checksum(local) !== checksum(remote)) console.warn(`[content-shadow] ${scope} differs`, { json: checksum(local), firestore: checksum(remote) });
}

function canonicalLessonDocument(value: CoursivLesson & Record<string, unknown>): CoursivLesson {
  const { id: _id, courseId: _courseId, status: _status, version: _version, updatedAt: _updatedAt, updatedBy: _updatedBy, canonicalChecksum: _canonicalChecksum, ...lesson } = value;
  void _id;void _courseId;void _status;void _version;void _updatedAt;void _updatedBy;void _canonicalChecksum;
  return lesson as CoursivLesson;
}

function buildUnits(metadata: StoredCourse, lessons: CoursivLesson[], local: CoursivCourse | null): CoursivUnit[] {
  const summaries = metadata.unitSummaries?.length
    ? metadata.unitSummaries
    : local?.units.map((unit) => ({ sourceId: unit.sourceId, title: unit.title, order: unit.order }))
      ?? Array.from(new Set(lessons.map((lesson) => lesson.sourceUnitId))).map((sourceId, order) => ({ sourceId, title: order ? `Unit ${order + 1}` : "Course lessons", order }));
  const units = summaries.map((unit) => ({ ...unit, lessons: lessons.filter((lesson) => lesson.sourceUnitId === unit.sourceId).sort((a, b) => a.order - b.order) }));
  for (const lesson of lessons) {
    if (units.some((unit) => unit.sourceId === lesson.sourceUnitId)) continue;
    units.push({ sourceId: lesson.sourceUnitId, title: "Course lessons", order: units.length, lessons: [lesson] });
  }
  return units.sort((a, b) => a.order - b.order);
}

function buildCourse(id: string, metadata: StoredCourse, lessons: CoursivLesson[], local: CoursivCourse | null): CoursivCourse {
  return {
    schemaVersion: metadata.schemaVersion ?? local?.schemaVersion ?? 3,
    id,
    sourceId: metadata.sourceId ?? local?.sourceId ?? `cms-${id}`,
    kind: metadata.kind ?? local?.kind ?? "use-case",
    title: metadata.title ?? local?.title ?? id,
    image: metadata.image || metadata.localImage || local?.image,
    localImage: metadata.localImage ?? local?.localImage,
    duration: metadata.duration ?? local?.duration ?? "1 hour",
    categories: metadata.categories ?? local?.categories ?? [],
    sourceUpdatedAt: metadata.sourceUpdatedAt ?? local?.sourceUpdatedAt,
    units: buildUnits(metadata, lessons, local),
  };
}

function catalogEntryFromStored(id:string,metadata:StoredCourse,local:CoursivCourse|null):RuntimeCatalogEntry {
  const units=metadata.unitSummaries?.length?metadata.unitSummaries:local?.units.map((unit)=>({sourceId:unit.sourceId,title:unit.title,order:unit.order}))??[];
  const summaries:LessonSummary[]=(metadata.lessonSummaries?.length?metadata.lessonSummaries:local?.units.flatMap((unit)=>unit.lessons).map((lesson)=>({id:`${id}__${lesson.slug}`,slug:lesson.slug,sourceId:lesson.sourceId,sourceUnitId:lesson.sourceUnitId,title:lesson.title,order:lesson.order,screenIds:lesson.screens.map((screen)=>screen.id),hasAudio:lesson.hasAudio,status:"published" as const}))??[]).filter((lesson)=>lesson.status!=="draft");
  return{
    id,sourceId:metadata.sourceId??local?.sourceId??`cms-${id}`,kind:metadata.kind??local?.kind??"use-case",title:metadata.title??local?.title??id,
    image:metadata.image||metadata.localImage||local?.image||local?.localImage,localImage:metadata.localImage??local?.localImage,imageAlt:metadata.imageAlt||metadata.title||local?.title||id,
    duration:metadata.duration??local?.duration??"1 hour",categories:metadata.categories??local?.categories??[],displayOrder:metadata.displayOrder??0,status:metadata.status==="archived"?"archived":"published",version:metadata.version??1,
    sections:units.sort((a,b)=>a.order-b.order).map((unit)=>({title:unit.title,sourceId:unit.sourceId,lessons:summaries.filter((lesson)=>lesson.sourceUnitId===unit.sourceId).sort((a,b)=>a.order-b.order).map((lesson)=>({id:lesson.slug,sourceId:lesson.sourceId,title:lesson.title,screenIds:lesson.screenIds,hasAudio:lesson.hasAudio}))})),
  };
}

async function readCoursivCatalogUncached(options: { includeArchived?: boolean } = {}): Promise<RuntimeCatalogEntry[]> {
  const source = configuredSource();
  if (source === "json" || !isFirebaseAdminConfigured()) {
    if (source === "firestore" && !isFirebaseAdminConfigured()) throw new Error("CONTENT_SOURCE=firestore requires Firebase Admin credentials");
    return coursivCatalog.map((entry, index) => ({ ...entry, localImage: undefined, imageAlt: entry.title, displayOrder: index, status: "published", version: 1 }));
  }
  const database = getAdminDb();
  const courseSnapshot=await database.collection("courses").get();
  const entries: RuntimeCatalogEntry[] = [];
  for (const document of courseSnapshot.docs) {
    const metadata = { id: document.id, ...document.data() } as StoredCourse & { id: string };
    if (metadata.status === "draft" || (metadata.status === "archived" && !options.includeArchived)) continue;
    const local = await readJsonCourse(document.id);
    entries.push(catalogEntryFromStored(document.id,metadata,local));
  }
  entries.sort((a, b) => a.kind.localeCompare(b.kind) || a.displayOrder - b.displayOrder || a.title.localeCompare(b.title));
  if (source === "shadow") {
    const local = coursivCatalog.map((entry) => ({ id: entry.id, title: entry.title, kind: entry.kind, duration: entry.duration, categories: entry.categories, image: entry.image, lessonIds: entry.sections.flatMap((section) => section.lessons.map((lesson) => lesson.id)) }));
    const remote = entries.map((entry) => ({ id: entry.id, title: entry.title, kind: entry.kind, duration: entry.duration, categories: entry.categories, image: entry.image, lessonIds: entry.sections.flatMap((section) => section.lessons.map((lesson) => lesson.id)) }));
    reportShadowDifference("catalog", local, remote);
    return coursivCatalog.map((entry, index) => ({ ...entry, localImage: undefined, imageAlt: entry.title, displayOrder: index, status: "published", version: 1 }));
  }
  return entries;
}

const readCachedCoursivCatalog=unstable_cache(
  async()=>readCoursivCatalogUncached({includeArchived:true}),
  ["coursiv-runtime-catalog"],
  {tags:["catalog"],revalidate:3600},
);

export async function readCoursivCatalog(options: { includeArchived?: boolean } = {}) {
  if(configuredSource()!=="firestore")return readCoursivCatalogUncached(options);
  const entries=await readCachedCoursivCatalog();
  return options.includeArchived?entries:entries.filter((entry)=>entry.status==="published");
}

export async function readCoursivCourse(courseId: string): Promise<CoursivCourse | null> {
  if (!/^[a-z0-9-]+$/.test(courseId)) return null;
  const local = await readJsonCourse(courseId);
  const source = configuredSource();
  if (source === "json") return local;
  if (!isFirebaseAdminConfigured()) {
    if (source === "firestore") throw new Error("CONTENT_SOURCE=firestore requires Firebase Admin credentials");
    return local;
  }
  const database = getAdminDb();
  const [courseDocument, lessonsSnapshot] = await Promise.all([
    database.collection("courses").doc(courseId).get(),
    database.collection("lessons").where("courseId", "==", courseId).get(),
  ]);
  if (!courseDocument.exists) return source === "shadow" ? local : null;
  const metadata = courseDocument.data() as StoredCourse;
  if (metadata.status === "draft") return source === "shadow" ? local : null;
  const lessons = lessonsSnapshot.docs.filter((document)=>document.data().status!=="draft").map((document) => canonicalLessonDocument(document.data() as CoursivLesson & Record<string, unknown>));
  const remote = buildCourse(courseId, metadata, lessons, local);
  if (source === "shadow") {
    if (local) reportShadowDifference(`course:${courseId}`, local, remote);
    return local;
  }
  return remote;
}

export async function readCoursivLesson(courseId: string, lessonId: string): Promise<{ course: CoursivCourse; lesson: CoursivLesson } | null> {
  if (!/^[a-z0-9-]+$/.test(courseId) || !/^[a-z0-9-]+$/.test(lessonId)) return null;
  const source = configuredSource();
  const localCourse = await readJsonCourse(courseId);
  const localLesson = localCourse?.units.flatMap((unit) => unit.lessons).find((lesson) => lesson.slug === lessonId);
  if (source === "json") return localCourse && localLesson ? { course: localCourse, lesson: localLesson } : null;
  if (!isFirebaseAdminConfigured()) {
    if (source === "firestore") throw new Error("CONTENT_SOURCE=firestore requires Firebase Admin credentials");
    return localCourse && localLesson ? { course: localCourse, lesson: localLesson } : null;
  }
  const database = getAdminDb();
  const [courseDocument, lessonDocument] = await Promise.all([
    database.collection("courses").doc(courseId).get(),
    database.collection("lessons").doc(`${courseId}__${lessonId}`).get(),
  ]);
  const metadata = courseDocument.exists ? courseDocument.data() as StoredCourse : null;
  const storedLesson = lessonDocument.exists ? lessonDocument.data() as CoursivLesson & Record<string, unknown> : null;
  const remoteLesson = storedLesson&&storedLesson.status!=="draft" ? canonicalLessonDocument(storedLesson) : null;
  if (source === "shadow") {
    if (localLesson && remoteLesson) reportShadowDifference(`lesson:${courseId}/${lessonId}`, localLesson, remoteLesson);
    else if (Boolean(localLesson) !== Boolean(remoteLesson)) console.warn(`[content-shadow] lesson:${courseId}/${lessonId} missing in one source`);
    return localCourse && localLesson ? { course: localCourse, lesson: localLesson } : null;
  }
  if (!metadata || metadata.status === "draft" || !remoteLesson) return null;
  return { course: buildCourse(courseId, metadata, [remoteLesson], localCourse), lesson: remoteLesson };
}
