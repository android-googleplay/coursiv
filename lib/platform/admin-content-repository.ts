import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb, isFirebaseAdminConfigured } from "./firebase-admin";
import type { StaffActor } from "./admin-auth";
import type { CoursivCourse, CoursivLesson } from "@/lib/coursiv-content";
import { repairLegacyNestedIds, validateEditableLesson } from "./admin-content-validation";
import { createAdminAuditRecord } from "./admin-audit";
import { certificatePrograms } from "@/lib/member-data";
import { validateCourseMetadata } from "./admin-course-validation";
import { sanitizeLessonRichText } from "@/lib/rich-text";
import { buildLessonStarter, nextLessonOrder, type LessonStarterTemplate } from "./admin-lesson-starter";
import { cmsAuthorSlug } from "./admin-authoring-utils";
import { hydrateDocumentId } from "./admin-document-hydration";
export { validateEditableLesson } from "./admin-content-validation";
export { validateCourseMetadata } from "./admin-course-validation";

export type CourseContentStatus = "draft" | "published" | "archived";
export type CourseUnitSummary = { sourceId: string; title?: string; order: number };
export type CourseLessonSummary = { id: string; slug: string; sourceId: string; sourceUnitId: string; title: string; order: number; screenIds: string[]; hasAudio: boolean; version: number; status?: "draft" | "published" };
export type AdminCourseSummary = {
  id: string;
  sourceId: string;
  title: string;
  description?: string;
  kind: "tool" | "use-case";
  image?: string;
  localImage?: string;
  imageAlt?: string;
  coverAssetId?: string;
  duration: string;
  lessonCount: number;
  categories: string[];
  displayOrder: number;
  unitSummaries: CourseUnitSummary[];
  lessonSummaries: CourseLessonSummary[];
  status: CourseContentStatus;
  statusBeforeArchive?: Exclude<CourseContentStatus, "archived">;
  publishedAt?: string | null;
  archivedAt?: string | null;
  updatedAt?: string;
  updatedBy?: string;
  version: number;
  lessons?: { id: string; slug: string; title: string; courseId: string; sourceUnitId: string; unitTitle?: string; unitOrder: number; screenCount: number; order: number; version: number; status: "draft" | "published" }[];
};

export type EditableCourse = AdminCourseSummary;

export type EditableLesson = CoursivLesson & {
  id: string;
  courseId: string;
  status: "draft" | "published";
  version: number;
  updatedAt: string;
  updatedBy: string;
};

export type ContentRevision<T = EditableLesson> = {
  id: string;
  entityId: string;
  entityType?: "course" | "lesson";
  version: number;
  snapshot: T;
  changedBy: string;
  changeSummary: string;
  createdAt: string;
};

function hydrateStoredLesson(id: string, data: Record<string, unknown>) {
  return repairLegacyNestedIds(hydrateDocumentId(id, data) as EditableLesson);
}

const demoLessons = new Map<string, EditableLesson>();
const demoRevisions = new Map<string, ContentRevision[]>();
const demoCourses = new Map<string, AdminCourseSummary>();
const demoCourseRevisions = new Map<string, ContentRevision<EditableCourse>[]>();

const preferredCourseOrder = {
  tool: ["claude","claude-excel","claude-deep","midjourney","lovable","gemini","google-sheet-with-ai","google-slide-with-ai","chatgpt","jasper","chatgpt-deep","stable-diffusion","deepseek","omni","perplexity","kling","canva-ai","communicating-ai","claude-code"],
  "use-case": Array.from({ length: 20 }, (_, index) => `use-case-${index + 1}`),
} satisfies Record<"tool" | "use-case", string[]>;

function canonicalDisplayOrder(kind: "tool" | "use-case", id: string) {
  const index = preferredCourseOrder[kind].indexOf(id);
  return index < 0 ? preferredCourseOrder[kind].length : index;
}

function courseSort(a: AdminCourseSummary, b: AdminCourseSummary) {
  const statusOrder: Record<CourseContentStatus, number> = { published: 0, draft: 1, archived: 2 };
  return statusOrder[a.status] - statusOrder[b.status] || a.displayOrder - b.displayOrder || a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title);
}

function courseUnitSummaries(course: CoursivCourse): CourseUnitSummary[] {
  return course.units.map((unit) => ({ sourceId: unit.sourceId, title: unit.title, order: unit.order }));
}


async function manifest() {
  return JSON.parse(await readFile(join(process.cwd(), "content/coursiv/manifest.json"), "utf8")) as { courses: Array<{ id: string; sourceId: string; title: string; kind: "tool" | "use-case"; duration: string; lessonCount: number; file: string }> };
}

async function localCourse(courseId: string) {
  return JSON.parse(await readFile(join(process.cwd(), "content/coursiv/courses", `${courseId}.json`), "utf8")) as CoursivCourse;
}

function lessonId(courseId: string, slug: string) { return `${courseId}__${slug}`; }

function editable(courseId: string, lesson: CoursivLesson): EditableLesson {
  return repairLegacyNestedIds({
    ...lesson,
    id: lessonId(courseId, lesson.slug),
    courseId,
    status: "published",
    version: 1,
    updatedAt: new Date(0).toISOString(),
    updatedBy: "canonical-import",
  });
}

