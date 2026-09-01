import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const commit = process.argv.includes("--commit");
const pruneLegacy = process.argv.includes("--prune-legacy");
const root = process.cwd();
const files = (await readdir(join(root, "content/coursiv/courses"))).filter((file) => file.endsWith(".json")).sort();
const courses = await Promise.all(files.map(async (file) => JSON.parse(await readFile(join(root, "content/coursiv/courses", file), "utf8"))));
const preferredCourseOrder = {
  tool: ["claude","claude-excel","claude-deep","midjourney","lovable","gemini","google-sheet-with-ai","google-sheet-with-ai-shorts","google-slide-with-ai","google-slide-with-ai-short","chatgpt","jasper","chatgpt-deep","stable-diffusion","deepseek","omni","perplexity","kling","canva-ai","communicating-ai","claude-code"],
  "use-case": Array.from({ length: 20 }, (_, index) => `use-case-${index + 1}`),
};
const documents = [];
let screens = 0;
let images = 0;
let videos = 0;
for (const course of courses) {
  const lessons = course.units.flatMap((unit) => unit.lessons);
  const preferredIndex = preferredCourseOrder[course.kind]?.indexOf(course.id) ?? -1;
  documents.push({ collection: "courses", id: course.id, data: {
    ...course,
    units: undefined,
    unitSummaries: course.units.map((unit) => ({ sourceId: unit.sourceId, title: unit.title, order: unit.order })),
    lessonSummaries: lessons.map((lesson)=>({id:`${course.id}__${lesson.slug}`,slug:lesson.slug,sourceId:lesson.sourceId,sourceUnitId:lesson.sourceUnitId,title:lesson.title,order:lesson.order,screenIds:lesson.screens.map((screen)=>screen.id),hasAudio:lesson.hasAudio,version:1})),
    lessonCount: lessons.length,
    displayOrder: preferredIndex < 0 ? preferredCourseOrder[course.kind]?.length ?? 0 : preferredIndex,
    imageAlt: course.title,
    status: "published",
    version: 1,
    publishedAt: new Date(0).toISOString(),
    archivedAt: null,
    updatedAt: new Date(0).toISOString(),
    updatedBy: "canonical-import",
  } });
  for (const lesson of lessons) {
    screens += lesson.screens.length;
    for (const screen of lesson.screens) for (const block of screen.blocks) {
      if (block.type === "image") images++;
      if (block.type === "video") videos++;
    }
    documents.push({ collection: "lessons", id: `${course.id}__${lesson.slug}`, data: { ...lesson, id: `${course.id}__${lesson.slug}`, courseId: course.id, status: "published", version: 1, updatedAt: new Date(0).toISOString(), updatedBy: "canonical-import", canonicalChecksum: createHash("sha256").update(JSON.stringify(lesson)).digest("hex") } });
  }
}
const summary = { courses: courses.length, lessons: documents.filter((item) => item.collection === "lessons").length, screens, images, videos };
if (!commit) {
  console.log(JSON.stringify({ mode: "dry-run", summary, next: "Run npm run cms:import -- --commit to write Firestore." }, null, 2));
  process.exit(0);
}
const credential = process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY
  ? cert({ projectId:process.env.FIREBASE_PROJECT_ID,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey:process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g,"\n") })
  : applicationDefault();
const app = getApps()[0] ?? initializeApp({ credential });
const database = getFirestore(app);
async function writeSizedBatches(items, applyItem) {
  let pending=[];let pendingBytes=0;
  const flush=async()=>{if(!pending.length)return;const batch=database.batch();for(const item of pending)applyItem(batch,item);await batch.commit();pending=[];pendingBytes=0};
  for(const item of items){
    const bytes=Buffer.byteLength(JSON.stringify(item.data??{}),"utf8")+1024;
    if(pending.length>=20||pendingBytes+bytes>4*1024*1024)await flush();
    pending.push(item);pendingBytes+=bytes;
  }
  await flush();
}
const [existingCourses, existingLessons, existingMetadata] = await Promise.all([
  database.collection("courses").get(),
  database.collection("lessons").get(),
  database.collection("contentMetadata").doc("learner-app").get(),
]);
const canonicalCourseIds = new Set(documents.filter((item)=>item.collection==="courses").map((item)=>item.id));
const canonicalLessonIds = new Set(documents.filter((item)=>item.collection==="lessons").map((item)=>item.id));
const legacyCourses = existingCourses.docs.filter((document)=>!canonicalCourseIds.has(document.id));
const legacyLessons = existingLessons.docs.filter((document)=>!canonicalLessonIds.has(document.id));
if ((legacyCourses.length || legacyLessons.length) && !pruneLegacy) {
  throw new Error(`Legacy CMS documents detected. Re-run with --prune-legacy to back up and remove them safely: ${JSON.stringify({legacyCourses:legacyCourses.length,legacyLessons:legacyLessons.length})}`);
}
const migrationId=`canonical-v3-${new Date().toISOString().replace(/[:.]/g,"-")}`;
const backupRoot=database.collection("migrationBackups").doc(migrationId);
await backupRoot.set({id:migrationId,type:"canonical-v3-cutover",status:"backing-up",startedAt:new Date().toISOString(),before:{courses:existingCourses.size,lessons:existingLessons.size,metadata:existingMetadata.exists?existingMetadata.data():null},target:summary});
const backupDocuments=[
  ...existingCourses.docs.map((document)=>({reference:backupRoot.collection("courses").doc(document.id),data:{id:document.id,...document.data()}})),
  ...existingLessons.docs.map((document)=>({reference:backupRoot.collection("lessons").doc(document.id),data:{id:document.id,...document.data()}})),
];
await writeSizedBatches(backupDocuments,(batch,item)=>batch.set(item.reference,item.data));
if(existingMetadata.exists)await backupRoot.collection("metadata").doc("learner-app").set(existingMetadata.data());
const cleanDocuments=documents.map((item)=>({...item,data:Object.fromEntries(Object.entries(item.data).filter(([,value])=>value!==undefined))}));
await writeSizedBatches(cleanDocuments,(batch,item)=>batch.set(database.collection(item.collection).doc(item.id),item.data));
const legacyDocuments=[...legacyCourses,...legacyLessons];
for(let start=0;start<legacyDocuments.length;start+=350){const batch=database.batch();for(const document of legacyDocuments.slice(start,start+350))batch.delete(document.ref);await batch.commit()}
await database.collection("contentMetadata").doc("learner-app").set({ schemaVersion: 3, source: "canonical-import", counts: summary, contentVersion: new Date().toISOString(), updatedAt: new Date().toISOString() }, { merge: true });
const [courseCount, lessonCount] = await Promise.all([database.collection("courses").count().get(), database.collection("lessons").count().get()]);
const verified = { courses: courseCount.data().count, lessons: lessonCount.data().count };
if (verified.courses !== summary.courses || verified.lessons !== summary.lessons) {await backupRoot.set({status:"verification-failed",verified,failedAt:new Date().toISOString()},{merge:true});throw new Error(`CMS import verification failed: ${JSON.stringify({ summary, verified })}`)}
await backupRoot.set({status:"complete",verified,removed:{courses:legacyCourses.length,lessons:legacyLessons.length},completedAt:new Date().toISOString()},{merge:true});
console.log(JSON.stringify({ mode: "committed", migrationId, summary, backedUp:{courses:existingCourses.size,lessons:existingLessons.size},removed:{courses:legacyCourses.length,lessons:legacyLessons.length},verified }, null, 2));
