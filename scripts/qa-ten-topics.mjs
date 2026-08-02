import { chromium } from "playwright";
import { applicationDefault,getApps,initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { mkdir,readFile,writeFile } from "node:fs/promises";
import { join } from "node:path";

const baseURL=process.env.QA_BASE_URL??"http://localhost:3013";
const allSelected=[
  ["kling","kling-for-educators"],
  ["perplexity","report-writing-with-perplexity"],
  ["use-case-11","turn-objections-into-closed-deals"],
  ["use-case-16","make-meetings-actually-productive"],
  ["chatgpt-deep","plugins-building-your-personal-assistant"],
  ["claude-deep","research-reasoning-modes"],
  ["claude","create-with-artifacts"],
  ["gemini","work-with-large-amounts-of-data"],
  ["use-case-13","balance-workloads-and-stay-on-track"],
  ["omni","from-description-to-direction"],
];
const only=new Set((process.env.QA_ONLY??"").split(",").filter(Boolean));
const selected=only.size?allSelected.filter(([courseId,slug])=>only.has(`${courseId}/${slug}`)):allSelected;
const outputDir=join(process.cwd(),"output/playwright/ten-topics");
await mkdir(outputDir,{recursive:true});
const adminApp=getApps()[0]??initializeApp({credential:applicationDefault()});const auth=getAuth(adminApp);const db=getFirestore(adminApp);
const stamp=Date.now();const email=`coursiv.ten.qa.${stamp}@example.com`;const password=`Coursiv-Ten-${stamp}!`;const user=await auth.createUser({email,password,displayName:"Ten Topic QA",emailVerified:true});
const browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:393,height:852}});const page=await context.newPage();
const results=[];let topicErrors=[];let activeLesson=null;let progressErrors=[];let progressEvents=[];page.on("console",message=>{if(message.type()==="error")topicErrors.push(message.text())});page.on("pageerror",error=>topicErrors.push(error.message));
page.on("response",async response=>{if(response.url().includes("/api/learning/progress")){const event=`${response.status()} ${response.request().postData()??"GET"} ${await response.text().catch(()=>"")}`;progressEvents.push(event);if(!response.ok())progressErrors.push(event)}});

function courseFile(courseId){return join(process.cwd(),"content/coursiv/courses",`${courseId}.json`)}
async function loadTarget(courseId,slug){const course=JSON.parse(await readFile(courseFile(courseId),"utf8"));const lessons=course.units.flatMap(unit=>unit.lessons);const index=lessons.findIndex(lesson=>lesson.slug===slug);if(index<0)throw new Error(`Missing target ${courseId}/${slug}`);return{course,lesson:lessons[index],prior:lessons.slice(0,index)}}
async function seedPrior(courseId,lessons){const now=new Date().toISOString();for(const lesson of lessons)await db.collection("learningProgress").doc(user.uid).collection("lessons").doc(`${courseId}__${lesson.slug}`).set({userId:user.uid,courseId,lessonId:lesson.slug,completedAt:now,updatedAt:now,visitedScreenIds:[],resolvedScreenIds:[],skippedScreenIds:[]},{merge:true})}
function interactiveBlock(screen){return screen.blocks.find(block=>["single-choice","multi-choice","true-false","fill-in-blank","ordering-task","matching-pairs","prompt-fixer","survey","practice"].includes(block.type))}
async function clickNamed(scope,role,name){const target=scope.getByRole(role,{name,exact:true});await target.waitFor({state:"visible",timeout:15_000});const count=await target.count();if(count!==1)throw new Error(`${role} ${JSON.stringify(name)} resolved to ${count}`);await target.click()}
async function completeInteraction(scope,block){
  if(["single-choice","multi-choice","true-false"].includes(block.type)){
    const role=block.type==="multi-choice"?"checkbox":"radio";for(const option of block.options.filter(item=>item.isCorrect))await clickNamed(scope,role,option.label);await clickNamed(scope,"button","Submit");
  }else if(block.type==="fill-in-blank"){
    for(const token of block.correctTokens){const candidates=scope.locator(".canonical-tokens button").filter({hasText:token,visible:true});const count=await candidates.count();if(!count)throw new Error(`Missing fill token ${token}`);await candidates.first().click()}await clickNamed(scope,"button","Check");
  }else if(block.type==="ordering-task"){
    for(const item of block.correctItems){const candidate=scope.locator(".canonical-tokens button").filter({hasText:item,visible:true});if(await candidate.count()!==1)throw new Error(`Ordering item is not unique: ${item}`);await candidate.click()}await clickNamed(scope,"button","Check");
  }else if(block.type==="matching-pairs"){
    for(const pair of block.pairs){const left=scope.locator(".match-grid>div:first-child button").filter({hasText:pair.left,visible:true});if(await left.count()!==1)throw new Error(`Matching left is not unique: ${pair.left}`);await left.click();await clickNamed(scope,"button",pair.right)}await clickNamed(scope,"button","Check");
  }else if(block.type==="prompt-fixer"){
    const option=block.options.find(item=>item.isCorrect);if(!option)throw new Error("Prompt fixer has no correct option");await clickNamed(scope,"radio",option.label);await clickNamed(scope,"button","Submit");
  }else if(block.type==="survey"){
    await clickNamed(scope,"radio",block.options[0].label);await clickNamed(scope,"button","Continue");
  }else if(block.type==="practice")await clickNamed(scope,"button","I've completed this practice");
}
async function auditScreen(screen){
  await page.waitForFunction(id=>document.querySelector(".canonical-screen:last-child")?.getAttribute("data-screen-id")===id,screen.id,{timeout:20_000});
  const current=page.locator(`[data-screen-id="${screen.id}"]`);await current.waitFor({state:"visible",timeout:20_000});
  const geometry=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth}));if(geometry.scrollWidth>geometry.clientWidth+1)throw new Error(`Horizontal overflow ${geometry.scrollWidth}/${geometry.clientWidth}`);
  await page.waitForFunction(id=>{const element=document.querySelector(`[data-screen-id="${id}"]`);return element&&[...element.querySelectorAll("img")].every(image=>image.complete&&image.naturalWidth>0)},screen.id,{timeout:5_000}).catch(()=>undefined);
  const media=await current.evaluate(element=>({images:[...element.querySelectorAll("img")].map(image=>({src:image.currentSrc||image.src,ok:image.complete&&image.naturalWidth>0})),videos:[...element.querySelectorAll("video")].map(video=>({src:video.currentSrc||video.getAttribute("src"),ready:video.readyState}))}));
  if(media.images.some(image=>!image.ok))throw new Error(`Broken image on ${screen.id}`);if(media.videos.some(video=>!video.src))throw new Error(`Missing video source on ${screen.id}`);
  const block=interactiveBlock(screen);const optional=screen.interactionPolicy==="optional-practice";
  if(block){const scope=optional?page.getByRole("dialog"):current;if(optional)await scope.waitFor({state:"visible",timeout:15_000});await completeInteraction(scope,block);if(block.type!=="survey")await page.waitForTimeout(500);const alert=page.locator(".assistant-error:visible");if(await alert.count())throw new Error(`UI error: ${await alert.first().innerText()}`);if(progressErrors.length)throw new Error(`Progress API: ${progressErrors.at(-1)}`);if(optional){const continueButton=scope.getByRole("button",{name:"Continue",exact:true});await continueButton.waitFor({state:"visible",timeout:15_000});await continueButton.click();return}}
  const label=screen.order===activeLesson.screens.length-1?"Finish Lesson":"Continue";const footer=page.locator("main.canonical-lesson>footer");await clickNamed(footer,"button",label);
}