export async function listAdminCourses(actor: StaffActor, includeLessons = false): Promise<AdminCourseSummary[]> {
  if (!actor.debug && isFirebaseAdminConfigured()) {
    const snapshot = await getAdminDb().collection("courses").get();
    const courses = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Array<AdminCourseSummary & { lessonCount?: number }>;
    if (!includeLessons) return courses.sort(courseSort);
    return courses.map((course) => {
      const units=course.unitSummaries??[];
      const lessons=(course.lessonSummaries??[]).map((lesson)=>{
        const unit=units.find((item)=>item.sourceId===lesson.sourceUnitId);
        return{id:lesson.id,slug:lesson.slug,title:lesson.title,courseId:course.id,sourceUnitId:lesson.sourceUnitId,unitTitle:unit?.title,unitOrder:unit?.order??Number.MAX_SAFE_INTEGER,screenCount:lesson.screenIds.length,order:lesson.order,version:lesson.version??1,status:lesson.status??"published"};
      }).sort((a,b)=>a.unitOrder-b.unitOrder||a.order-b.order||a.title.localeCompare(b.title));
      return{...course,lessons};
    }).sort(courseSort);
  }
  const source = await manifest();
  const canonical = await Promise.all(source.courses.map(async (item) => {
    const course = includeLessons ? await localCourse(item.id) : null;
    const fullCourse = course ?? await localCourse(item.id);
    const canonicalLessons = course?.units.flatMap((unit) => unit.lessons).map((lesson) => {
      const changed = demoLessons.get(lessonId(item.id, lesson.slug));
      const current = changed ?? editable(item.id, lesson);
      const unit=fullCourse.units.find((value)=>value.sourceId===current.sourceUnitId);
      return { id: current.id, slug: current.slug, title: current.title, courseId: item.id, sourceUnitId:current.sourceUnitId, unitTitle:unit?.title, unitOrder:unit?.order??Number.MAX_SAFE_INTEGER, screenCount: current.screens.length, order: current.order, version: current.version, status:current.status };
    }) ?? [];
    const canonicalIds=new Set(canonicalLessons.map((lesson)=>lesson.id));
    const added=[...demoLessons.values()].filter((lesson)=>lesson.courseId===item.id&&!canonicalIds.has(lesson.id)).map((lesson)=>{const unit=fullCourse.units.find((value)=>value.sourceId===lesson.sourceUnitId);return{id:lesson.id,slug:lesson.slug,title:lesson.title,courseId:item.id,sourceUnitId:lesson.sourceUnitId,unitTitle:unit?.title,unitOrder:unit?.order??Number.MAX_SAFE_INTEGER,screenCount:lesson.screens.length,order:lesson.order,version:lesson.version,status:lesson.status}});
    const lessons=[...canonicalLessons,...added].sort((a,b)=>a.unitOrder-b.unitOrder||a.order-b.order||a.title.localeCompare(b.title));
    const base: AdminCourseSummary = {
      ...item,
      image: fullCourse.image,
      localImage: fullCourse.localImage,
      imageAlt: fullCourse.title,
      lessonCount: includeLessons ? lessons.length : fullCourse.units.flatMap((unit) => unit.lessons).length,
      categories: fullCourse.categories ?? [],
      displayOrder: canonicalDisplayOrder(item.kind, item.id),
      unitSummaries: courseUnitSummaries(fullCourse),
      lessonSummaries: fullCourse.units.flatMap((unit)=>unit.lessons).map((lesson)=>({id:lessonId(item.id,lesson.slug),slug:lesson.slug,sourceId:lesson.sourceId,sourceUnitId:lesson.sourceUnitId,title:lesson.title,order:lesson.order,screenIds:lesson.screens.map((screen)=>screen.id),hasAudio:lesson.hasAudio,version:1,status:"published"})),
      status: "published",
      publishedAt: new Date(0).toISOString(),
      archivedAt: null,
      updatedAt: new Date(0).toISOString(),
      updatedBy: "canonical-import",
      version: 1,
      lessons: includeLessons ? lessons : undefined,
    };
    return demoCourses.get(item.id) ?? base;
  }));
  const canonicalIds = new Set(canonical.map((course) => course.id));
  return [...canonical, ...[...demoCourses.values()].filter((course) => !canonicalIds.has(course.id))].sort(courseSort);
}

export async function getAdminCourse(actor: StaffActor, id: string): Promise<EditableCourse | null> {
  if (!actor.debug && isFirebaseAdminConfigured()) {
    const snapshot = await getAdminDb().collection("courses").doc(id).get();
    if (!snapshot.exists) return null;
    const lessonCount = await getAdminDb().collection("lessons").where("courseId", "==", id).count().get();
    return { id: snapshot.id, ...snapshot.data(), lessonCount: lessonCount.data().count, lessonSummaries: (snapshot.data()?.lessonSummaries??[]) } as EditableCourse;
  }
  const courses = await listAdminCourses(actor, true);
  return courses.find((course) => course.id === id) ?? null;
}

export async function getAdminLesson(actor: StaffActor, id: string): Promise<EditableLesson | null> {
  if (!actor.debug && isFirebaseAdminConfigured()) {
    const snapshot = await getAdminDb().collection("lessons").doc(id).get();
    return snapshot.exists ? hydrateStoredLesson(snapshot.id, snapshot.data()!) : null;
  }
  if (demoLessons.has(id)) return demoLessons.get(id)!;
  const separator = id.indexOf("__");
  if (separator < 1) return null;
  const courseId = id.slice(0, separator);
  const slug = id.slice(separator + 2);
  const course = await localCourse(courseId).catch(() => null);
  const lesson = course?.units.flatMap((unit) => unit.lessons).find((item) => item.slug === slug);
  return lesson ? editable(courseId, lesson) : null;
}

