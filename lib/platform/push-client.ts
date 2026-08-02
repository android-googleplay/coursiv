"use client";

import { deleteToken, getMessaging, getToken, isSupported } from "firebase/messaging";
import { getFirebaseClient } from "@/lib/platform/firebase-client";

const PUSH_TOKEN_STORAGE_KEY = "lumora.push.token.v1";

export async function registerPushToken(idToken:string|null){
  const client=getFirebaseClient(); const vapidKey=process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if(!client||!vapidKey||!(await isSupported()))throw new Error("Push messaging is not configured for this browser.");
  const registration=await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  const token=await getToken(getMessaging(client.app),{vapidKey,serviceWorkerRegistration:registration});
  if(!token)throw new Error("Unable to create a push token.");
  const response=await fetch("/api/push/register",{method:"POST",headers:{"Content-Type":"application/json",...(idToken?{Authorization:`Bearer ${idToken}`}:{})},body:JSON.stringify({token})});
  if(!response.ok)throw new Error((await response.json()).error??"Unable to register notifications");
  localStorage.setItem(PUSH_TOKEN_STORAGE_KEY,token);
  return token;
}

export async function unregisterPushToken(idToken:string|null){
  const client=getFirebaseClient();
  const token=localStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
  if(token){
    const response=await fetch("/api/push/register",{method:"DELETE",headers:{"Content-Type":"application/json",...(idToken?{Authorization:`Bearer ${idToken}`}:{})},body:JSON.stringify({token})});
    if(!response.ok&&response.status!==404)throw new Error((await response.json()).error??"Unable to disable notifications");
  }
  if(client&&await isSupported())await deleteToken(getMessaging(client.app)).catch(()=>false);
  localStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
}
