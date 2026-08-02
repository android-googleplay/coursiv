import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const commit = process.argv.includes("--commit");
const credential = process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY
  ? cert({ projectId:process.env.FIREBASE_PROJECT_ID,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey:process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g,"\n") })
  : applicationDefault();
const app = getApps()[0] ?? initializeApp({ credential });
const database = getFirestore(app);
const auth = getAuth(app);
const normalizeSearch = (value) => String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
const searchIndex = (summary) => {
  const values = [summary.id,summary.email,summary.displayName,...summary.tags].flatMap((value)=>{
    const normalized=normalizeSearch(value);
    return [normalized,...normalized.split(/[^\p{L}\p{N}]+/u)];
  }).filter(Boolean);
  const prefixes=new Set();
  for(const value of values)for(let length=1;length<=Math.min(value.length,80);length+=1)prefixes.add(value.slice(0,length));
  return {searchPrefixes:[...prefixes],tagsLower:[...new Set(summary.tags.map(normalizeSearch).filter(Boolean))]};
};

const [subscriptions, certificates, tickets, completedLessons] = await Promise.all([
  database.collection("subscriptions").get(),
  database.collection("certificates").get(),
  database.collection("supportTickets").get(),
  database.collectionGroup("lessons").select("userId","completedAt").get(),
]);
const subscriptionsByUser = new Map(subscriptions.docs.map((document) => [String(document.data().userId ?? document.id), document.data()]));
const countByUser = (documents, filter = () => true) => {
  const result = new Map();
  for (const document of documents) {
    const data = document.data();
    if (!filter(data)) continue;
    const uid = String(data.userId ?? "");
    if (uid) result.set(uid, (result.get(uid) ?? 0) + 1);
  }
  return result;
};
const certificateCount = countByUser(certificates.docs);
const openTicketCount = countByUser(tickets.docs, (data) => ["open","in_progress","waiting_for_user"].includes(data.status));
const completedLessonCount = countByUser(completedLessons.docs, (data) => Boolean(data.completedAt));
const authUsers = [];
let pageToken;
do {
  const page = await auth.listUsers(1000, pageToken);
  authUsers.push(...page.users);
  pageToken = page.pageToken;
} while (pageToken);
const metaByUser = new Map();
for (let start=0;start<authUsers.length;start+=300) {
  const documents = await database.getAll(...authUsers.slice(start,start+300).map((user)=>database.collection("adminUserMeta").doc(user.uid)));
  for (const document of documents) metaByUser.set(document.id,document.data() ?? {});
}
const summaries = authUsers.map((user) => {
    const subscription = subscriptionsByUser.get(user.uid);
    const summary = {
      id:user.uid,
      email:user.email ?? "",
      displayName:user.displayName ?? user.email?.split("@")[0] ?? "Member",
      registeredAt:user.metadata.creationTime ? new Date(user.metadata.creationTime).toISOString() : "",
      lastActiveAt:user.metadata.lastSignInTime ? new Date(user.metadata.lastSignInTime).toISOString() : "",
      onboardingCompleted:false,
      subscriptionStatus:subscription?.status ?? "none",
      currentPeriodEnd:subscription?.currentPeriodEnd ?? null,
      certificateCount:certificateCount.get(user.uid) ?? 0,
      completedLessonCount:completedLessonCount.get(user.uid) ?? 0,
      openTicketCount:openTicketCount.get(user.uid) ?? 0,
      accountStatus:user.disabled ? "suspended" : "active",
      tags:metaByUser.get(user.uid)?.tags ?? [],
      updatedAt:new Date().toISOString(),
    };
    return {...summary,...searchIndex(summary)};
});

if (!commit) {
  console.log(JSON.stringify({ mode:"dry-run",users:summaries.length,paid:summaries.filter((item)=>["active","trialing"].includes(item.subscriptionStatus)).length,certificates:certificates.size,openTickets:[...openTicketCount.values()].reduce((a,b)=>a+b,0),next:"Run npm run cms:rebuild-users -- --commit to write projections." },null,2));
  process.exit(0);
}
for (let start=0;start<summaries.length;start+=400) {
  const batch=database.batch();
  for (const summary of summaries.slice(start,start+400)) batch.set(database.collection("adminUserSummaries").doc(summary.id),summary);
  await batch.commit();
}
console.log(JSON.stringify({ mode:"committed",users:summaries.length },null,2));
