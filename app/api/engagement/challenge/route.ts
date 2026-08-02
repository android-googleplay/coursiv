import { NextResponse } from "next/server";
import { challenges } from "@/lib/member-data";
import { localDateKey, mergeLearnerState, type LearnerState } from "@/lib/learner-state";
import { getAdminDb, isFirebaseAdminConfigured, verifyBearerToken } from "@/lib/platform/firebase-admin";

export const runtime="nodejs";

class ChallengeError extends Error { constructor(message:string,readonly status=409){super(message);} }

export async function POST(request:Request){
  if(!isFirebaseAdminConfigured())return NextResponse.json({error:"Engagement sync is not configured"},{status:503});
  const user=await verifyBearerToken(request);if(!user)return NextResponse.json({error:"Authentication required"},{status:401});
  const body=await request.json().catch(()=>null) as {action?:"join"|"complete";challengeId?:string;day?:number}|null;
  const challenge=challenges.find((item)=>item.id===body?.challengeId);if(!challenge||!body?.action)return NextResponse.json({error:"Unknown challenge"},{status:404});
  const reference=getAdminDb().collection("progress").doc(user.uid).collection("state").doc("learner");
  try{
    const state=await getAdminDb().runTransaction(async(transaction)=>{
      const snapshot=await transaction.get(reference);const current=mergeLearnerState(snapshot.exists?snapshot.data() as Partial<LearnerState>:null);const existing=current.challenges[challenge.id];const now=new Date();
      if(body.action==="join"){
        if(!existing)current.challenges[challenge.id]={joinedAt:now.toISOString(),completedDays:[],completedDayDates:{},completedAt:null};
      }else{
        if(!existing)throw new ChallengeError("Join this challenge before completing a task.");
        const expectedDay=existing.completedDays.length+1;if(body.day!==expectedDay||expectedDay>challenge.days)throw new ChallengeError(`Complete day ${expectedDay} next.`);
        const today=localDateKey(now,current.preferences.timezone);if(Object.values(existing.completedDayDates??{}).includes(today))throw new ChallengeError("Today’s challenge task is already complete.");
        existing.completedDays=[...existing.completedDays,expectedDay];existing.completedDayDates={...(existing.completedDayDates??{}),[String(expectedDay)]:today};existing.completedAt=expectedDay===challenge.days?now.toISOString():null;
        if(!current.activityDates.includes(today))current.activityDates.push(today);current.activityDates.sort();
      }
      transaction.set(reference,current);return current;
    });
    return NextResponse.json({state});
  }catch(error){if(error instanceof ChallengeError)return NextResponse.json({error:error.message},{status:error.status});throw error;}
}