try{
  await page.goto(`${baseURL}/login`);await page.getByPlaceholder("you@example.com",{exact:true}).fill(email);await page.getByPlaceholder("At least 8 characters",{exact:true}).fill(password);await page.locator('form button[type="submit"]').click();await page.waitForURL(/\/dashboard/,{timeout:30_000});
  for(const [courseId,slug] of selected){
    const started=Date.now();topicErrors=[];progressErrors=[];progressEvents=[];const {lesson,prior}=await loadTarget(courseId,slug);activeLesson=lesson;await seedPrior(courseId,prior);
    const result={courseId,slug,title:lesson.title,screens:lesson.screens.length,interactions:lesson.screens.filter(screen=>screen.interactionPolicy!=="read").length,status:"passed",errors:[],durationMs:0};
    try{
      await page.goto(`${baseURL}/course/${courseId}/lesson/${slug}?mode=read`);await page.locator("main.canonical-lesson").waitFor({state:"visible",timeout:30_000});await page.screenshot({path:join(outputDir,`${courseId}__${slug}__start.png`)});
      for(const screen of lesson.screens){try{await auditScreen(screen)}catch(error){throw new Error(`Screen ${screen.order+1}/${lesson.screens.length} ${screen.id} (${screen.type}): ${error instanceof Error?error.message:String(error)}`)}}
      await page.waitForURL(new RegExp(`/course/${courseId}$`),{timeout:10_000}).catch(async()=>{const alert=page.locator(".assistant-error:visible");throw new Error(`${await alert.count()?`UI error: ${await alert.first().innerText()}`:"Finish navigation timeout"}; progress=${progressEvents.slice(-4).join(" || ")}`)});await page.screenshot({path:join(outputDir,`${courseId}__${slug}__complete.png`)});
      if(topicErrors.length)throw new Error(`Console errors: ${[...new Set(topicErrors)].join(" | ")}`);
    }catch(error){result.status="failed";result.errors.push(error instanceof Error?error.message:String(error));await page.screenshot({path:join(outputDir,`${courseId}__${slug}__failure.png`),fullPage:false}).catch(()=>undefined)}
    result.durationMs=Date.now()-started;results.push(result);console.log(JSON.stringify(result));
  }
}finally{
  await browser.close();for(const collection of ["progress","learningProgress","pushTokens"])await db.recursiveDelete(db.collection(collection).doc(user.uid)).catch(()=>undefined);for(const collection of ["supportTickets","certificates"]){const snapshot=await db.collection(collection).where("userId","==",user.uid).get();const batch=db.batch();for(const document of snapshot.docs)batch.delete(document.ref);if(!snapshot.empty)await batch.commit()}await auth.deleteUser(user.uid).catch(()=>undefined);
}
const report={schemaVersion:1,generatedAt:new Date().toISOString(),baseURL,viewport:{width:393,height:852},topics:results,summary:{total:results.length,passed:results.filter(item=>item.status==="passed").length,failed:results.filter(item=>item.status!=="passed").length,screens:results.reduce((sum,item)=>sum+item.screens,0),interactions:results.reduce((sum,item)=>sum+item.interactions,0)}};await writeFile(join(outputDir,"report.json"),`${JSON.stringify(report,null,2)}\n`);console.log(JSON.stringify(report.summary,null,2));if(report.summary.failed)process.exitCode=2;
