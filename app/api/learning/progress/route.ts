import { NextResponse } from "next/server";
import { learningLessonDocumentId } from "@/lib/learning-requirements";
import { localDateKey, mergeLearnerState, resetLessonProgress, type LearnerState } from "@/lib/learner-state";
import { getAdminDb, isFirebaseAdminConfigured, verifyBearerToken } from "@/lib/platform/firebase-admin";
import { readCoursivCourse, readCoursivLesson } from "@/lib/coursiv-content.server";
import { gradeCoursivScreenResponse, requiredInteractionBlockIds, screenAllowsSkip, screenRequiresResolution, type CoursivLessonScreen } from "@/lib/coursiv-content";
import { refreshAdminUserSummary } from "@/lib/platform/admin-user-projection";
import { lessonScreens } from "@/lib/lesson-data";

export const runtime = "nodejs";

class LearningProgressError extends Error {
  constructor(message: string, readonly status = 409) { super(message); }
}

const LEGACY_CHATGPT_LESSON_ID="discovering-modes";
const CANONICAL_CHATGPT_LESSON_ID="discovering-modes-features";

function runtimeLessonId(courseId:string,lessonId:string){
  return courseId==="chatgpt"&&lessonId===LEGACY_CHATGPT_LESSON_ID?CANONICAL_CHATGPT_LESSON_ID:lessonId;
}

function runtimeScreens(courseId:string,lessonId:string,canonicalScreens:CoursivLessonScreen[]){
  if(courseId!=="chatgpt"||lessonId!==LEGACY_CHATGPT_LESSON_ID)return canonicalScreens;
  return lessonScreens.map((screen,order)=>({
    id:screen.id,
    sourcePageId:`legacy-${screen.id}`,
    order,
    type:"content",
    presentation:"content" as const,
    interactionPolicy:"read" as const,
    blocks:[],
  }));
}

