import "server-only";

import { defaultLearnerState, mergeLearnerState, type LearnerState } from "@/lib/learner-state";
import { getAdminDb } from "./firebase-admin";

export async function readAuthoritativeLearningState(userId: string): Promise<LearnerState> {
  const database = getAdminDb();
  const [profile, lessons, assessments] = await Promise.all([
    database.collection("progress").doc(userId).collection("state").doc("learner").get(),
    database.collection("learningProgress").doc(userId).collection("lessons").limit(500).get(),
    database.collection("learningProgress").doc(userId).collection("assessments").limit(100).get(),
  ]);
  const state = profile.exists ? mergeLearnerState(profile.data() as Partial<LearnerState>) : defaultLearnerState();
  state.courses = {};
  for (const document of lessons.docs) {
    const data = document.data() as { courseId?: string; lessonId?: string; completedAt?: string | null;lastScreenId?:string|null;updatedAt?:string|null };
    if (!data.courseId || !data.lessonId) continue;
    const existing = state.courses[data.courseId] ?? { completedLessonIds: [], lastLessonId: null, lastScreenId: null, updatedAt: null };
    if (data.completedAt&&!existing.completedLessonIds.includes(data.lessonId)) existing.completedLessonIds.push(data.lessonId);
    const activityAt=data.updatedAt??data.completedAt??null;
    if(activityAt&&(!existing.updatedAt||activityAt>=existing.updatedAt)){
      existing.lastLessonId=data.lessonId;
      existing.lastScreenId=data.completedAt?null:(data.lastScreenId??null);
      existing.updatedAt=activityAt;
    }
    state.courses[data.courseId] = existing;
  }
  state.programAssessments = {};
  for (const document of assessments.docs) {
    const data = document.data() as { programId?: string; score?: number; bestScore?: number; passedAt?: string | null };
    const authoritativeScore = data.bestScore ?? data.score;
    if (!data.programId || typeof authoritativeScore !== "number") continue;
    state.programAssessments[data.programId] = { score: authoritativeScore, passedAt: data.passedAt ?? null };
  }
  return state;
}
