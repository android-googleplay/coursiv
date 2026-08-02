import { NextResponse } from "next/server";
import { practiceGames } from "@/lib/member-data";
import { localDateKey, mergeLearnerState, type LearnerState } from "@/lib/learner-state";
import { getAdminDb, isFirebaseAdminConfigured, verifyBearerToken } from "@/lib/platform/firebase-admin";

export const runtime="nodejs";

export async function POST(request:Request){
  if(!isFirebaseAdminConfigured())return NextResponse.json({error:"Engagement sync is not configured"},{status:503});
  const user=await verifyBearerToken(request);if(!user)return NextResponse.json({error:"Authentication required"},{status:401});
  const body=await request.json().catch(()=>null) as {gameId?:string;questionId?:string;answerIndex?:number}|null;
  const game=practiceGames.find((item)=>item.id===body?.gameId);const question=game?.questions.find((item)=>item.id===body?.questionId);
  if(!game||!question||!Number.isInteger(body?.answerIndex))return NextResponse.json({error:"Invalid game answer"},{status:400});
  const correct=body!.answerIndex===question.correct;const completionId=`${game.id}:${question.id}`;const reference=getAdminDb().collection("progress").doc(user.uid).collection("state").doc("learner");
  const result=await getAdminDb().runTransaction(async(transaction)=>{
    const snapshot=await transaction.get(reference);const state=mergeLearnerState(snapshot.exists?snapshot.data() as Partial<LearnerState>:null);let awarded=0;
    if(correct&&!state.completedGameIds.includes(completionId)){state.completedGameIds.push(completionId);state.gamePoints+=25;awarded=25;const today=localDateKey(new Date(),state.preferences.timezone);if(!state.activityDates.includes(today))state.activityDates.push(today);state.activityDates.sort();transaction.set(reference,state);}
    return {state,awarded};
  });
  return NextResponse.json({correct,...result});
}