export async function publishAdminLesson(actor: StaffActor, request: Request, lesson: EditableLesson, expectedVersion: number, changeSummary: string, auditAction = "content.lesson.publish", reason?: string) {
  lesson = sanitizeLessonRichText(repairLegacyNestedIds(lesson));
  const errors = validateEditableLesson(lesson);
  if (errors.length) return { ok: false as const, status: 422, errors };
  const now = new Date().toISOString();
  if (actor.debug || !isFirebaseAdminConfigured()) {
    const current = await getAdminLesson(actor, lesson.id);
    if (!current) return { ok: false as const, status: 404, errors: ["Lesson not found"] };
    if (current.version !== expectedVersion) return { ok: false as const, status: 409, errors: ["This lesson was updated by another editor. Reload before publishing."] };
    const revision: ContentRevision = { id: randomUUID(), entityId: lesson.id, version: current.version, snapshot: current, changedBy: actor.uid, changeSummary, createdAt: now };
    demoRevisions.set(lesson.id, [revision, ...(demoRevisions.get(lesson.id) ?? [])]);
    const next = { ...lesson, status:"published" as const, version: current.version + 1, updatedAt: now, updatedBy: actor.uid };
    demoLessons.set(lesson.id, next);
    const debugCourse=await getAdminCourse(actor,lesson.courseId);
    if(debugCourse)demoCourses.set(lesson.courseId,{...debugCourse,lessonSummaries:debugCourse.lessonSummaries.map((item)=>item.id===lesson.id?{...item,title:next.title,sourceUnitId:next.sourceUnitId,order:next.order,screenIds:next.screens.map((screen)=>screen.id),hasAudio:next.hasAudio,version:next.version,status:"published"}:item),lessons:debugCourse.lessons?.map((item)=>{
      if(item.id!==lesson.id)return item;
      const unit=debugCourse.unitSummaries.find((value)=>value.sourceId===next.sourceUnitId);
      return{...item,title:next.title,sourceUnitId:next.sourceUnitId,unitTitle:unit?.title,unitOrder:unit?.order??Number.MAX_SAFE_INTEGER,screenCount:next.screens.length,order:next.order,version:next.version,status:"published"};
    })});
    return { ok: true as const, lesson: next };
  }
  const database = getAdminDb();
  const reference = database.collection("lessons").doc(lesson.id);
  const courseReference = database.collection("courses").doc(lesson.courseId);
  const result = await database.runTransaction(async (transaction) => {
    const [snapshot,courseSnapshot] = await Promise.all([transaction.get(reference),transaction.get(courseReference)]);
    if (!snapshot.exists) return { status: 404 as const };
    const current = hydrateStoredLesson(snapshot.id, snapshot.data()!);
    if ((current.version ?? 1) !== expectedVersion) return { status: 409 as const };
    const next: EditableLesson = { ...lesson, status:"published", version: expectedVersion + 1, updatedAt: now, updatedBy: actor.uid };
    const revisionId = `${String(expectedVersion).padStart(8, "0")}-${createHash("sha1").update(`${lesson.id}:${now}`).digest("hex").slice(0, 8)}`;
    transaction.create(database.collection("contentRevisions").doc(lesson.id).collection("versions").doc(revisionId), {
      id: revisionId, entityId: lesson.id, version: expectedVersion, snapshot: current, changedBy: actor.uid, changeSummary, createdAt: now,
    });
    transaction.set(reference, next);
    if(courseSnapshot.exists){
      const summaries=(courseSnapshot.data()?.lessonSummaries??[]) as CourseLessonSummary[];
      const summary:CourseLessonSummary={id:lesson.id,slug:next.slug,sourceId:next.sourceId,sourceUnitId:next.sourceUnitId,title:next.title,order:next.order,screenIds:next.screens.map((screen)=>screen.id),hasAudio:next.hasAudio,version:next.version,status:"published"};
      transaction.set(courseReference,{lessonSummaries:summaries.some((item)=>item.id===lesson.id)?summaries.map((item)=>item.id===lesson.id?summary:item):[...summaries,summary],updatedAt:now,updatedBy:actor.uid},{merge:true});
    }
    transaction.set(database.collection("contentMetadata").doc("learner-app"), { contentVersion: now, updatedAt: now }, { merge: true });
    const audit=createAdminAuditRecord(actor,{action:auditAction,targetType:"lesson",targetId:lesson.id,request,before:current,after:next,reason});
    transaction.create(database.collection("adminAuditLogs").doc(audit.id),audit);
    return { status: 200 as const, lesson: next };
  });
  if (result.status !== 200) return { ok: false as const, status: result.status, errors: [result.status === 409 ? "This lesson was updated by another editor. Reload before publishing." : "Lesson not found"] };
  return { ok: true as const, lesson: result.lesson };
}

export async function listAdminRevisions(actor: StaffActor, id: string) {
  if (actor.debug || !isFirebaseAdminConfigured()) return demoRevisions.get(id) ?? [];
  const snapshot = await getAdminDb().collection("contentRevisions").doc(id).collection("versions").orderBy("createdAt", "desc").limit(50).get();
  return snapshot.docs.map((doc) => doc.data() as ContentRevision);
}

export async function rollbackAdminLesson(actor: StaffActor, request: Request, id: string, revisionId: string, expectedVersion: number, reason: string) {
  const revisions = await listAdminRevisions(actor, id);
  const revision = revisions.find((item) => item.id === revisionId);
  if (!revision) return { ok: false as const, status: 404, errors: ["Revision not found"] };
  return publishAdminLesson(actor, request, { ...revision.snapshot, version: expectedVersion }, expectedVersion, `Rollback to version ${revision.version}: ${reason}`, "content.lesson.rollback", reason);
}

function courseRevisionId(version: number, id: string, now: string) {
  return `${String(version).padStart(8, "0")}-${createHash("sha1").update(`${id}:${now}`).digest("hex").slice(0, 8)}`;
}

function sanitizedCourseInput(current: EditableCourse, input: EditableCourse): EditableCourse {
  const unitSummaries=[...(input.unitSummaries??current.unitSummaries)]
    .map((unit)=>({...unit,title:unit.title?.trim()||"",order:Number(unit.order)}))
    .sort((a,b)=>a.order-b.order)
    .map((unit,order)=>({...unit,order}));
  return {
    ...current,
    title: input.title.trim(),
    kind: current.status === "draft" ? input.kind : current.kind,
    image: input.image?.trim() || "",
    imageAlt: input.imageAlt?.trim() || "",
    coverAssetId: input.coverAssetId?.trim() || "",
    duration: input.duration.trim(),
    categories: input.categories.map((category) => category.trim()).filter(Boolean),
    status: input.status,
    displayOrder: current.displayOrder,
    lessonCount: current.lessonCount,
    unitSummaries,
    lessonSummaries: current.lessonSummaries,
    lessons:current.lessons?.map((lesson)=>{
      const unit=unitSummaries.find((item)=>item.sourceId===lesson.sourceUnitId);
      return{...lesson,unitTitle:unit?.title,unitOrder:unit?.order??Number.MAX_SAFE_INTEGER};
    }),
    id: current.id,
    sourceId: current.sourceId,
  };
}

