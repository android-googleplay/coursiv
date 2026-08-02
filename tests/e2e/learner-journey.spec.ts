import { expect, test } from "@playwright/test";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CoursivCourse } from "../../lib/coursiv-content";

const suffix=randomUUID().slice(0,8);
const email=`lumora.ui.e2e.${suffix}@example.com`;
const password=`Lumora-${randomUUID()}!`;
const adminApp=getApps()[0]??initializeApp({credential:applicationDefault()});
const adminAuth=getAuth(adminApp);
const adminDb=getFirestore(adminApp);
test.setTimeout(300_000);
const claudeCourse=JSON.parse(readFileSync(join(process.cwd(),"content/coursiv/courses/claude.json"),"utf8")) as CoursivCourse;
const meetClaude=claudeCourse.units.flatMap((unit)=>unit.lessons).find((lesson)=>lesson.slug==="meet-claude");
if(!meetClaude)throw new Error("Canonical Claude course is missing meet-claude");
const claudeLessonCount=claudeCourse.units.reduce((total,unit)=>total+unit.lessons.length,0);

test.afterAll(async()=>{
  const user=await adminAuth.getUserByEmail(email).catch(()=>null);if(!user)return;
  for(const collection of ["progress","learningProgress","pushTokens"])await adminDb.recursiveDelete(adminDb.collection(collection).doc(user.uid)).catch(()=>undefined);
  for(const collection of ["supportTickets","certificates"]){const snapshot=await adminDb.collection(collection).where("userId","==",user.uid).get();const batch=adminDb.batch();for(const document of snapshot.docs)batch.delete(document.ref);if(!snapshot.empty)await batch.commit();}
  await adminAuth.deleteUser(user.uid).catch(()=>undefined);
});

