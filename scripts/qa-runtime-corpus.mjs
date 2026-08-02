import { chromium } from "playwright";
import { applicationDefault,getApps,initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { mkdir,readFile,readdir,writeFile } from "node:fs/promises";
import { join } from "node:path";

const root=process.cwd();
const baseURL=process.env.QA_BASE_URL??"http://localhost:3013";
const workers=Math.max(1,Number(process.env.QA_WORKERS??4));
const outputDir=join(root,"output/playwright/full-corpus");
const checkpointFile=join(outputDir,"checkpoint.json");
const reportFile=join(outputDir,"report.json");
const resume=process.env.QA_RESUME!=="0";
await mkdir(outputDir,{recursive:true});

const courses=[];
for(const file of (await readdir(join(root,"content/coursiv/courses"))).filter(file=>file.endsWith(".json")).sort())courses.push(JSON.parse(await readFile(join(root,"content/coursiv/courses",file),"utf8")));
const allTargets=courses.flatMap(course=>course.units.flatMap(unit=>unit.lessons.map(lesson=>({courseId:course.id,courseTitle:course.title,lesson}))));
const limit=Math.max(0,Number(process.env.QA_LIMIT??0));
const targets=limit?allTargets.slice(0,limit):allTargets;
const previous=resume?await readFile(checkpointFile,"utf8").then(JSON.parse).catch(()=>({results:[]})):{results:[]};
const results=new Map((previous.results??[]).filter(item=>item.status==="passed").map(item=>[`${item.courseId}/${item.slug}`,item]));
const pending=targets.filter(({courseId,lesson})=>!results.has(`${courseId}/${lesson.slug}`));

const adminApp=getApps()[0]??initializeApp({credential:applicationDefault()});
const auth=getAuth(adminApp);const stamp=Date.now();const email=`coursiv.corpus.qa.${stamp}@example.com`;const password=`Coursiv-Corpus-${stamp}!`;
const user=await auth.createUser({email,password,displayName:"Corpus QA",emailVerified:true});
const browser=await chromium.launch({headless:true});let writing=Promise.resolve();
const externalWarnings=[];

function interactiveBlock(screen){return screen.blocks.find(block=>["single-choice","multi-choice","true-false","fill-in-blank","ordering-task","matching-pairs","prompt-fixer","survey","practice"].includes(block.type))}
async function clickNamed(scope,role,name){const target=scope.getByRole(role,{name,exact:true});await target.waitFor({state:"visible",timeout:10_000});if(await target.count()!==1)throw new Error(`${role} ${JSON.stringify(name)} is not unique`);await target.click()}
async function clickToken(scope,value){const enabled=scope.locator(".canonical-tokens button:not(:disabled)").filter({hasText:new RegExp(`^${String(value).replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}$`)});if(await enabled.count()<1)throw new Error(`Missing enabled token ${JSON.stringify(value)}`);await enabled.first().click()}
async function completeInteraction(scope,block){
  if(["single-choice","multi-choice","true-false"].includes(block.type)){const role=block.type==="multi-choice"?"checkbox":"radio";const options=scope.getByRole(role);for(const [index,option] of block.options.entries())if(option.isCorrect)await options.nth(index).click();await scope.locator("button.canonical-submit").click()}
  else if(block.type==="fill-in-blank"){for(const token of block.correctTokens)await clickToken(scope,token);await scope.locator("button.canonical-submit").click()}
  else if(block.type==="ordering-task"){for(const item of block.correctItems)await clickToken(scope,item);await scope.locator("button.canonical-submit").click()}
  else if(block.type==="matching-pairs"){for(const pair of block.pairs){await scope.locator(".match-grid>div:first-child button").filter({hasText:pair.left,visible:true}).first().click();await clickNamed(scope,"button",pair.right)}await clickNamed(scope,"button","Check")}
  else if(block.type==="prompt-fixer"){const index=block.options.findIndex(item=>item.isCorrect);if(index<0)throw new Error("Prompt fixer has no answer");await scope.getByRole("radio").nth(index).click();await scope.locator("button.canonical-submit").click()}
  else if(block.type==="survey"){await clickNamed(scope,"radio",block.options[0].label);await clickNamed(scope,"button","Continue")}
  else if(block.type==="practice")await clickNamed(scope,"button","I've completed this practice");
}
async function saveCheckpoint(){const payload={schemaVersion:1,generatedAt:new Date().toISOString(),total:targets.length,results:[...results.values()]};writing=writing.then(()=>writeFile(checkpointFile,`${JSON.stringify(payload,null,2)}\n`));await writing}
async function configureRoutes(context){
  await context.route("**/api/learning/progress**",async route=>{const request=route.request();if(request.method()==="GET")return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({visitedScreenIds:[],resolvedScreenIds:[],skippedScreenIds:[],lastScreenId:null,completedAt:null})});const body=request.postDataJSON();return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(body.action==="complete"?{completed:true,completedAt:new Date().toISOString(),completedLessonIds:[body.lessonId]}:{completed:false,visitedScreenIds:[body.screenId],resolvedScreenIds:body.response?.outcome==="answered"?[body.screenId]:[],skippedScreenIds:body.response?.outcome==="skipped"?[body.screenId]:[],...(body.response?.outcome==="answered"?{correct:true}:{})})})});
  await context.route("**/api/certificates/issue",route=>route.fulfill({status:200,contentType:"application/json",body:'{"issued":[]}' }));
}
async function auditLesson(page,target,consoleErrors){
  const {courseId,lesson}=target;const started=Date.now();
  await page.goto(`${baseURL}/course/${courseId}/lesson/${lesson.slug}?mode=read`,{waitUntil:"domcontentloaded"});await page.locator("main.canonical-lesson").waitFor({state:"visible",timeout:20_000});
  for(const screen of lesson.screens){
    await page.waitForFunction(id=>document.querySelector(".canonical-screen:last-child")?.getAttribute("data-screen-id")===id,screen.id,{timeout:15_000});
    const current=page.locator(`[data-screen-id="${screen.id}"]`);const geometry=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth}));if(geometry.scrollWidth>geometry.clientWidth+1)throw new Error(`Screen ${screen.order+1}: horizontal overflow ${geometry.scrollWidth}/${geometry.clientWidth}`);
    await page.waitForFunction(id=>{const element=document.querySelector(`[data-screen-id="${id}"]`);return element&&[...element.querySelectorAll("img")].every(image=>image.complete&&image.naturalWidth>0)},screen.id,{timeout:5_000}).catch(()=>undefined);
    const media=await current.evaluate(element=>({images:[...element.querySelectorAll("img")].map(image=>({src:image.currentSrc||image.src,ok:image.complete&&image.naturalWidth>0})),videos:[...element.querySelectorAll("video")].map(video=>video.currentSrc||video.getAttribute("src"))}));
    if(media.images.some(image=>!image.ok))throw new Error(`Screen ${screen.order+1}: broken image`);if(media.videos.some(src=>!src))throw new Error(`Screen ${screen.order+1}: missing video source`);
    const block=interactiveBlock(screen);const optional=screen.interactionPolicy==="optional-practice";
    if(block){const scope=optional?page.getByRole("dialog"):current;if(optional)await scope.waitFor({state:"visible",timeout:10_000});await completeInteraction(scope,block);const alert=page.locator(".assistant-error:visible");if(await alert.count())throw new Error(`Screen ${screen.order+1}: ${await alert.first().innerText()}`);if(optional){await clickNamed(scope,"button","Continue");continue}}
    const footer=page.locator("main.canonical-lesson>footer");await clickNamed(footer,"button",screen.order===lesson.screens.length-1?"Finish Lesson":"Continue");
  }
  await page.waitForURL(new RegExp(`/course/${courseId}$`),{timeout:15_000});
  if(consoleErrors.length)throw new Error(`Console: ${[...new Set(consoleErrors)].join(" | ")}`);
  return{courseId,slug:lesson.slug,title:lesson.title,screens:lesson.screens.length,interactions:lesson.screens.filter(screen=>screen.interactionPolicy!=="read").length,status:"passed",durationMs:Date.now()-started};
}
async function runWorker(index,assigned){
  const context=await browser.newContext({viewport:{width:393,height:852}});await configureRoutes(context);const page=await context.newPage();let consoleErrors=[];page.on("console",message=>{if(message.type()!=="error")return;const value=message.text();if(value.includes("@firebase/firestore")&&value.includes("Could not reach Cloud Firestore backend")){externalWarnings.push(value);return}consoleErrors.push(value)});page.on("pageerror",error=>consoleErrors.push(error.message));
  await page.goto(`${baseURL}/login`);await page.getByPlaceholder("you@example.com",{exact:true}).fill(email);await page.getByPlaceholder("At least 8 characters",{exact:true}).fill(password);await page.locator('form button[type="submit"]').click();await page.waitForURL(/\/dashboard/,{timeout:30_000});
  for(const target of assigned){consoleErrors=[];const key=`${target.courseId}/${target.lesson.slug}`;try{const result=await auditLesson(page,target,consoleErrors);results.set(key,result);console.log(`[${index}] PASS ${key} (${result.screens})`)}catch(error){const result={courseId:target.courseId,slug:target.lesson.slug,title:target.lesson.title,screens:target.lesson.screens.length,interactions:target.lesson.screens.filter(screen=>screen.interactionPolicy!=="read").length,status:"failed",error:error instanceof Error?error.message:String(error)};results.set(key,result);await page.screenshot({path:join(outputDir,`${target.courseId}__${target.lesson.slug}__failure.png`),fullPage:false}).catch(()=>undefined);console.log(`[${index}] FAIL ${key}: ${result.error}`)}await saveCheckpoint()}
  await context.close();
}

try{const shards=Array.from({length:workers},()=>[]);pending.forEach((target,index)=>shards[index%workers].push(target));await Promise.all(shards.map((assigned,index)=>runWorker(index+1,assigned)))}finally{await browser.close();await auth.deleteUser(user.uid).catch(()=>undefined)}
const ordered=targets.map(({courseId,lesson})=>results.get(`${courseId}/${lesson.slug}`)).filter(Boolean);const summary={courses:new Set(ordered.map(item=>item.courseId)).size,total:targets.length,completed:ordered.length,passed:ordered.filter(item=>item.status==="passed").length,failed:ordered.filter(item=>item.status==="failed").length,screens:ordered.filter(item=>item.status==="passed").reduce((sum,item)=>sum+item.screens,0),interactions:ordered.filter(item=>item.status==="passed").reduce((sum,item)=>sum+item.interactions,0),externalWarnings:externalWarnings.length};await writeFile(reportFile,`${JSON.stringify({schemaVersion:1,generatedAt:new Date().toISOString(),baseURL,workers,summary,externalWarnings:[...new Set(externalWarnings)],results:ordered},null,2)}\n`);console.log(JSON.stringify(summary,null,2));if(summary.failed||summary.completed!==summary.total)process.exitCode=2;
