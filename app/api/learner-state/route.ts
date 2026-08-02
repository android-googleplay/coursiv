import { NextResponse } from "next/server";
import { mergeLearnerState, type LearnerPreferences, type LearnerState } from "@/lib/learner-state";
import { getAdminDb, isFirebaseAdminConfigured, verifyBearerToken } from "@/lib/platform/firebase-admin";
import { readAuthoritativeLearningState } from "@/lib/platform/authoritative-learning";

export const runtime="nodejs";

const preferenceKeys=new Set<keyof LearnerPreferences>(["language","darkMode","soundEffects","pushNotifications","analyticsConsent","timezone"]);

function validPreference<K extends keyof LearnerPreferences>(key:K,value:unknown):value is LearnerPreferences[K]{
  if(key==="language")return value==="English"||value==="繁體中文";
  if(key==="timezone"){
    if(typeof value!=="string"||value.length>80)return false;
    try{new Intl.DateTimeFormat("en",{timeZone:value}).format();return true;}catch{return false;}
  }
  return typeof value==="boolean";
}

async function authenticatedState(request:Request){
  if(!isFirebaseAdminConfigured())return {error:NextResponse.json({error:"Learner sync is not configured"},{status:503})};
  const user=await verifyBearerToken(request);if(!user)return {error:NextResponse.json({error:"Authentication required"},{status:401})};
  const reference=getAdminDb().collection("progress").doc(user.uid).collection("state").doc("learner");
  return {user,reference};
}

export async function GET(request:Request){
  const auth=await authenticatedState(request);if(auth.error)return auth.error;
  const snapshot=await auth.reference.get();
  return NextResponse.json({exists:snapshot.exists,state:await readAuthoritativeLearningState(auth.user.uid)});
}

export async function POST(request:Request){
  const auth=await authenticatedState(request);if(auth.error)return auth.error;
  const body=await request.json().catch(()=>null) as {state?:Partial<LearnerState>}|null;
  if(!body?.state)return NextResponse.json({error:"Migration state required"},{status:400});
  const migrated=mergeLearnerState(body.state);
  const state=await getAdminDb().runTransaction(async transaction=>{
    const snapshot=await transaction.get(auth.reference);
    if(snapshot.exists)return mergeLearnerState(snapshot.data() as Partial<LearnerState>);
    transaction.set(auth.reference,{...migrated,migratedAt:new Date().toISOString()});return migrated;
  });
  return NextResponse.json({state});
}

export async function PATCH(request:Request){
  const auth=await authenticatedState(request);if(auth.error)return auth.error;
  const body=await request.json().catch(()=>null) as {key?:keyof LearnerPreferences;value?:unknown}|null;
  if(!body?.key||!preferenceKeys.has(body.key)||!validPreference(body.key,body.value))return NextResponse.json({error:"Invalid preference"},{status:400});
  const state=await getAdminDb().runTransaction(async transaction=>{
    const snapshot=await transaction.get(auth.reference);const current=mergeLearnerState(snapshot.exists?snapshot.data() as Partial<LearnerState>:null);
    current.preferences={...current.preferences,[body.key!]:body.value};transaction.set(auth.reference,current);return current;
  });
  return NextResponse.json({state});
}
