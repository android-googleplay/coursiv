import { NextResponse } from "next/server";
import { isFirebaseAdminConfigured, verifyBearerToken } from "@/lib/platform/firebase-admin";

export const runtime = "nodejs";

type ChatMessage = { role: "user" | "assistant"; text: string };

export async function POST(request: Request) {
  if (isFirebaseAdminConfigured() && !(await verifyBearerToken(request))) return NextResponse.json({error:"Authentication required"},{status:401});
  if (!process.env.AI_API_URL || !process.env.AI_API_KEY || !process.env.AI_MODEL) return NextResponse.json({error:"AI is not configured. Set AI_API_URL, AI_API_KEY, and AI_MODEL."},{status:503});
  const body = await request.json().catch(()=>null) as {messages?:ChatMessage[]}|null;
  const messages=(body?.messages??[]).filter((item)=>["user","assistant"].includes(item.role)&&typeof item.text==="string").slice(-20);
  if (!messages.length) return NextResponse.json({error:"At least one message is required"},{status:400});
  const response=await fetch(process.env.AI_API_URL,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${process.env.AI_API_KEY}`},body:JSON.stringify({model:process.env.AI_MODEL,messages:[{role:"system",content:"You are Coursiv, a practical AI learning assistant. Give clear, safe, concise guidance and actionable next steps."},...messages.map((item)=>({role:item.role,content:item.text}))]})});
  const data=await response.json().catch(()=>null) as {choices?:{message?:{content?:string}}[];error?:{message?:string}}|null;
  if(!response.ok) return NextResponse.json({error:data?.error?.message??"AI provider request failed"},{status:502});
  const text=data?.choices?.[0]?.message?.content?.trim();
  return text?NextResponse.json({text}):NextResponse.json({error:"AI provider returned an empty response"},{status:502});
}
