import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  allCourseLessons, certificatePrograms, challengeTasks, challenges, getCourse,
  promptLibrary, toolCourses, useCases,
} from "../lib/member-data.ts";

const CONTENT_VERSION="2026-07-21.1";
const app=getApps()[0]??initializeApp({credential:applicationDefault()});
const database=getFirestore(app);
const now=new Date().toISOString();
const counts={programs:certificatePrograms.length,courses:toolCourses.length,lessons:toolCourses.reduce((total,item)=>total+allCourseLessons(getCourse(item.id)).length,0),challenges:challenges.length,prompts:promptLibrary.length,useCases:useCases.length};

async function commitDocuments(collection,documents){
  for(let start=0;start<documents.length;start+=400){
    const batch=database.batch();
    for(const document of documents.slice(start,start+400))batch.set(database.collection(collection).doc(document.id),document.data,{merge:true});
    await batch.commit();
  }
}

await commitDocuments("programs",certificatePrograms.map((program)=>({id:program.id,data:{...program,status:"published",contentVersion:CONTENT_VERSION,updatedAt:now}})));
await commitDocuments("courses",toolCourses.map((item)=>{const course=getCourse(item.id);return{id:item.id,data:{...course,categories:item.categories,status:"published",contentVersion:CONTENT_VERSION,updatedAt:now}}}));
await commitDocuments("lessons",toolCourses.flatMap((item)=>{const course=getCourse(item.id);return allCourseLessons(course).map((lesson,index)=>({id:`${course.id}__${lesson.id}`,data:{...lesson,courseId:course.id,order:index,status:"published",contentVersion:CONTENT_VERSION,updatedAt:now}}))}));
await commitDocuments("challenges",challenges.map((challenge)=>({id:challenge.id,data:{...challenge,tasks:challengeTasks(challenge),status:"published",contentVersion:CONTENT_VERSION,updatedAt:now}})));
await commitDocuments("prompts",promptLibrary.map((prompt)=>({id:prompt.id,data:{...prompt,status:"published",contentVersion:CONTENT_VERSION,updatedAt:now}})));
await commitDocuments("useCases",useCases.map((useCase)=>({id:useCase.id,data:{...useCase,status:"published",contentVersion:CONTENT_VERSION,updatedAt:now}})));
await database.collection("contentMetadata").doc("learner-app").set({contentVersion:CONTENT_VERSION,counts,updatedAt:now},{merge:true});

const verified={};
for(const [collection,expected] of Object.entries(counts)){
  const collectionName=collection==="useCases"?"useCases":collection;
  const snapshot=await database.collection(collectionName).where("contentVersion","==",CONTENT_VERSION).count().get();
  verified[collection]=snapshot.data().count;
  if(verified[collection]!==expected)throw new Error(`${collection} sync mismatch: expected ${expected}, found ${verified[collection]}`);
}
console.log(JSON.stringify({ok:true,contentVersion:CONTENT_VERSION,counts:verified}));
process.exit(0);
