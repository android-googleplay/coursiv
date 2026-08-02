import "server-only";

import { getAdminAuth, getAdminDb, isFirebaseAdminConfigured } from "./firebase-admin";
import type { AdminUserSummary, SubscriptionRecord } from "./types";
import { buildAdminUserSearchIndex } from "./admin-user-search";

export async function refreshAdminUserSummary(uid: string) {
  if (!isFirebaseAdminConfigured()) return null;
  const database = getAdminDb();
  const [authUser, user, subscription, certificates, tickets, lessons, meta] = await Promise.all([
    getAdminAuth().getUser(uid),
    database.collection("users").doc(uid).get(),
    database.collection("subscriptions").doc(uid).get(),
    database.collection("certificates").where("userId", "==", uid).count().get(),
    database.collection("supportTickets").where("userId", "==", uid).where("status", "in", ["open", "in_progress", "waiting_for_user"]).count().get(),
    database.collection("learningProgress").doc(uid).collection("lessons").get(),
    database.collection("adminUserMeta").doc(uid).get(),
  ]);
  const subscriptionData = subscription.exists ? subscription.data() as SubscriptionRecord : null;
  const summary: AdminUserSummary & { updatedAt: string } = {
    id: uid,
    email: authUser.email ?? "",
    displayName: authUser.displayName ?? authUser.email?.split("@")[0] ?? "Member",
    registeredAt: authUser.metadata.creationTime ? new Date(authUser.metadata.creationTime).toISOString() : "",
    lastActiveAt: authUser.metadata.lastSignInTime ? new Date(authUser.metadata.lastSignInTime).toISOString() : "",
    onboardingCompleted: Boolean(user.data()?.onboardingCompleted),
    subscriptionStatus: subscriptionData?.status ?? "none",
    currentPeriodEnd: subscriptionData?.currentPeriodEnd ?? null,
    certificateCount: certificates.data().count,
    completedLessonCount: lessons.docs.filter((document) => Boolean(document.data().completedAt)).length,
    openTicketCount: tickets.data().count,
    accountStatus: authUser.disabled ? "suspended" : "active",
    tags: meta.data()?.tags ?? [],
    updatedAt: new Date().toISOString(),
  };
  await database.collection("adminUserSummaries").doc(uid).set({ ...summary, ...buildAdminUserSearchIndex(summary) });
  return summary;
}
