import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root=process.cwd();
const courseDir=join(root,"content/coursiv/courses");
const reportFile=join(root,"content/coursiv/reports/qa-full-corpus.json");
const errors=[];const seenLessons=new Set();const seenScreens=new Set();
const counts={courses:0,lessons:0,screens:0,images:0,videos:0,requiredInteractions:0,optionalPractices:0,unknown:0};
const blockTypes={};
const files=(await readdir(courseDir)).filter((file)=>file.endsWith(".json")).sort();

for(const file of files){
  const course=JSON.parse(await readFile(join(courseDir,file),"utf8"));counts.courses++;
  if(course.schemaVersion!==3)errors.push({file,message:`Expected schema v3, received ${course.schemaVersion}`});
  const mediaByLocal=new Map((course.media??[]).map((asset)=>[asset.localSrc,asset]));
  for(const unit of course.units??[])for(const lesson of unit.lessons??[]){
    counts.lessons++;const lessonKey=`${course.id}/${lesson.slug}`;
    if(seenLessons.has(lessonKey))errors.push({lesson:lessonKey,message:"Duplicate lesson slug"});seenLessons.add(lessonKey);
    if(!lesson.raw)errors.push({lesson:lessonKey,message:"Raw payload is missing"});
    if(!lesson.screens?.length)errors.push({lesson:lessonKey,message:"Lesson has no screens"});
    let expectedOrder=0;
    for(const screen of lesson.screens??[]){
      counts.screens++;const screenKey=`${lessonKey}/${screen.id}`;
      if(seenScreens.has(screenKey))errors.push({screen:screenKey,message:"Duplicate screen id"});seenScreens.add(screenKey);
      if(screen.order!==expectedOrder++)errors.push({screen:screenKey,message:"Screen order is not contiguous"});
      if(!["read","required-interaction","optional-practice"].includes(screen.interactionPolicy))errors.push({screen:screenKey,message:"Invalid interaction policy"});
      if(!["content","media","callout","knowledge-check","practice"].includes(screen.presentation))errors.push({screen:screenKey,message:"Invalid presentation"});
      if(screen.interactionPolicy==="required-interaction")counts.requiredInteractions++;
      if(screen.interactionPolicy==="optional-practice")counts.optionalPractices++;
      for(const block of screen.blocks??[]){
        blockTypes[block.type]=(blockTypes[block.type]??0)+1;
        if(block.type==="unknown"){counts.unknown++;errors.push({screen:screenKey,message:"Unknown block"})}
        if(block.type==="image"){counts.images++;validateMedia(block,screenKey,mediaByLocal)}
        if(block.type==="video"){counts.videos++;if(!block.src)errors.push({screen:screenKey,message:"Video source is missing"})}
        if(["single-choice","multi-choice","true-false"].includes(block.type)){
          if(!block.options?.length||!block.options.some((option)=>option.isCorrect))errors.push({screen:screenKey,message:`${block.type} is not gradeable`});
        }
        if(block.type==="fill-in-blank"){
          if(!block.correctTokens?.length)errors.push({screen:screenKey,message:"Fill-in-blank answer is missing"});
          if(block.placeholders?.length!==block.correctTokens?.length)errors.push({screen:screenKey,message:`Fill-in-blank placeholder/answer mismatch: ${block.placeholders?.length??0}/${block.correctTokens?.length??0}`});
          if(block.tokens?.length<(block.correctTokens?.length??0))errors.push({screen:screenKey,message:"Fill-in-blank token bank is incomplete"});
        }
        if(block.type==="ordering-task"&&!block.correctItems?.length)errors.push({screen:screenKey,message:"Ordering answer is missing"});
        if(block.type==="matching-pairs"&&!block.pairs?.length)errors.push({screen:screenKey,message:"Matching pairs are missing"});
        if(block.type==="prompt-fixer"&&!block.options?.some((option)=>option.isCorrect))errors.push({screen:screenKey,message:"Prompt fixer answer is missing"});
      }
    }
  }
}

function validateMedia(block,screen,mediaByLocal){
  const localSrc=block.localSrc;
  if(localSrc?.startsWith("/images/courses/")){
    const path=join(root,"public",localSrc);if(!existsSync(path))errors.push({screen,message:`Image file is missing: ${localSrc}`});
    return;
  }
  if(!block.src?.startsWith("http"))errors.push({screen,message:"Original image URL is missing"});
  if(!localSrc?.startsWith("/coursiv-media/")){errors.push({screen,message:`Image is not localized: ${block.src??"missing"}`});return}
  const path=join(root,"public",localSrc);if(!existsSync(path)){errors.push({screen,message:`Image file is missing: ${localSrc}`});return}
  const asset=mediaByLocal.get(localSrc);if(!asset)errors.push({screen,message:`Image is absent from course media index: ${localSrc}`});
}

const expected={courses:43,lessons:412,screens:9885,images:2615,videos:84};
for(const [key,value] of Object.entries(expected))if(counts[key]!==value)errors.push({message:`${key} drift: expected ${value}, received ${counts[key]}`});
const report={schemaVersion:1,generatedAt:new Date().toISOString(),expected,counts,blockTypes:Object.fromEntries(Object.entries(blockTypes).sort()),errors,passed:errors.length===0};
await mkdir(join(root,"content/coursiv/reports"),{recursive:true});await writeFile(reportFile,`${JSON.stringify(report,null,2)}\n`);
console.log(JSON.stringify({passed:report.passed,...counts,errors:errors.length,report:reportFile},null,2));
if(errors.length)process.exitCode=2;