export async function publishAdminCourse(actor: StaffActor, request: Request, input: EditableCourse, expectedVersion: number, changeSummary: string, auditAction = "content.course.publish", reason?: string) {
  const current = await getAdminCourse(actor, input.id);
  if (!current) return { ok: false as const, status: 404, errors: ["Course not found"] };
  if (current.version !== expectedVersion) return { ok: false as const, status: 409, errors: ["This course was updated by another editor. Reload before publishing."] };
  if (current.status === "archived" && input.status !== "archived" && auditAction !== "content.course.restore") return { ok: false as const, status: 422, errors: ["Use Restore to reactivate an archived course."] };
  const referencedUnitIds=new Set(current.lessonSummaries.map((lesson)=>lesson.sourceUnitId));
  const currentUnitIds=new Set(current.unitSummaries.map((unit)=>unit.sourceId));
  const inputUnits=input.unitSummaries??[];
  const errors:string[]=[];
  if(inputUnits.some((unit)=>!currentUnitIds.has(unit.sourceId)&&!/^cms-unit-[a-z0-9-]+$/i.test(unit.sourceId)))errors.push("New course sections must use a CMS-generated ID.");
  if([...referencedUnitIds].some((unitId)=>!inputUnits.some((unit)=>unit.sourceId===unitId)))errors.push("A section containing lessons cannot be deleted.");
  const candidate = sanitizedCourseInput(current, input);
  errors.push(...validateCourseMetadata(candidate));
  if (candidate.status === "published" && !candidate.lessonSummaries.some((lesson) => lesson.status !== "draft")) {
    errors.push("A published course needs at least one published lesson.");
  }
  if (errors.length) return { ok: false as const, status: 422, errors };
  const now = new Date().toISOString();
  const next: EditableCourse = {
    ...candidate,
    version: expectedVersion + 1,
    publishedAt: candidate.status === "published" ? candidate.publishedAt ?? now : candidate.publishedAt ?? null,
    archivedAt: candidate.status === "archived" ? candidate.archivedAt ?? now : null,
    updatedAt: now,
    updatedBy: actor.uid,
  };
  if (actor.debug || !isFirebaseAdminConfigured()) {
    const revision: ContentRevision<EditableCourse> = { id: randomUUID(), entityId: current.id, entityType: "course", version: current.version, snapshot: current, changedBy: actor.uid, changeSummary, createdAt: now };
    demoCourseRevisions.set(current.id, [revision, ...(demoCourseRevisions.get(current.id) ?? [])]);
    demoCourses.set(current.id, next);
    return { ok: true as const, course: next };
  }
  const database = getAdminDb();
  const reference = database.collection("courses").doc(current.id);
  const result = await database.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) return { status: 404 as const };
    const stored = { id: snapshot.id, ...snapshot.data() } as EditableCourse;
    if ((stored.version ?? 1) !== expectedVersion) return { status: 409 as const };
    const revisionId = courseRevisionId(expectedVersion, current.id, now);
    transaction.create(database.collection("contentRevisions").doc(current.id).collection("versions").doc(revisionId), {
      id: revisionId, entityId: current.id, entityType: "course", version: expectedVersion, snapshot: stored, changedBy: actor.uid, changeSummary, createdAt: now,
    });
    transaction.set(reference, Object.fromEntries(Object.entries(next).filter(([key, value]) => key !== "lessons" && value !== undefined)));
    if (next.coverAssetId) transaction.set(database.collection("mediaAssets").doc(next.coverAssetId), { usagePaths: FieldValue.arrayUnion(`course:${current.id}:cover`) }, { merge: true });
    transaction.set(database.collection("contentMetadata").doc("learner-app"), { contentVersion: now, updatedAt: now }, { merge: true });
    const audit = createAdminAuditRecord(actor, { action: auditAction, targetType: "course", targetId: current.id, request, before: stored, after: next, reason });
    transaction.create(database.collection("adminAuditLogs").doc(audit.id), audit);
    return { status: 200 as const };
  });
  if (result.status !== 200) return { ok: false as const, status: result.status, errors: [result.status === 409 ? "This course was updated by another editor. Reload before publishing." : "Course not found"] };
  return { ok: true as const, course: next };
}

export async function listAdminCourseRevisions(actor: StaffActor, id: string) {
  if (actor.debug || !isFirebaseAdminConfigured()) return demoCourseRevisions.get(id) ?? [];
  const snapshot = await getAdminDb().collection("contentRevisions").doc(id).collection("versions").orderBy("createdAt", "desc").limit(50).get();
  return snapshot.docs.map((doc) => doc.data() as ContentRevision<EditableCourse>);
}

export async function rollbackAdminCourse(actor: StaffActor, request: Request, id: string, revisionId: string, expectedVersion: number, reason: string) {
  const revision = (await listAdminCourseRevisions(actor, id)).find((item) => item.id === revisionId);
  if (!revision) return { ok: false as const, status: 404, errors: ["Course revision not found"] };
  const current = await getAdminCourse(actor, id);
  if (!current) return { ok: false as const, status: 404, errors: ["Course not found"] };
  const referencedUnitIds=new Set(current.lessonSummaries.map((lesson)=>lesson.sourceUnitId));
  const revisionUnits=revision.snapshot.unitSummaries??[];
  const preservedUnits=current.unitSummaries.filter((unit)=>referencedUnitIds.has(unit.sourceId)&&!revisionUnits.some((item)=>item.sourceId===unit.sourceId));
  const snapshot = { ...revision.snapshot, lessonCount: current.lessonCount, unitSummaries: [...revisionUnits,...preservedUnits].map((unit,order)=>({...unit,order})), lessonSummaries: current.lessonSummaries, version: expectedVersion };
  return publishAdminCourse(actor, request, snapshot, expectedVersion, `Rollback to version ${revision.version}: ${reason}`, "content.course.rollback", reason);
}

export async function setAdminCourseArchived(actor: StaffActor, request: Request, id: string, expectedVersion: number, archived: boolean, reason: string) {
  const current = await getAdminCourse(actor, id);
  if (!current) return { ok: false as const, status: 404, errors: ["Course not found"] };
  if (current.version !== expectedVersion) return { ok: false as const, status: 409, errors: ["This course was updated by another editor. Reload before continuing."] };
  if (archived && current.status === "archived") return { ok: true as const, course: current };
  if (!archived && current.status !== "archived") return { ok: true as const, course: current };
  let displayOrder = current.displayOrder;
  if (!archived) {
    const courses = await listAdminCourses(actor);
    displayOrder = Math.max(-1, ...courses.filter((course) => course.kind === current.kind && course.status !== "archived").map((course) => course.displayOrder)) + 1;
  }
  const next: EditableCourse = {
    ...current,
    displayOrder,
    statusBeforeArchive: archived ? (current.status === "archived" ? "published" : current.status) : current.statusBeforeArchive,
    status: archived ? "archived" : current.statusBeforeArchive ?? (current.lessonCount ? "published" : "draft"),
    archivedAt: archived ? new Date().toISOString() : null,
    version: expectedVersion,
  };
  return publishAdminCourse(actor, request, next, expectedVersion, archived ? `Archived course: ${reason}` : `Restored course: ${reason}`, archived ? "content.course.archive" : "content.course.restore", reason);
}