test("@golden signup, onboarding, lesson, practice skip/complete, cross-device resume, streak, settings and logout guard",async({page,browser})=>{
  await page.goto("/login");
  await page.getByRole("button",{name:"Create account",exact:true}).click();
  await page.getByPlaceholder("Your name",{exact:true}).fill("UI E2E Learner");
  await page.getByPlaceholder("you@example.com",{exact:true}).fill(email);
  await page.getByPlaceholder("At least 8 characters",{exact:true}).fill(password);
  await page.locator("form button[type=submit]").click();

  await expect(page).toHaveURL(/\/onboarding/,{timeout:60_000});
  await expect(page.getByRole("heading",{name:"Hello! Before we dive in, let's take a closer look at your learning path"})).toBeVisible();
  await page.getByRole("button",{name:"Get Started",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Welcome to your AI Program",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"I'm ready",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Every tool you master earns you a certificate",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Continue",exact:true}).click();
  await expect(page.getByRole("heading",{name:"How it works — 3 simple steps",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Continue",exact:true}).click();
  await expect(page.getByRole("heading",{name:"One lesson a day is all it takes",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Continue",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Which program do you want to start first?",exact:true})).toBeVisible();
  await page.getByRole("button").filter({hasText:"AI Mastery Certificate Program"}).click();
  await expect(page.getByRole("heading",{name:"You're all set",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Continue",exact:true}).click();
  await expect(page).toHaveURL(/\/certificate-programs\/ai-mastery/);

  await page.goto("/course/ai-mastery/lesson/discovering-modes?mode=read");
  await expect(page.getByRole("heading",{name:"Endless Possibilities With ChatGPT",exact:true})).toBeVisible();
  const remoteScreenSaved=page.waitForResponse(response=>response.url().endsWith("/api/learning/progress")&&response.request().postData()?.includes('"screenId":"first-challenge"')===true&&response.ok(),{timeout:20_000});
  await page.getByRole("button",{name:"Continue",exact:true}).click();
  await remoteScreenSaved;
  await expect(page.getByRole("heading",{name:"Your First ChatGPT Challenge",exact:true})).toBeVisible();
  const secondContext=await browser.newContext({viewport:{width:430,height:932}});const secondPage=await secondContext.newPage();
  await secondPage.goto("/login?next=%2Fcourse%2Fai-mastery%2Flesson%2Fdiscovering-modes%3Fmode%3Dread");
  await secondPage.getByPlaceholder("you@example.com",{exact:true}).fill(email);await secondPage.getByPlaceholder("At least 8 characters",{exact:true}).fill(password);await secondPage.locator("form button[type=submit]").click();
  await expect(secondPage).toHaveURL(/\/course\/ai-mastery\/lesson\/discovering-modes\?mode=read/,{timeout:60_000});
  await expect(secondPage.getByRole("heading",{name:"Your First ChatGPT Challenge",exact:true})).toBeVisible();
  await secondContext.close();

  await page.goto("/course/claude");
  await page.getByRole("button",{name:"Start Meet Claude",exact:true}).click();
  await page.getByRole("dialog").getByRole("button",{name:"Read",exact:true}).click();
  await expect(page).toHaveURL(/\/course\/claude\/lesson\/meet-claude/);
  const lessonSection=page.locator("main.canonical-lesson > section");
  const lessonFooter=page.locator("main.canonical-lesson > footer");
  let completedOptionalPractice=false;
  for(const [screenIndex,screen] of meetClaude.screens.entries()){
    const currentScreen=lessonSection.locator(`[data-screen-id="${screen.id}"]`);
    const heading=screen.blocks.find((item)=>item.type==="heading");if(heading?.type==="heading")await expect(currentScreen.getByRole("heading",{name:heading.text,exact:true})).toBeVisible();
    const optionalPractice=screen.interactionPolicy==="optional-practice";
    if(optionalPractice&&!completedOptionalPractice)completedOptionalPractice=true;
    if(optionalPractice&&completedOptionalPractice&&screenIndex!==meetClaude.screens.findIndex((item)=>item.interactionPolicy==="optional-practice")){
      const skipped=page.waitForResponse((response)=>response.url().endsWith("/api/learning/progress")&&response.ok()&&(response.request().postData()??"").includes('"outcome":"skipped"'),{timeout:30_000});
      await page.getByRole("dialog").getByRole("button",{name:"Close practice",exact:true}).click();
      await lessonFooter.getByRole("button",{name:"Skip practice",exact:true}).click();await skipped;continue;
    }
    const interactionScope=optionalPractice?page.getByRole("dialog"):currentScreen;
    const block=screen.blocks.find((item)=>["single-choice","multi-choice","true-false","fill-in-blank","ordering-task","matching-pairs","prompt-fixer","survey","practice"].includes(item.type));
    if(block?.type==="single-choice"||block?.type==="multi-choice"||block?.type==="true-false"){
      const role=block.type==="multi-choice"?"checkbox":"radio";
      for(const option of block.options.filter((item)=>item.isCorrect))await interactionScope.getByRole(role,{name:option.label,exact:true}).click();
      await interactionScope.getByRole("button",{name:"Submit",exact:true}).click();
      await expect(interactionScope.getByText("Correct answer",{exact:true})).toBeVisible();
    }else if(block?.type==="fill-in-blank"){
      for(const token of block.correctTokens)await interactionScope.locator(".canonical-tokens button").filter({hasText:token}).filter({visible:true}).first().click();
      await interactionScope.getByRole("button",{name:"Check",exact:true}).click();
      await expect(interactionScope.getByText("Correct answer",{exact:true})).toBeVisible();
    }else if(block?.type==="ordering-task"){
      for(const item of block.correctItems)await lessonSection.locator(".canonical-tokens button").filter({hasText:item}).click();
      await lessonSection.getByRole("button",{name:"Check",exact:true}).click();
    }else if(block?.type==="matching-pairs"){
      for(const pair of block.pairs){await lessonSection.getByRole("button",{name:new RegExp(`^${pair.left}`)}).click();await lessonSection.getByRole("button",{name:pair.right,exact:true}).click()}await lessonSection.getByRole("button",{name:"Check",exact:true}).click();
    }else if(block?.type==="prompt-fixer"){
      const option=block.options.find((item)=>item.isCorrect);if(option)await lessonSection.getByRole("radio",{name:option.label,exact:true}).click();await lessonSection.getByRole("button",{name:"Submit",exact:true}).click();
    }else if(block?.type==="survey"){
      await lessonSection.getByRole("radio").first().click();await lessonSection.getByRole("button",{name:"Continue",exact:true}).click();
    }else if(block?.type==="practice")await lessonSection.getByRole("button",{name:"I've completed this practice",exact:true}).click();
    const nextScreen=meetClaude.screens[screenIndex+1];
    const progressSaved=page.waitForResponse((response)=>{
      if(!response.url().endsWith("/api/learning/progress")||!response.ok())return false;
      const body=response.request().postData()??"";
      return nextScreen?body.includes(`"screenId":"${nextScreen.id}"`):body.includes('"action":"complete"');
    },{timeout:30_000});
    const advanceScope=optionalPractice?page.getByRole("dialog"):lessonFooter;
    await advanceScope.getByRole("button",{name:screenIndex===meetClaude.screens.length-1?"Finish Lesson":"Continue",exact:true}).click();
    await progressSaved;
  }
  await expect(page).toHaveURL(/\/course\/claude$/,{timeout:60_000});
  await expect(page.getByText(`1/${claudeLessonCount} lessons complete`,{exact:true})).toBeVisible();

  await page.goto("/dashboard");
  await expect(page.getByText(`1/${claudeLessonCount} lessons completed`,{exact:true})).toBeVisible();
  await expect(page.getByLabel("1 day learning streak",{exact:true})).toBeVisible();
  await page.goto("/profile/settings");
  await expect(page.getByRole("button",{name:"Payment History Not connected",exact:true})).toBeDisabled();
  await expect(page).toHaveScreenshot("settings-mobile.png",{fullPage:true,animations:"disabled"});

  await page.goto("/profile");
  await page.getByRole("button",{name:"Log out",exact:true}).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/login\?next=%2Fprofile/);
});
