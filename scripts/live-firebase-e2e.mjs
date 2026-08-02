import { randomUUID } from "node:crypto";
import { applicationDefault, deleteApp as deleteAdminApp, getApps as getAdminApps, initializeApp as initializeAdminApp } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { deleteApp, initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, getFirestore, setDoc } from "firebase/firestore";

const required = ["NEXT_PUBLIC_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "NEXT_PUBLIC_FIREBASE_PROJECT_ID", "NEXT_PUBLIC_FIREBASE_APP_ID"];
for (const name of required) if (!process.env[name]) throw new Error(`Missing ${name}`);

const suffix = randomUUID().slice(0, 8);
const password = `Lumora-${randomUUID()}!`;
const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
const adminApp = getAdminApps()[0] ?? initializeAdminApp({ credential: applicationDefault() });
const adminAuth = getAdminAuth(adminApp);
const adminDb = getAdminFirestore(adminApp);
const records = [];
const webApps = [];

function check(condition, message) {
  if (!condition) throw new Error(message);
  records.push(`PASS ${message}`);
}

async function api(path, { token, method = "GET", body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const contentType = response.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json") ? await response.json() : await response.arrayBuffer();
  return { response, data };
}

async function createTestUser(label) {
  const email = `lumora.live.e2e.${label}.${suffix}@example.com`;
  const user = await adminAuth.createUser({ email, password, displayName: `E2E ${label}` });
  const app = initializeApp(config, `live-e2e-${label}-${suffix}`);
  webApps.push(app);
  const credential = await signInWithEmailAndPassword(getAuth(app), email, password);
  return { user, app, token: await credential.user.getIdToken() };
}

async function expectDenied(action, message) {
  let denied = false;
  try { await action(); } catch (error) { denied = String(error?.code ?? error).includes("permission-denied"); }
  check(denied, message);
}

let userA;
let userB;
let userDelete;
let certificateId;
let contentId;
try {
  userA = await createTestUser("owner");
  userB = await createTestUser("other");
  userDelete = await createTestUser("delete");

  let result = await api("/api/learning/progress", { token:userA.token, method:"POST", body:{ action:"screen",courseId:"does-not-exist",lessonId:"fake",screenId:"step-0" } });
  check(result.response.status === 404, "unknown courses cannot create progress");

  result = await api("/api/learning/progress", { token:userA.token, method:"POST", body:{ action:"screen",courseId:"claude",lessonId:"working-with-projects",screenId:"step-0" } });
  check(result.response.status === 409, "later lessons are locked by the server");

  result = await api("/api/learning/progress", { token:userA.token, method:"POST", body:{ action:"complete",courseId:"claude",lessonId:"meet-claude" } });
  check(result.response.status === 409, "lesson completion requires every ordered screen");

  for (const screenId of ["step-0", "step-1", "step-2", "step-3"]) {
    result = await api("/api/learning/progress", { token:userA.token, method:"POST", body:{ action:"screen",courseId:"claude",lessonId:"meet-claude",screenId } });
    check(result.response.ok, `screen ${screenId} saves authoritatively`);
  }
  result = await api("/api/learning/progress", { token:userA.token, method:"POST", body:{ action:"complete",courseId:"claude",lessonId:"meet-claude" } });
  check(result.response.ok && result.data.completed === true, "ordered lesson completion succeeds");
  result = await api("/api/learning/progress", { token:userA.token, method:"POST", body:{ action:"screen",courseId:"claude",lessonId:"working-with-projects",screenId:"step-0" } });
  check(result.response.ok, "next lesson unlocks after prerequisite completion");
  result = await api("/api/learning/progress?courseId=claude", { token:userA.token, method:"DELETE" });
  check(result.response.ok && result.data.deletedLessons === 2, "course reset removes authoritative lesson records");

  const claudeLessonIds=["meet-claude","working-with-projects","create-with-artifacts","creativity-stimulation","analytical-frameworks","interconnected-reasoning","writing-editing","understanding-research-and-synthesis","strategic-thinking-and-critical-review","using-claude-alongside-other-tools"];
  for(const lessonId of claudeLessonIds){
    for(const screenId of ["step-0","step-1","step-2","step-3"]){result=await api("/api/learning/progress",{token:userA.token,method:"POST",body:{action:"screen",courseId:"claude",lessonId,screenId}});if(!result.response.ok)throw new Error(`Unable to complete ${lessonId} ${screenId}: ${JSON.stringify(result.data)}`);}
    result=await api("/api/learning/progress",{token:userA.token,method:"POST",body:{action:"complete",courseId:"claude",lessonId}});if(!result.response.ok)throw new Error(`Unable to complete ${lessonId}: ${JSON.stringify(result.data)}`);
  }
  check(true,"a full course can be completed through ordered authoritative lesson APIs");
  result=await api("/api/certificates/issue",{token:userA.token,method:"POST",body:{courseId:"claude"}});
  check(result.response.ok&&result.data.certificate?.courseId==="claude","course completion issues a real certificate");
  check(result.data.certificate?.emailStatus==="not_configured","certificate records delivery state when email is not configured");

  result = await api("/api/engagement/challenge", { token:userA.token,method:"POST",body:{action:"join",challengeId:"challenge-3"} });
  check(result.response.ok && result.data.state.challenges["challenge-3"], "challenge join is saved by the server");
  result = await api("/api/engagement/challenge", { token:userA.token,method:"POST",body:{action:"complete",challengeId:"challenge-3",day:1} });
  check(result.response.ok && result.data.state.challenges["challenge-3"].completedDays.includes(1), "challenge day completion is transactional");
  result = await api("/api/engagement/challenge", { token:userA.token,method:"POST",body:{action:"complete",challengeId:"challenge-3",day:2} });
  check(result.response.status === 409, "only one challenge day can be completed per timezone day");

  result = await api("/api/engagement/game", { token:userA.token,method:"POST",body:{gameId:"ai-spotter",questionId:"specificity",answerIndex:0} });
  check(result.response.ok && result.data.correct === false && result.data.awarded === 0, "incorrect game answers cannot award points");
  result = await api("/api/engagement/game", { token:userA.token,method:"POST",body:{gameId:"ai-spotter",questionId:"specificity",answerIndex:1} });
  check(result.response.ok && result.data.correct === true && result.data.awarded === 25, "correct game answer awards server-controlled points once");
  result = await api("/api/engagement/game", { token:userA.token,method:"POST",body:{gameId:"ai-spotter",questionId:"specificity",answerIndex:1} });
  check(result.response.ok && result.data.awarded === 0, "replaying a completed game answer cannot farm points");

  const dbA = getFirestore(userA.app);
  const dbB = getFirestore(userB.app);
  const ownerState = doc(dbA, "progress", userA.user.uid, "state", "learner");
  check((await getDoc(ownerState)).exists(), "owner can read own learner state");
  await expectDenied(() => setDoc(ownerState, { gamePoints:999999 },{merge:true}), "clients cannot overwrite authoritative learner state");
  await expectDenied(() => getDoc(doc(dbB, "progress", userA.user.uid, "state", "learner")), "another user cannot read owner progress");
  await expectDenied(() => setDoc(doc(dbA, "learningProgress", userA.user.uid, "lessons", "forged"), { completedAt:new Date().toISOString() }), "clients cannot forge authoritative learning progress");

  result=await api("/api/learner-state");
  check(result.response.status===401,"learner state API requires authentication");
  result=await api("/api/learner-state",{token:userB.token});
  check(result.response.ok&&result.data.exists===false,"new learners begin without a remote state document");
  result=await api("/api/learner-state",{token:userB.token,method:"POST",body:{state:{preferences:{darkMode:true}}}});
  check(result.response.ok&&result.data.state.preferences.darkMode===true,"one-time local state migration is server controlled");
  result=await api("/api/learner-state",{token:userB.token,method:"PATCH",body:{key:"darkMode",value:false}});
  check(result.response.ok&&result.data.state.preferences.darkMode===false,"preference updates merge without overwriting progress");
  result=await api("/api/learner-state",{token:userB.token,method:"PATCH",body:{key:"gamePoints",value:999}});
  check(result.response.status===400,"preference endpoint rejects authoritative state fields");

  contentId = `live-e2e-${suffix}`;
  await adminDb.collection("programs").doc(contentId).set({ status:"published",title:"Temporary E2E content" });
  check((await getDoc(doc(dbB, "programs", contentId))).data()?.status === "published", "published content is readable");
  await expectDenied(() => setDoc(doc(dbB, "programs", contentId), { status:"published",title:"forged" }), "learners cannot modify public content");
  for(const [collection,id] of [["courses","claude"],["lessons","claude__meet-claude"],["challenges","challenge-1"],["prompts","productivity-planning-strategy"],["useCases","use-case-1"],["contentMetadata","learner-app"]])check((await getDoc(doc(dbB,collection,id))).exists(),`${collection} published content is readable`);

  certificateId = `live-e2e-${suffix}`;
  await adminDb.collection("certificates").doc(certificateId).set({
    id:certificateId,credentialId:`LMR-E2E-${suffix.toUpperCase()}`,userId:userA.user.uid,recipientEmail:userA.user.email,
    learnerName:"E2E Owner",courseId:"e2e",courseTitle:"Private E2E",courseHours:1,issuedAt:new Date().toISOString(),visibility:"private",emailStatus:"not_configured",emailId:null,
  });
  result = await api(`/api/certificates/${certificateId}`);
  check(result.response.status === 404, "private certificate JSON is hidden from anonymous users");
  result = await api(`/api/certificates/${certificateId}`, { token:userB.token });
  check(result.response.status === 404, "private certificate JSON is hidden from other users");
  result = await api(`/api/certificates/${certificateId}`, { token:userA.token });
  check(result.response.ok && result.data.certificate.userId === userA.user.uid, "private certificate JSON is readable by its owner");
  result = await api(`/api/certificates/${certificateId}`, { token:userA.token,method:"PATCH",body:{learnerName:"Verified E2E Owner"} });
  check(result.response.ok && result.data.certificate.learnerName === "Verified E2E Owner", "certificate owner can update the display name");
  result = await api(`/api/certificates/${certificateId}`, { token:userB.token,method:"PATCH",body:{learnerName:"Wrong Owner"} });
  check(result.response.status === 404, "another user cannot update a certificate");
  result = await api(`/api/certificates/${certificateId}/pdf`);
  check(result.response.status === 404, "private certificate PDF is hidden from anonymous users");
  result = await api(`/api/certificates/${certificateId}/pdf`, { token:userA.token });
  check(result.response.ok && result.response.headers.get("content-type")?.includes("application/pdf"), "private certificate PDF is available to its owner");

  result = await api("/api/support", { token:userA.token,method:"POST",body:{message:"Temporary live E2E support request."} });
  check(result.response.status === 201 && result.data.ticket.userId === userA.user.uid, "support request is stored for the authenticated learner");
  result = await api("/api/support", { token:userA.token });
  check(result.response.ok && result.data.tickets.some((ticket) => ticket.userId === userA.user.uid), "support history returns only the learner's requests");

  const pushToken=`live-e2e-push-${suffix}-01234567890123456789012345678901`;
  result=await api("/api/push/register",{method:"POST",body:{token:pushToken}});
  check(result.response.status===401,"push token registration requires authentication");
  result=await api("/api/push/register",{token:userA.token,method:"POST",body:{token:pushToken}});
  check(result.response.ok,"authenticated learner can register a push token");
  const pushDocument=adminDb.collection("pushTokens").doc(userA.user.uid).collection("tokens").doc(pushToken.slice(-32));
  check((await pushDocument.get()).data()?.token===pushToken,"push token is stored under its owner");
  result=await api("/api/push/register",{token:userA.token,method:"DELETE",body:{token:pushToken}});
  check(result.response.ok&&!(await pushDocument.get()).exists,"disabling push removes the server token");

  result=await api("/api/learner-state",{token:userDelete.token,method:"POST",body:{state:{preferences:{darkMode:true}}}});check(result.response.ok,"deletion test account has learner state");
  result=await api("/api/support",{token:userDelete.token,method:"POST",body:{message:"Temporary deletion lifecycle request."}});check(result.response.status===201,"deletion test account has support data");
  await adminDb.collection("certificates").doc(`delete-${suffix}`).set({id:`delete-${suffix}`,credentialId:`DELETE-${suffix}`,userId:userDelete.user.uid,recipientEmail:userDelete.user.email,learnerName:"Delete E2E",courseId:"delete",courseTitle:"Delete lifecycle",courseHours:1,issuedAt:new Date().toISOString(),visibility:"private",emailStatus:"not_configured"});
  result=await api("/api/account/delete",{token:userDelete.token,method:"DELETE",body:{confirmation:"wrong"}});check(result.response.status===400,"account deletion requires exact confirmation");
  result=await api("/api/account/delete",{token:userDelete.token,method:"DELETE",body:{confirmation:"DELETE"}});check(result.response.ok&&result.data.deleted===true,"account deletion removes the authenticated account");
  const deletedAuth=await adminAuth.getUser(userDelete.user.uid).then(()=>false).catch(error=>String(error?.code).includes("user-not-found"));check(deletedAuth,"deleted account is removed from Firebase Auth");
  check(!(await adminDb.collection("progress").doc(userDelete.user.uid).get()).exists,"deleted account learner state is removed");
  check((await adminDb.collection("supportTickets").where("userId","==",userDelete.user.uid).get()).empty,"deleted account support data is removed");
  check((await adminDb.collection("certificates").where("userId","==",userDelete.user.uid).get()).empty,"deleted account certificates are removed");

  console.log(records.join("\n"));
  console.log(`Live Firebase E2E passed (${records.length} checks).`);
} finally {
  for (const app of webApps) await deleteApp(app).catch(() => undefined);
  if (contentId) await adminDb.collection("programs").doc(contentId).delete().catch(() => undefined);
  if (certificateId) await adminDb.collection("certificates").doc(certificateId).delete().catch(() => undefined);
  for (const account of [userA, userB,userDelete].filter(Boolean)) {
    const uid = account.user.uid;
    for (const collection of ["progress", "learningProgress", "pushTokens"]) await adminDb.recursiveDelete(adminDb.collection(collection).doc(uid)).catch(() => undefined);
    const tickets = await adminDb.collection("supportTickets").where("userId", "==", uid).get().catch(() => null);
    if (tickets) { const batch=adminDb.batch(); for (const ticket of tickets.docs) batch.delete(ticket.ref); if(!tickets.empty) await batch.commit(); }
    const certificates = await adminDb.collection("certificates").where("userId", "==", uid).get().catch(() => null);
    if (certificates) { const batch=adminDb.batch(); for (const certificate of certificates.docs) batch.delete(certificate.ref); if(!certificates.empty) await batch.commit(); }
    await adminAuth.deleteUser(uid).catch(() => undefined);
  }
  await deleteAdminApp(adminApp).catch(() => undefined);
}

process.exit(0);