export async function reorderAdminCourses(actor: StaffActor, request: Request, kind: "tool" | "use-case", orderedIds: string[], expectedVersions: Record<string, number>) {
  const current = (await listAdminCourses(actor)).filter((course) => course.kind === kind && course.status !== "archived");
  const expectedIds = [...current.map((course) => course.id)].sort();
  if (orderedIds.length !== new Set(orderedIds).size || JSON.stringify([...orderedIds].sort()) !== JSON.stringify(expectedIds)) {
    return { ok: false as const, status: 422, errors: ["Reorder payload must contain every active course in this category exactly once."] };
  }
  const changed = orderedIds.map((id, displayOrder) => ({ current: current.find((course) => course.id === id)!, displayOrder })).filter(({ current: course, displayOrder }) => course.displayOrder !== displayOrder);
  if (!changed.length) return { ok: true as const, courses: current.sort(courseSort) };
  for (const { current: course } of changed) if (expectedVersions[course.id] !== course.version) return { ok: false as const, status: 409, errors: [`${course.title} was updated by another editor.`] };
  const now = new Date().toISOString();
  if (actor.debug || !isFirebaseAdminConfigured()) {
    for (const { current: course, displayOrder } of changed) {
      const revision: ContentRevision<EditableCourse> = { id: randomUUID(), entityId: course.id, entityType: "course", version: course.version, snapshot: course, changedBy: actor.uid, changeSummary: "Reordered course catalog", createdAt: now };
      demoCourseRevisions.set(course.id, [revision, ...(demoCourseRevisions.get(course.id) ?? [])]);
      demoCourses.set(course.id, { ...course, displayOrder, version: course.version + 1, updatedAt: now, updatedBy: actor.uid });
    }
    return { ok: true as const, courses: (await listAdminCourses(actor)).filter((course) => course.kind === kind && course.status !== "archived") };
  }
  const database = getAdminDb();
  const result = await database.runTransaction(async (transaction) => {
    const snapshots = [];
    for (const { current: course } of changed) snapshots.push(await transaction.get(database.collection("courses").doc(course.id)));
    for (const [index, snapshot] of snapshots.entries()) {
      const course = changed[index].current;
      if (!snapshot.exists || Number(snapshot.data()?.version ?? 1) !== expectedVersions[course.id]) return { status: 409 as const };
    }
    for (const [index, { current: course, displayOrder }] of changed.entries()) {
      const stored = { id: course.id, ...snapshots[index].data() } as EditableCourse;
      const next = { ...stored, displayOrder, version: stored.version + 1, updatedAt: now, updatedBy: actor.uid };
      transaction.set(snapshots[index].ref, { displayOrder, version: next.version, updatedAt: now, updatedBy: actor.uid }, { merge: true });
      transaction.create(database.collection("contentRevisions").doc(course.id).collection("versions").doc(courseRevisionId(stored.version, course.id, now)), {
        id: courseRevisionId(stored.version, course.id, now), entityId: course.id, entityType: "course", version: stored.version, snapshot: stored, changedBy: actor.uid, changeSummary: "Reordered course catalog", createdAt: now,
      });
      const audit = createAdminAuditRecord(actor, { action: "content.course.reorder", targetType: "course", targetId: course.id, request, before: stored, after: next });
      transaction.create(database.collection("adminAuditLogs").doc(audit.id), audit);
    }
    transaction.set(database.collection("contentMetadata").doc("learner-app"), { contentVersion: now, updatedAt: now }, { merge: true });
    return { status: 200 as const };
  });
  if (result.status !== 200) return { ok: false as const, status: 409, errors: ["Course catalog changed while reordering. Reload and try again."] };
  return { ok: true as const, courses: (await listAdminCourses(actor)).filter((course) => course.kind === kind && course.status !== "archived") };
}