export async function POST(request: Request) {
  if (!isFirebaseAdminConfigured()) return NextResponse.json({ error: "Learning sync is not configured" }, { status: 503 });
  const user = await verifyBearerToken(request);
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { action?: "screen" | "complete"; courseId?: string; lessonId?: string; screenId?: string; response?:{outcome?:"answered"|"skipped";blockId?:string;values?:unknown[]} } | null;
  if (!body?.action || !body.courseId || !body.lessonId) return NextResponse.json({ error: "Missing learning progress fields" }, { status: 400 });
  const sourceLessonId=runtimeLessonId(body.courseId,body.lessonId);
  const canonical=await readCoursivLesson(body.courseId,sourceLessonId);
  if(!canonical)return NextResponse.json({ error: "Unknown course or lesson" }, { status: 404 });
  const canonicalScreens=runtimeScreens(body.courseId,body.lessonId,canonical.lesson.screens);
  const requirement={course:canonical.course,lesson:canonical.lesson,screenIds:canonicalScreens.map((screen)=>screen.id)};
  if (body.action === "screen" && (!body.screenId || !requirement.screenIds.includes(body.screenId))) return NextResponse.json({ error: "Unknown lesson screen" }, { status: 400 });
  const requiredResolutionIds=canonicalScreens.filter((screen)=>screenRequiresResolution(screen)&&requiredInteractionBlockIds(screen).length>0).map((screen)=>screen.id);
  const optionalPracticeIds=canonicalScreens.filter(screenAllowsSkip).map((screen)=>screen.id);

  const database = getAdminDb();
  const lessonReference = database.collection("learningProgress").doc(user.uid).collection("lessons").doc(learningLessonDocumentId(body.courseId, body.lessonId));
  const courseLessons = requirement.course.units.flatMap((unit)=>unit.lessons);
  const lessonIndex = courseLessons.findIndex((lesson) => lesson.slug === sourceLessonId);
  const previousLesson = lessonIndex > 0 ? courseLessons[lessonIndex - 1] : null;
  const previousLessonReference = previousLesson
    ? database.collection("learningProgress").doc(user.uid).collection("lessons").doc(learningLessonDocumentId(body.courseId, previousLesson.slug))
    : null;
  const learnerReference = database.collection("progress").doc(user.uid).collection("state").doc("learner");
  try {
    const result = await database.runTransaction(async (transaction) => {
      const previousLessonSnapshot = previousLessonReference ? await transaction.get(previousLessonReference) : null;
      const [lessonSnapshot, learnerSnapshot] = await Promise.all([transaction.get(lessonReference), transaction.get(learnerReference)]);
      if (previousLesson && !previousLessonSnapshot?.data()?.completedAt) {
        throw new LearningProgressError(`Complete ${previousLesson.title} before starting this lesson.`);
      }
      const lessonData = lessonSnapshot.data() as { visitedScreenIds?: string[]; resolvedScreenIds?:string[];skippedScreenIds?:string[];completedAt?: string | null } | undefined;
      const toScreenId=(id:string)=>canonicalScreens.find((screen)=>screen.id===id||screen.blocks.some((block)=>block.id===id))?.id??id;
      const visited = Array.from(new Set((lessonData?.visitedScreenIds ?? []).map(toScreenId).filter((id)=>requirement.screenIds.includes(id as never))));
      const resolvableIds=canonicalScreens.filter((screen)=>screen.interactionPolicy!=="read").map((screen)=>screen.id);
      const resolved=Array.from(new Set((lessonData?.resolvedScreenIds??[]).map(toScreenId).filter((id)=>resolvableIds.includes(id))));
      const skipped=Array.from(new Set((lessonData?.skippedScreenIds??[]).map(toScreenId).filter((id)=>optionalPracticeIds.includes(id))));
      const state = mergeLearnerState(learnerSnapshot.exists ? learnerSnapshot.data() as Partial<LearnerState> : null);
      const now = new Date().toISOString();
      if (body.action === "screen") {
        const screenId = body.screenId!;
        if (!visited.includes(screenId)) {
          const expected = requirement.screenIds[visited.length];
          if (screenId !== expected) throw new LearningProgressError(`Open ${expected ?? "the first screen"} before continuing.`);
          visited.push(screenId);
        }
        let answerCorrect: boolean|undefined;let skippedNow=false;
        if(body.response){
          const screen=canonicalScreens.find((item)=>item.id===screenId);const outcome=body.response.outcome??"answered";
          if(outcome==="skipped"){
            if(!screen||!screenAllowsSkip(screen))throw new LearningProgressError("This interaction cannot be skipped.",422);
            if(!skipped.includes(screenId))skipped.push(screenId);const resolvedIndex=resolved.indexOf(screenId);if(resolvedIndex>=0)resolved.splice(resolvedIndex,1);skippedNow=true;
          }else{
            const blockId=typeof body.response.blockId==="string"?body.response.blockId:"";const values=Array.isArray(body.response.values)?body.response.values.filter((value)=>typeof value==="string").map(String):[];
            answerCorrect=Boolean(screen&&gradeCoursivScreenResponse(screen,{blockId,values}));
            if(!answerCorrect)throw new LearningProgressError("That answer is not correct yet.",422);
            if(!resolved.includes(screenId))resolved.push(screenId);const skippedIndex=skipped.indexOf(screenId);if(skippedIndex>=0)skipped.splice(skippedIndex,1);
          }
        }
        const existing = state.courses[body.courseId!] ?? { completedLessonIds: [], lastLessonId: null, lastScreenId: null, updatedAt: null };
        state.courses[body.courseId!] = { ...existing, lastLessonId: body.lessonId!, lastScreenId: screenId, updatedAt: now };
        transaction.set(lessonReference, { userId:user.uid,courseId:body.courseId,lessonId:body.lessonId,visitedScreenIds:visited,resolvedScreenIds:resolved,skippedScreenIds:skipped,lastScreenId:screenId,startedAt:lessonSnapshot.exists?lessonSnapshot.data()?.startedAt??now:now,updatedAt:now,completedAt:lessonData?.completedAt??null }, { merge:true });
        transaction.set(learnerReference, state);
        return { completed:false, visitedScreenIds:visited,resolvedScreenIds:resolved,skippedScreenIds:skipped,...(answerCorrect===undefined?{}:{correct:answerCorrect}),...(skippedNow?{skipped:true}:{}) };
      }
      const missing = requirement.screenIds.filter((screenId) => !visited.includes(screenId));
      if (missing.length) throw new LearningProgressError(`Complete all lesson screens first. Missing: ${missing.join(", ")}`);
      const unresolved=requiredResolutionIds.filter((screenId)=>!resolved.includes(screenId));
      if(unresolved.length)throw new LearningProgressError(`Complete all lesson interactions first. Missing: ${unresolved.join(", ")}`);
      const unhandledOptional=optionalPracticeIds.filter((screenId)=>!resolved.includes(screenId)&&!skipped.includes(screenId));
      if(unhandledOptional.length)throw new LearningProgressError(`Complete or skip every optional practice first. Missing: ${unhandledOptional.join(", ")}`);
      const completedAt = lessonData?.completedAt ?? now;
      const existing = state.courses[body.courseId!] ?? { completedLessonIds: [], lastLessonId: null, lastScreenId: null, updatedAt: null };
      const completedLessonIds = existing.completedLessonIds.includes(body.lessonId!) ? existing.completedLessonIds : [...existing.completedLessonIds, body.lessonId!];
      state.courses[body.courseId!] = { completedLessonIds, lastLessonId:body.lessonId!, lastScreenId:null, updatedAt:completedAt };
      const today = localDateKey(new Date(), state.preferences.timezone);
      if (!state.activityDates.includes(today)) state.activityDates.push(today);
      state.activityDates.sort();
      transaction.set(lessonReference, { userId:user.uid,courseId:body.courseId,lessonId:body.lessonId,visitedScreenIds:visited,resolvedScreenIds:resolved,skippedScreenIds:skipped,lastScreenId:requirement.screenIds.at(-1),updatedAt:now,completedAt }, { merge:true });
      transaction.set(learnerReference, state);
      return { completed:true,completedAt,completedLessonIds };
    });
    if (result.completed) await refreshAdminUserSummary(user.uid);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof LearningProgressError) return NextResponse.json({ error:error.message }, { status:error.status });
    throw error;
  }
}

