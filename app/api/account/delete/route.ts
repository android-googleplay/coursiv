import { NextResponse } from "next/server";
import type { Query } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb, isFirebaseAdminConfigured, verifyBearerToken } from "@/lib/platform/firebase-admin";

export const runtime = "nodejs";

async function deleteQuery(query: Query) {
  let deleted = 0;
  while (true) {
    const snapshot = await query.limit(400).get();
    if (snapshot.empty) return deleted;
    const batch = getAdminDb().batch();
    for (const document of snapshot.docs) batch.delete(document.ref);
    await batch.commit();
    deleted += snapshot.size;
  }
}

async function deleteTickets(query: Query) {
  let deleted = 0;
  while (true) {
    const snapshot = await query.limit(100).get();
    if (snapshot.empty) return deleted;
    for (const document of snapshot.docs) await getAdminDb().recursiveDelete(document.ref);
    deleted += snapshot.size;
  }
}

export async function DELETE(request: Request) {
  if (!isFirebaseAdminConfigured()) return NextResponse.json({ error: "Account deletion is not configured" }, { status: 503 });
  const user = await verifyBearerToken(request);
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { confirmation?: string } | null;
  if (body?.confirmation !== "DELETE") return NextResponse.json({ error: "Type DELETE to confirm account deletion" }, { status: 400 });

  const database = getAdminDb();
  const subscriptionReference = database.collection("subscriptions").doc(user.uid);
  const subscription = await subscriptionReference.get();
  if (["active", "trialing", "past_due", "unpaid"].includes(subscription.data()?.status)) {
    return NextResponse.json({ error: "Resolve or cancel your subscription before deleting your account." }, { status: 409 });
  }

  const deleted = {
    supportTickets: await deleteTickets(database.collection("supportTickets").where("userId", "==", user.uid)),
    certificates: await deleteQuery(database.collection("certificates").where("userId", "==", user.uid)),
    emailDeliveries: await deleteQuery(database.collection("emailDeliveries").where("userId", "==", user.uid)),
    events: await deleteQuery(database.collection("events").where("userId", "==", user.uid)),
  };
  await database.recursiveDelete(database.collection("progress").doc(user.uid));
  await database.recursiveDelete(database.collection("learningProgress").doc(user.uid));
  await database.recursiveDelete(database.collection("pushTokens").doc(user.uid));
  await database.collection("adminUserSummaries").doc(user.uid).delete();
  await database.collection("adminUserMeta").doc(user.uid).delete();
  await subscriptionReference.delete();
  await database.collection("users").doc(user.uid).delete();
  await getAdminAuth().deleteUser(user.uid);

  return NextResponse.json({ deleted: true, records: deleted });
}