export async function reorderAdminCatalog(actor: StaffActor, request: Request, orders: Record<"tool"|"use-case", string[]>, expectedVersions: Record<string, number>) {
  const current=(await listAdminCourses(actor)).filter((course)=>course.status!=="archived");
  for(const kind of ["tool","use-case"] as const){
    const expectedIds=current.filter((course)=>course.kind===kind).map((course)=>course.id).sort();
    if(orders[kind].length!==new Set(orders[kind]).size||JSON.stringify([...orders[kind]].sort())!==JSON.stringify(expectedIds)){
      return{ok:false as const,status:422,errors:[`${kind==="tool"?"AI Tools":"Use Cases"} order must contain every active course exactly once.`]};
    }
  }
  const changed=(["tool","use-case"] as const).flatMap((kind)=>orders[kind].map((id,displayOrder)=>({current:current.find((course)=>course.id===id)!,displayOrder}))).filter(({current:course,displayOrder})=>course.displayOrder!==displayOrder);
  if(!changed.length)return{ok:true as const,courses:current.sort(courseSort)};
  for(const {current:course} of changed)if(expectedVersions[course.id]!==course.version)return{ok:false as const,status:409,errors:[`${course.title} was updated by another editor. Reload before saving the catalog.`]};
  const now=new Date().toISOString();
  if(actor.debug||!isFirebaseAdminConfigured()){
    for(const {current:course,displayOrder} of changed){
      const revision:ContentRevision<EditableCourse>={id:randomUUID(),entityId:course.id,entityType:"course",version:course.version,snapshot:course,changedBy:actor.uid,changeSummary:"Reordered complete catalog",createdAt:now};
      demoCourseRevisions.set(course.id,[revision,...(demoCourseRevisions.get(course.id)??[])]);
      demoCourses.set(course.id,{...course,displayOrder,version:course.version+1,updatedAt:now,updatedBy:actor.uid});
    }
    return{ok:true as const,courses:(await listAdminCourses(actor)).filter((course)=>course.status!=="archived").sort(courseSort)};
  }
  const database=getAdminDb();
  const result=await database.runTransaction(async(transaction)=>{
    const snapshots=[];
    for(const {current:course} of changed)snapshots.push(await transaction.get(database.collection("courses").doc(course.id)));
    for(const [index,snapshot] of snapshots.entries()){
      const course=changed[index].current;
      if(!snapshot.exists||Number(snapshot.data()?.version??1)!==expectedVersions[course.id])return{status:409 as const};
    }
    for(const [index,{current:course,displayOrder}] of changed.entries()){
      const stored={id:course.id,...snapshots[index].data()} as EditableCourse;
      const next={...stored,displayOrder,version:stored.version+1,updatedAt:now,updatedBy:actor.uid};
      transaction.set(snapshots[index].ref,{displayOrder,version:next.version,updatedAt:now,updatedBy:actor.uid},{merge:true});
      transaction.create(database.collection("contentRevisions").doc(course.id).collection("versions").doc(courseRevisionId(stored.version,course.id,now)),{id:courseRevisionId(stored.version,course.id,now),entityId:course.id,entityType:"course",version:stored.version,snapshot:stored,changedBy:actor.uid,changeSummary:"Reordered complete catalog",createdAt:now});
      const audit=createAdminAuditRecord(actor,{action:"content.catalog.reorder",targetType:"course",targetId:course.id,request,before:stored,after:next});
      transaction.create(database.collection("adminAuditLogs").doc(audit.id),audit);
    }
    transaction.set(database.collection("contentMetadata").doc("learner-app"),{contentVersion:now,updatedAt:now},{merge:true});
    return{status:200 as const};
  });
  if(result.status!==200)return{ok:false as const,status:409,errors:["The catalog changed while you were arranging it. Reload and try again."]};
  return{ok:true as const,courses:(await listAdminCourses(actor)).filter((course)=>course.status!=="archived").sort(courseSort)};
}

export async function reorderAdminLessons(actor: StaffActor, request: Request, courseId: string, unitId: string, orderedIds: string[], expectedCourseVersion: number, expectedVersions: Record<string, number>) {
  const course=await getAdminCourse(actor,courseId);
  if(!course)return{ok:false as const,status:404,errors:["Course not found"]};
  if(course.version!==expectedCourseVersion)return{ok:false as const,status:409,errors:["This course was updated by another editor. Reload before reordering lessons."]};
  if(!course.unitSummaries.some((unit)=>unit.sourceId===unitId))return{ok:false as const,status:422,errors:["Course section not found"]};
  const summaries=course.lessonSummaries.filter((lesson)=>lesson.sourceUnitId===unitId).sort((a,b)=>a.order-b.order||a.title.localeCompare(b.title));
  const expectedIds=[...summaries.map((lesson)=>lesson.id)].sort();
  if(orderedIds.length!==new Set(orderedIds).size||JSON.stringify([...orderedIds].sort())!==JSON.stringify(expectedIds)){
    return{ok:false as const,status:422,errors:["Reorder payload must contain every lesson in this section exactly once."]};
  }
  const changed=orderedIds.map((id,order)=>({summary:summaries.find((lesson)=>lesson.id===id)!,order})).filter(({summary,order})=>summary.order!==order);
  if(!changed.length){
    const refreshed=(await listAdminCourses(actor,true)).find((item)=>item.id===courseId)??course;
    return{ok:true as const,course:refreshed};
  }
  for(const {summary} of changed)if(expectedVersions[summary.id]!==summary.version)return{ok:false as const,status:409,errors:[`${summary.title} was updated by another editor.`]};
  const now=new Date().toISOString();
  if(actor.debug||!isFirebaseAdminConfigured()){
    const lessonUpdates=new Map<string,EditableLesson>();
    for(const {summary,order} of changed){
      const current=await getAdminLesson(actor,summary.id);
      if(!current||current.version!==expectedVersions[summary.id])return{ok:false as const,status:409,errors:[`${summary.title} changed while reordering.`]};
      const revision:ContentRevision={id:randomUUID(),entityId:current.id,version:current.version,snapshot:current,changedBy:actor.uid,changeSummary:"Reordered lessons",createdAt:now};
      demoRevisions.set(current.id,[revision,...(demoRevisions.get(current.id)??[])]);
      const next={...current,order,version:current.version+1,updatedAt:now,updatedBy:actor.uid};
      demoLessons.set(current.id,next);lessonUpdates.set(current.id,next);
    }
    const nextSummaries=course.lessonSummaries.map((summary)=>{
      const next=lessonUpdates.get(summary.id);
      return next?{...summary,order:next.order,version:next.version}:summary;
    });
    const courseRevision:ContentRevision<EditableCourse>={id:randomUUID(),entityId:course.id,entityType:"course",version:course.version,snapshot:course,changedBy:actor.uid,changeSummary:"Reordered lessons",createdAt:now};
    demoCourseRevisions.set(course.id,[courseRevision,...(demoCourseRevisions.get(course.id)??[])]);
    demoCourses.set(course.id,{...course,lessonSummaries:nextSummaries,lessons:course.lessons?.map((lesson)=>{
      const next=lessonUpdates.get(lesson.id);
      return next?{...lesson,order:next.order,version:next.version}:lesson;
    }).sort((a,b)=>a.unitOrder-b.unitOrder||a.order-b.order||a.title.localeCompare(b.title)),version:course.version+1,updatedAt:now,updatedBy:actor.uid});
    const refreshed=(await listAdminCourses(actor,true)).find((item)=>item.id===courseId)!;
    return{ok:true as const,course:refreshed};
  }
  const database=getAdminDb();
  const courseReference=database.collection("courses").doc(courseId);
  const result=await database.runTransaction(async(transaction)=>{
    const courseSnapshot=await transaction.get(courseReference);
    if(!courseSnapshot.exists||Number(courseSnapshot.data()?.version??1)!==expectedCourseVersion)return{status:409 as const};
    const lessonSnapshots=[];
    for(const {summary} of changed)lessonSnapshots.push(await transaction.get(database.collection("lessons").doc(summary.id)));
    for(const [index,snapshot] of lessonSnapshots.entries()){
      const summary=changed[index].summary;
      if(!snapshot.exists||Number(snapshot.data()?.version??1)!==expectedVersions[summary.id])return{status:409 as const};
    }
    const storedCourse={id:courseSnapshot.id,...courseSnapshot.data()} as EditableCourse;
    const summaryUpdates=new Map<string,CourseLessonSummary>();
    for(const [index,{summary,order}] of changed.entries()){
      const snapshot=lessonSnapshots[index];
      const current=hydrateStoredLesson(snapshot.id,snapshot.data()!);
      const next={...current,order,version:current.version+1,updatedAt:now,updatedBy:actor.uid};
      transaction.set(snapshot.ref,next);
      const revisionId=`${String(current.version).padStart(8,"0")}-${createHash("sha1").update(`${current.id}:${now}`).digest("hex").slice(0,8)}`;
      transaction.create(database.collection("contentRevisions").doc(current.id).collection("versions").doc(revisionId),{id:revisionId,entityId:current.id,version:current.version,snapshot:current,changedBy:actor.uid,changeSummary:"Reordered lessons",createdAt:now});
      const audit=createAdminAuditRecord(actor,{action:"content.lesson.reorder",targetType:"lesson",targetId:current.id,request,before:current,after:next});
      transaction.create(database.collection("adminAuditLogs").doc(audit.id),audit);
      summaryUpdates.set(summary.id,{...summary,order,version:next.version});
    }
    const nextSummaries=((courseSnapshot.data()?.lessonSummaries??[]) as CourseLessonSummary[]).map((summary)=>summaryUpdates.get(summary.id)??summary);
    const nextCourse={...storedCourse,lessonSummaries:nextSummaries,version:expectedCourseVersion+1,updatedAt:now,updatedBy:actor.uid};
    const courseRevision=courseRevisionId(expectedCourseVersion,courseId,now);
    transaction.create(database.collection("contentRevisions").doc(courseId).collection("versions").doc(courseRevision),{id:courseRevision,entityId:courseId,entityType:"course",version:expectedCourseVersion,snapshot:storedCourse,changedBy:actor.uid,changeSummary:"Reordered lessons",createdAt:now});
    transaction.set(courseReference,{lessonSummaries:nextSummaries,version:nextCourse.version,updatedAt:now,updatedBy:actor.uid},{merge:true});
    const courseAudit=createAdminAuditRecord(actor,{action:"content.course.lesson_reorder",targetType:"course",targetId:courseId,request,before:storedCourse,after:nextCourse});
    transaction.create(database.collection("adminAuditLogs").doc(courseAudit.id),courseAudit);
    transaction.set(database.collection("contentMetadata").doc("learner-app"),{contentVersion:now,updatedAt:now},{merge:true});
    return{status:200 as const};
  });
  if(result.status!==200)return{ok:false as const,status:409,errors:["Course lessons changed while reordering. Reload and try again."]};
  const refreshed=(await listAdminCourses(actor,true)).find((item)=>item.id===courseId);
  return refreshed?{ok:true as const,course:refreshed}:{ok:false as const,status:404,errors:["Course not found"]};
}

