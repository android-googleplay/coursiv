import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const commit=process.argv.includes("--commit");
const root=process.cwd();
const files=(await readdir(join(root,"content/coursiv/courses"))).filter((file)=>file.endsWith(".json")).sort();
const canonical=await Promise.all(files.map(async(file)=>JSON.parse(await readFile(join(root,"content/coursiv/courses",file),"utf8"))));
const preferredCourseOrder={
  tool:["claude","claude-excel","claude-deep","midjourney","lovable","gemini","google-sheet-with-ai","google-sheet-with-ai-shorts","google-slide-with-ai","google-slide-with-ai-short","chatgpt","jasper","chatgpt-deep","stable-diffusion","deepseek","omni","perplexity","kling","canva-ai","communicating-ai","claude-code"],
  "use-case":Array.from({length:20},(_,index)=>`use-case-${index+1}`),
};
const updates=canonical.map((course)=>{
  const position=preferredCourseOrder[course.kind].indexOf(course.id);
  return{id:course.id,data:{
    displayOrder:position<0?preferredCourseOrder[course.kind].length:position,
    unitSummaries:course.units.map((unit)=>({sourceId:unit.sourceId,title:unit.title??null,order:unit.order})),
    lessonSummaries:course.units.flatMap((unit)=>unit.lessons).map((lesson)=>({id:`${course.id}__${lesson.slug}`,slug:lesson.slug,sourceId:lesson.sourceId,sourceUnitId:lesson.sourceUnitId,title:lesson.title,order:lesson.order,screenIds:lesson.screens.map((screen)=>screen.id),hasAudio:lesson.hasAudio,version:1})),
    imageAlt:course.title,
  }};
});
if(!commit){
  console.log(JSON.stringify({mode:"dry-run",courses:updates.length,fields:["displayOrder","unitSummaries","lessonSummaries","imageAlt","status","version","publishedAt","archivedAt"]},null,2));
  process.exit(0);
}
const credential=process.env.FIREBASE_PROJECT_ID&&process.env.FIREBASE_CLIENT_EMAIL&&process.env.FIREBASE_PRIVATE_KEY
  ?cert({projectId:process.env.FIREBASE_PROJECT_ID,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey:process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g,"\n")})
  :applicationDefault();
const app=getApps()[0]??initializeApp({credential});
const database=getFirestore(app);
const snapshot=await database.collection("courses").get();
if(snapshot.size!==canonical.length)throw new Error(`Expected ${canonical.length} courses before migration, found ${snapshot.size}`);
const migrationId=`course-metadata-v1-${new Date().toISOString().replace(/[:.]/g,"-")}`;
const backup=database.collection("migrationBackups").doc(migrationId);
await backup.set({id:migrationId,type:"course-metadata-v1",status:"backing-up",startedAt:new Date().toISOString(),courses:snapshot.size});
for(let start=0;start<snapshot.docs.length;start+=100){
  const batch=database.batch();
  for(const document of snapshot.docs.slice(start,start+100))batch.set(backup.collection("courses").doc(document.id),{id:document.id,...document.data()});
  await batch.commit();
}
const now=new Date().toISOString();
for(let start=0;start<updates.length;start+=100){
  const batch=database.batch();
  for(const update of updates.slice(start,start+100)){
    const existing=snapshot.docs.find((document)=>document.id===update.id)?.data();
    if(!existing)throw new Error(`Course ${update.id} is missing`);
    batch.set(database.collection("courses").doc(update.id),{
      ...update.data,
      status:existing.status??"published",
      version:existing.version??1,
      publishedAt:existing.publishedAt??new Date(0).toISOString(),
      archivedAt:existing.archivedAt??null,
      updatedAt:existing.updatedAt??new Date(0).toISOString(),
      updatedBy:existing.updatedBy??"canonical-import",
    },{merge:true});
  }
  await batch.commit();
}
await database.collection("contentMetadata").doc("learner-app").set({courseMetadataSchemaVersion:1,contentVersion:now,updatedAt:now},{merge:true});
const verified=await database.collection("courses").get();
const invalid=verified.docs.filter((document)=>{
  const data=document.data();
  return !Number.isInteger(data.displayOrder)||!Array.isArray(data.unitSummaries)||!data.unitSummaries.length||!Array.isArray(data.lessonSummaries)||data.lessonSummaries.length!==data.lessonCount||!["draft","published","archived"].includes(data.status)||!Number.isInteger(data.version);
});
if(verified.size!==canonical.length||invalid.length){
  await backup.set({status:"verification-failed",invalid:invalid.map((document)=>document.id),failedAt:new Date().toISOString()},{merge:true});
  throw new Error(`Course metadata verification failed for ${invalid.length} courses`);
}
await backup.set({status:"complete",verified:verified.size,completedAt:new Date().toISOString()},{merge:true});
console.log(JSON.stringify({mode:"committed",migrationId,courses:verified.size,invalid:0},null,2));
