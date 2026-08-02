import { chromium } from "playwright";
import { applicationDefault,getApps,initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { mkdir,readFile,writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const root=process.cwd();const baseURL=process.env.QA_BASE_URL??"http://localhost:3013";
const referenceDir=join(root,"tests/visual/reference-v1");const outputDir=join(root,"output/playwright/visual-matrix");await mkdir(outputDir,{recursive:true});
const surfaces=[{id:"dashboard",url:"/dashboard"},{id:"courses",url:"/courses"},{id:"ai-tools",url:"/ai-tools"},{id:"games",url:"/games"},{id:"profile",url:"/profile"}];
const viewports={mobile:{width:393,height:852},desktop:{width:1440,height:900}};
const app=getApps()[0]??initializeApp({credential:applicationDefault()});const auth=getAuth(app);const db=getFirestore(app);const stamp=Date.now();const email=`coursiv.visual.qa.${stamp}@example.com`;const password=`Coursiv-Visual-${stamp}!`;const user=await auth.createUser({email,password,displayName:"HJ",emailVerified:true});
const state={version:2,courses:{"use-case-2":{completedLessonIds:["how-ai-fits-in-accounting","bookkeeping-automation"],lastLessonId:"tax-research-review",lastScreenId:null,updatedAt:"2026-07-22T12:00:00.000Z"}},activityDates:["2026-07-20","2026-07-21","2026-07-22"],challenges:{},gamePoints:0,completedGameIds:[],programAssessments:{},preferences:{language:"English",darkMode:false,soundEffects:true,pushNotifications:false,analyticsConsent:true,timezone:"Asia/Hong_Kong"},conversations:[]};
await db.collection("progress").doc(user.uid).collection("state").doc("learner").set(state);
for(const lessonId of ["how-ai-fits-in-accounting","bookkeeping-automation"])await db.collection("learningProgress").doc(user.uid).collection("lessons").doc(`use-case-2__${lessonId}`).set({userId:user.uid,courseId:"use-case-2",lessonId,completedAt:"2026-07-22T12:00:00.000Z",updatedAt:"2026-07-22T12:00:00.000Z",visitedScreenIds:[],resolvedScreenIds:[],skippedScreenIds:[]});
await db.collection("learningProgress").doc(user.uid).collection("lessons").doc("use-case-2__tax-research-review").set({userId:user.uid,courseId:"use-case-2",lessonId:"tax-research-review",completedAt:null,updatedAt:"2026-07-22T12:05:00.000Z",lastScreenId:null,visitedScreenIds:[],resolvedScreenIds:[],skippedScreenIds:[]});
const browser=await chromium.launch({headless:true});const results=[];
try{
  for(const [viewportName,viewport] of Object.entries(viewports)){
    const context=await browser.newContext({viewport,colorScheme:"light",reducedMotion:"reduce"});const page=await context.newPage();await page.clock.install({time:new Date("2026-07-22T12:00:00+08:00")});
    await page.goto(`${baseURL}/login`);await page.getByPlaceholder("you@example.com",{exact:true}).fill(email);await page.getByPlaceholder("At least 8 characters",{exact:true}).fill(password);await page.locator('form button[type="submit"]').click();await page.waitForURL(/\/dashboard/,{timeout:30_000});
    for(const surface of surfaces){
      const id=`${surface.id}-${viewportName}`;await page.goto(`${baseURL}${surface.url}`,{waitUntil:"domcontentloaded"});await page.locator("main").first().waitFor({state:"visible",timeout:20_000});await page.addStyleTag({content:"*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}"});await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(image=>image.complete?Promise.resolve():new Promise(resolve=>{image.addEventListener("load",resolve,{once:true});image.addEventListener("error",resolve,{once:true})})))});await page.waitForTimeout(250);
      const actualFile=join(outputDir,`${id}-actual.png`);const diffFile=join(outputDir,`${id}-diff.png`);const referenceFile=join(referenceDir,`${id}.png`);await page.screenshot({path:actualFile,animations:"disabled"});
      const reference=PNG.sync.read(await readFile(referenceFile));const actual=PNG.sync.read(await readFile(actualFile));if(reference.width!==actual.width||reference.height!==actual.height)throw new Error(`${id} viewport mismatch ${reference.width}x${reference.height}/${actual.width}x${actual.height}`);const diff=new PNG({width:reference.width,height:reference.height});const differentPixels=pixelmatch(reference.data,actual.data,diff.data,reference.width,reference.height,{threshold:.1,includeAA:false});await writeFile(diffFile,PNG.sync.write(diff));const ratio=differentPixels/(reference.width*reference.height);results.push({id,surface:surface.id,viewport:viewportName,differentPixels,diffPixelRatio:ratio,similarity:1-ratio,passed:ratio<=.01,referenceFile,actualFile,diffFile});console.log(`${id}: ${(100*(1-ratio)).toFixed(2)}%`);
    }
    await context.close();
  }
}finally{await browser.close();await db.recursiveDelete(db.collection("progress").doc(user.uid)).catch(()=>undefined);await db.recursiveDelete(db.collection("learningProgress").doc(user.uid)).catch(()=>undefined);await auth.deleteUser(user.uid).catch(()=>undefined)}
const summary={total:results.length,passed:results.filter(item=>item.passed).length,failed:results.filter(item=>!item.passed).length,minSimilarity:Math.min(...results.map(item=>item.similarity)),averageSimilarity:results.reduce((sum,item)=>sum+item.similarity,0)/results.length};await writeFile(join(outputDir,"report.json"),`${JSON.stringify({schemaVersion:1,generatedAt:new Date().toISOString(),referenceVersion:"reference-v1",acceptance:{maxDiffPixelRatio:.01},summary,results},null,2)}\n`);console.log(JSON.stringify(summary,null,2));if(summary.failed)process.exitCode=2;