export async function deleteAdminDraftCourse(actor: StaffActor, request: Request, id: string, expectedVersion: number, reason: string) {
  const current = await getAdminCourse(actor, id);
  if (!current) return { ok: false as const, status: 404, error: "Course not found" };
  if (current.version !== expectedVersion) return { ok: false as const, status: 409, error: "This course was updated by another editor." };
  if (current.status !== "draft" || current.lessonCount !== 0) return { ok: false as const, status: 422, error: "Only an empty draft course can be permanently deleted." };
  if (certificatePrograms.some((program) => program.courseIds.includes(id))) return { ok: false as const, status: 422, error: "This course is referenced by a certificate program." };
  if (actor.debug || !isFirebaseAdminConfigured()) {
    if (!demoCourses.has(id)) return { ok: false as const, status: 422, error: "Canonical courses cannot be permanently deleted in debug mode." };
    demoCourses.delete(id);
    demoCourseRevisions.delete(id);
    return { ok: true as const };
  }
  const database = getAdminDb();
  const [progress, certificates] = await Promise.all([
    database.collectionGroup("lessons").where("courseId", "==", id).limit(1).get(),
    database.collection("certificates").where("courseId", "==", id).limit(1).get(),
  ]);
  if (!progress.empty || !certificates.empty) return { ok: false as const, status: 422, error: "This course has learning or certificate history and cannot be permanently deleted." };
  const now = new Date().toISOString();
  const reference = database.collection("courses").doc(id);
  const result = await database.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) return { status: 404 as const };
    const stored = { id: snapshot.id, ...snapshot.data() } as EditableCourse;
    if (stored.version !== expectedVersion) return { status: 409 as const };
    if (stored.status !== "draft" || stored.lessonCount !== 0) return { status: 422 as const };
    transaction.delete(reference);
    transaction.set(database.collection("contentMetadata").doc("learner-app"), { contentVersion: now, updatedAt: now }, { merge: true });
    const audit = createAdminAuditRecord(actor, { action: "content.course.delete", targetType: "course", targetId: id, request, before: stored, reason });
    transaction.create(database.collection("adminAuditLogs").doc(audit.id), audit);
    return { status: 200 as const };
  });
  return result.status === 200 ? { ok: true as const } : { ok: false as const, status: result.status, error: result.status === 409 ? "This course was updated by another editor." : "Course cannot be deleted." };
}

