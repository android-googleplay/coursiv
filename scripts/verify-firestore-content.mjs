import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const credential=process.env.FIREBASE_PROJECT_ID&&process.env.FIREBASE_CLIENT_EMAIL&&process.env.FIREBASE_PRIVATE_KEY?cert({projectId:process.env.FIREBASE_PROJECT_ID,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey:process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g,"\n")}):applicationDefault();
const database=getFirestore(getApps()[0]??initializeApp({credential}));
const files=(await readdir(join(process.cwd(),"content/coursiv/courses"))).filter((file)=>file.endsWith(".json")).sort();
const courses=await Promise.all(files.map(async(file)=>JSON.parse(await readFile(join(process.cwd(),"content/coursiv/courses",file),"utf8"))));
const expected=new Map();
for(const course of courses)for(const lesson of course.units.flatMap((unit)=>unit.lessons))expected.set(`${course.id}__${lesson.slug}`,lesson);
const [courseSnapshot,lessonSnapshot,metadataSnapshot]=await Promise.all([database.collection("courses").get(),database.collection("lessons").get(),database.collection("contentMetadata").doc("learner-app").get()]);
const stable=(value)=>{if(Array.isArray(value))return value.map(stable);if(value&&typeof value==="object")return Object.fromEntries(Object.keys(value).sort().filter((key)=>value[key]!==undefined).map((key)=>[key,stable(value[key])]));return value};
const hash=(value)=>createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
const errors=[];
const canonicalCourses=new Map(courses.map((course)=>[course.id,course]));
for(const document of courseSnapshot.docs){
  const local=canonicalCourses.get(document.id);if(!local){errors.push(`Unexpected course ${document.id}`);continue}
  const remote=document.data();const lessons=local.units.flatMap((unit)=>unit.lessons);const expectedIds=lessons.map((lesson)=>`${local.id}__${lesson.slug}`).sort();const summaryIds=(remote.lessonSummaries??[]).map((lesson)=>lesson.id).sort();
  if(remote.lessonCount!==lessons.length)errors.push(`Course lesson count mismatch ${document.id}`);
  if(JSON.stringify(summaryIds)!==JSON.stringify(expectedIds))errors.push(`Course lesson summary mismatch ${document.id}`);
  if(!Number.isInteger(remote.displayOrder)||!Array.isArray(remote.unitSummaries)||remote.unitSummaries.length!==local.units.length)errors.push(`Course metadata projection invalid ${document.id}`);
  canonicalCourses.delete(document.id);
}
for(const id of canonicalCourses.keys())errors.push(`Missing course ${id}`);
for(const document of lessonSnapshot.docs){
  const local=expected.get(document.id);if(!local){errors.push(`Unexpected lesson ${document.id}`);continue}
  const {id,courseId,status,version,updatedAt,updatedBy,canonicalChecksum,...remote}=document.data();void id;void courseId;void status;void version;void updatedAt;void updatedBy;void canonicalChecksum;
  if(hash(local)!==hash(remote))errors.push(`Content mismatch ${document.id}`);
  expected.delete(document.id);
}
for(const id of expected.keys())errors.push(`Missing lesson ${id}`);
const counts=metadataSnapshot.data()?.counts??{};
const result={passed:errors.length===0,courses:courseSnapshot.size,lessons:lessonSnapshot.size,screens:Number(counts.screens??0),images:Number(counts.images??0),videos:Number(counts.videos??0),metadataSource:metadataSnapshot.data()?.source??null,errors:errors.slice(0,50)};
if(courseSnapshot.size!==37||lessonSnapshot.size!==343||Number(counts.screens)!==8925||Number(counts.images)!==2549||Number(counts.videos)!==77){result.passed=false;result.errors.push("Metadata or collection counts differ from canonical baseline")}
console.log(JSON.stringify(result,null,2));if(!result.passed)process.exit(1);