export async function GET(request:Request){
  if(!isFirebaseAdminConfigured())return NextResponse.json({error:"Learning sync is not configured"},{status:503});
  const user=await verifyBearerToken(request);if(!user)return NextResponse.json({error:"Authentication required"},{status:401});
  const url=new URL(request.url);const courseId=url.searchParams.get("courseId");const lessonId=url.searchParams.get("lessonId");
  if(!courseId||!lessonId||!(await readCoursivLesson(courseId,runtimeLessonId(courseId,lessonId))))return NextResponse.json({error:"Unknown course or lesson"},{status:404});
  const snapshot=await getAdminDb().collection("learningProgress").doc(user.uid).collection("lessons").doc(learningLessonDocumentId(courseId,lessonId)).get();
  const data=snapshot.data() as {visitedScreenIds?:string[];resolvedScreenIds?:string[];skippedScreenIds?:string[];lastScreenId?:string|null;completedAt?:string|null}|undefined;
  return NextResponse.json({visitedScreenIds:data?.visitedScreenIds??[],resolvedScreenIds:data?.resolvedScreenIds??[],skippedScreenIds:data?.skippedScreenIds??[],lastScreenId:data?.lastScreenId??null,completedAt:data?.completedAt??null});
}

export async function DELETE(request: Request) {
  if (!isFirebaseAdminConfigured()) return NextResponse.json({ error:"Learning sync is not configured" }, { status:503 });
  const user=await verifyBearerToken(request);if(!user)return NextResponse.json({ error:"Authentication required" }, { status:401 });
  const url=new URL(request.url);const courseId=url.searchParams.get("courseId");const lessonId=url.searchParams.get("lessonId");
  if(!courseId||!(await readCoursivCourse(courseId)))return NextResponse.json({ error:"Unknown course" }, { status:404 });
  const database=getAdminDb();
  const learnerReference=database.collection("progress").doc(user.uid).collection("state").doc("learner");
  if(lessonId){
    if(!(await readCoursivLesson(courseId,runtimeLessonId(courseId,lessonId))))return NextResponse.json({error:"Unknown lesson"},{status:404});
    const lessonReference=database.collection("learningProgress").doc(user.uid).collection("lessons").doc(learningLessonDocumentId(courseId,lessonId));
    const deleted=await database.runTransaction(async(transaction)=>{const [lesson,current]=await Promise.all([transaction.get(lessonReference),transaction.get(learnerReference)]);transaction.delete(lessonReference);if(current.exists)transaction.set(learnerReference,resetLessonProgress(mergeLearnerState(current.data() as Partial<LearnerState>),courseId,lessonId));return lesson.exists;});
    await refreshAdminUserSummary(user.uid);
    return NextResponse.json({reset:true,lessonId,deletedLessons:deleted?1:0});
  }
  const snapshot=await database.collection("learningProgress").doc(user.uid).collection("lessons").where("courseId","==",courseId).limit(500).get();
  const batch=database.batch();for(const document of snapshot.docs)batch.delete(document.ref);if(!snapshot.empty)await batch.commit();
  await database.runTransaction(async(transaction)=>{const current=await transaction.get(learnerReference);if(!current.exists)return;const state=mergeLearnerState(current.data() as Partial<LearnerState>);delete state.courses[courseId];transaction.set(learnerReference,state);});
  return NextResponse.json({ reset:true,deletedLessons:snapshot.size });
}