export async function createAdminCourse(actor: StaffActor, input: { title: string; kind?: "tool" | "use-case"; duration?: string; categories?: string[] }) {
  const title=typeof input.title==="string"?input.title.trim():"";
  if(!title)return {ok:false as const,status:400,error:"Course title is required"};
  if(input.kind&&!["tool","use-case"].includes(input.kind))return {ok:false as const,status:400,error:"Choose a valid course type"};
  const id=cmsAuthorSlug(title,"course",randomUUID);
  const now=new Date().toISOString();
  const kind=input.kind??"use-case";
  const existingCourses=await listAdminCourses(actor);
  if(existingCourses.some((item)=>item.title.trim().toLowerCase()===title.toLowerCase()))return {ok:false as const,status:409,error:"A course with this title already exists"};
  const nextOrder=Math.max(-1,...existingCourses.filter((item)=>item.kind===kind&&item.status!=="archived").map((item)=>item.displayOrder))+1;
  const sourceId=`cms-${randomUUID()}`;
  const categories=Array.isArray(input.categories)?input.categories.filter((item):item is string=>typeof item==="string"):[];
  const course:AdminCourseSummary={id,sourceId,title,kind,duration:typeof input.duration==="string"&&input.duration.trim()?input.duration.trim():"1 hour",lessonCount:0,categories,displayOrder:nextOrder,unitSummaries:[{sourceId:`cms-unit-${id}`,title:"Course lessons",order:0}],lessonSummaries:[],status:"draft",publishedAt:null,archivedAt:null,updatedAt:now,updatedBy:actor.uid,version:1,lessons:[]};
  const errors=validateCourseMetadata(course);
  if(errors.length)return {ok:false as const,status:400,error:errors[0]};
  if(actor.debug||!isFirebaseAdminConfigured()){
    if(demoCourses.has(id)||(await manifest()).courses.some((item)=>item.id===id))return {ok:false as const,status:409,error:"A course with this slug already exists"};
    demoCourses.set(id,course);
    return {ok:true as const,course};
  }
  try{await getAdminDb().collection("courses").doc(id).create({...course,lessons:undefined,updatedBy:actor.uid});return {ok:true as const,course}}
  catch(error){const code=String((error as {code?:unknown}).code??"");if(code==="6"||code.toLowerCase().includes("already"))return {ok:false as const,status:409,error:"A course with this slug already exists"};throw error}
}

export async function createAdminLesson(actor: StaffActor, input: {
  courseId: string;
  title: string;
  sourceUnitId?: string;
  template?: LessonStarterTemplate;
}) {
  const courseId=typeof input.courseId==="string"?input.courseId.trim():"";const title=typeof input.title==="string"?input.title.trim():"";
  if(!courseId||!title)return {ok:false as const,status:400,error:"Course and lesson title are required"};
  if(title.length>120)return {ok:false as const,status:400,error:"Lesson title must be 120 characters or fewer"};
  const slug=cmsAuthorSlug(title,"lesson",randomUUID);const id=lessonId(courseId,slug);const now=new Date().toISOString();
  const courses=await listAdminCourses(actor,true);const course=courses.find((item)=>item.id===courseId);
  if(!course)return {ok:false as const,status:404,error:"Course not found"};
  if(course.lessons?.some((item)=>item.slug===slug||item.title.trim().toLowerCase()===title.toLowerCase()))return {ok:false as const,status:409,error:"A lesson with this title already exists"};
  const sourceUnitId=(typeof input.sourceUnitId==="string"?input.sourceUnitId:course.unitSummaries[0]?.sourceId??"").trim();
  if(!sourceUnitId||!course.unitSummaries.some((unit)=>unit.sourceId===sourceUnitId))return {ok:false as const,status:400,error:"Choose a valid course section"};
  const template=input.template??"content";
  if(!["content","image","quiz","practice"].includes(template))return {ok:false as const,status:400,error:"Choose a valid lesson template"};
  const sourceId=`cms-${randomUUID()}`;
  const screens=buildLessonStarter(template,title,randomUUID);
  const screenId=screens[0].id;
  const order=nextLessonOrder(course.lessonSummaries??[],sourceUnitId);
  const lesson:EditableLesson={id,courseId,schemaVersion:3,sourceId,sourceUnitId,sourceGuideId:course.sourceId,slug,title,order,readUrl:"",hasAudio:false,blocks:screens.flatMap((screen)=>screen.blocks),screens,raw:{cms:true,starterTemplate:template},status:"draft",version:1,updatedAt:now,updatedBy:actor.uid};
  if(actor.debug||!isFirebaseAdminConfigured()){
    demoLessons.set(id,lesson);
    const unit=course.unitSummaries.find((item)=>item.sourceId===lesson.sourceUnitId);
    const summary:CourseLessonSummary={id,slug,sourceId,sourceUnitId:lesson.sourceUnitId,title,order:lesson.order,screenIds:[screenId],hasAudio:false,version:1,status:"draft"};
    demoCourses.set(courseId,{...course,lessonCount:(course.lessonCount??0)+1,lessonSummaries:[...(course.lessonSummaries??[]),summary],lessons:[...(course.lessons??[]),{id,slug,title,courseId,sourceUnitId:lesson.sourceUnitId,unitTitle:unit?.title,unitOrder:unit?.order??Number.MAX_SAFE_INTEGER,screenCount:1,order:lesson.order,version:1,status:"draft"}]});
    return {ok:true as const,lesson};
  }
  const database=getAdminDb();
  const storedLesson=await database.runTransaction(async(transaction)=>{
    const courseRef=database.collection("courses").doc(courseId);
    const courseSnapshot=await transaction.get(courseRef);
    if(!courseSnapshot.exists)throw new Error("Course not found");
    const courseData=courseSnapshot.data()??{};
    const summaries=(courseData.lessonSummaries??[]) as CourseLessonSummary[];
    const storedUnits=(courseData.unitSummaries??course.unitSummaries) as CourseUnitSummary[];
    if(!storedUnits.some((unit)=>unit.sourceId===sourceUnitId))throw new Error("Course section no longer exists");
    const finalLesson={...lesson,order:nextLessonOrder(summaries,sourceUnitId)};
    const summary:CourseLessonSummary={id,slug,sourceId,sourceUnitId:finalLesson.sourceUnitId,title,order:finalLesson.order,screenIds:[screenId],hasAudio:false,version:1,status:"draft"};
    transaction.create(database.collection("lessons").doc(id),finalLesson);
    transaction.set(courseRef,{lessonCount:Number(courseData.lessonCount??0)+1,lessonSummaries:[...summaries,summary],updatedAt:now,updatedBy:actor.uid},{merge:true});
    transaction.set(database.collection("contentMetadata").doc("learner-app"),{contentVersion:now,updatedAt:now},{merge:true});
    return finalLesson;
  });
  return {ok:true as const,lesson:storedLesson};
}
