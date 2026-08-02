import { NextResponse } from "next/server";
import { isCourseComplete } from "@/lib/certificate-eligibility";
import { localDateKey, mergeLearnerState, type LearnerState } from "@/lib/learner-state";
import { certificatePrograms, getProgramCourses } from "@/lib/member-data";
import { gradeProgramAssessment } from "@/lib/program-assessment";
import { readAuthoritativeLearningState } from "@/lib/platform/authoritative-learning";
import { getAdminDb, isFirebaseAdminConfigured, verifyBearerToken } from "@/lib/platform/firebase-admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isFirebaseAdminConfigured()) return NextResponse.json({ error: "Learning sync is not configured" }, { status: 503 });
  const user = await verifyBearerToken(request);
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { programId?: string; answers?: number[] } | null;
  const program = certificatePrograms.find((item) => item.id === body?.programId);
  const grade = Array.isArray(body?.answers) ? gradeProgramAssessment(body.answers) : null;
  if (!program || !grade) return NextResponse.json({ error: "Invalid assessment submission" }, { status: 400 });
  const authoritative = await readAuthoritativeLearningState(user.uid);
  if (!getProgramCourses(program.id).every((course) => isCourseComplete(authoritative, course.id))) {
    return NextResponse.json({ error: "Complete every program course before taking the final skills check." }, { status: 409 });
  }

  const database = getAdminDb();
  const assessmentReference = database.collection("learningProgress").doc(user.uid).collection("assessments").doc(program.id);
  const learnerReference = database.collection("progress").doc(user.uid).collection("state").doc("learner");
  const now = new Date().toISOString();
  const result = await database.runTransaction(async (transaction) => {
    const [assessmentSnapshot, learnerSnapshot] = await Promise.all([transaction.get(assessmentReference), transaction.get(learnerReference)]);
    const previous = assessmentSnapshot.data() as { attempts?: number; bestScore?: number; passedAt?: string | null } | undefined;
    const passedAt = previous?.passedAt ?? (grade.passed ? now : null);
    const bestScore = Math.max(previous?.bestScore ?? 0, grade.score);
    const attempts = (previous?.attempts ?? 0) + 1;
    transaction.set(assessmentReference, { userId:user.uid,programId:program.id,score:grade.score,bestScore,attempts,passedAt,updatedAt:now }, { merge:true });
    const state = mergeLearnerState(learnerSnapshot.exists ? learnerSnapshot.data() as Partial<LearnerState> : null);
    state.programAssessments[program.id] = { score:bestScore, passedAt };
    if (grade.passed) {
      const today = localDateKey(new Date(), state.preferences.timezone);
      if (!state.activityDates.includes(today)) state.activityDates.push(today);
      state.activityDates.sort();
    }
    transaction.set(learnerReference, state);
    return { score:grade.score,bestScore,passed:grade.passed,passedAt,attempts };
  });
  return NextResponse.json(result);
}
