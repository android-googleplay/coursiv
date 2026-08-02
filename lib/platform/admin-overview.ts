import "server-only";

import { demoOverview, demoSubscriptions, demoUsers } from "./admin-demo-data";
import { demoCertificates } from "@/lib/certificates";
import { getAdminDb, isFirebaseAdminConfigured } from "./firebase-admin";
import type { StaffActor } from "./admin-auth";
import type { AdminOverview, SubscriptionRecord, SupportTicket } from "./types";

export type AdminDashboardSnapshot = AdminOverview & {
  totalUsers: number;
  certificateCount: number;
  openTickets: number;
  lessonsCompleted: number;
  content: { courses: number; lessons: number; screens: number };
  recentSubscriptions: SubscriptionRecord[];
  generatedAt: string;
};

export async function getAdminOverview(actor: StaffActor): Promise<AdminDashboardSnapshot> {
  if (actor.debug || !isFirebaseAdminConfigured()) {
    return {
      ...demoOverview,
      totalUsers: demoUsers.length,
      certificateCount: demoCertificates.length,
      openTickets: 1,
      lessonsCompleted: 18,
      content: { courses: 37, lessons: 343, screens: 8925 },
      recentSubscriptions: demoSubscriptions.slice(0, 8),
      generatedAt: new Date().toISOString(),
    };
  }
  const database = getAdminDb();
  const [usersCount, certificatesCount, summaries, subscriptions, tickets, metadata] = await Promise.all([
    database.collection("adminUserSummaries").count().get(),
    database.collection("certificates").count().get(),
    database.collection("adminUserSummaries").get(),
    database.collection("subscriptions").orderBy("updatedAt", "desc").limit(1000).get(),
    database.collection("supportTickets").where("status", "in", ["open", "in_progress", "waiting_for_user"]).get(),
    database.collection("contentMetadata").doc("learner-app").get(),
  ]);
  const subscriptionRows = subscriptions.docs.map((document) => ({ id: document.id, ...document.data() }) as SubscriptionRecord & { monthlyAmount?: number; amount?: number });
  const activeMembers = subscriptionRows.filter((item) => item.status === "active").length;
  const trialMembers = subscriptionRows.filter((item) => item.status === "trialing").length;
  const failedPayments = subscriptionRows.filter((item) => item.status === "past_due" || item.status === "unpaid").length;
  const monthlyRecurringRevenue = subscriptionRows
    .filter((item) => item.status === "active" || item.status === "trialing")
    .reduce((sum, item) => sum + (item.monthlyAmount ?? (item.amount ? item.amount / 100 : 0)), 0);
  const summaryRows = summaries.docs.map((document) => document.data());
  const lessonsCompleted = summaryRows.reduce((sum, item) => sum + Number(item.completedLessonCount ?? 0), 0);
  const totalUsers = usersCount.data().count || summaryRows.length;
  const paidBase = Math.max(1, activeMembers + trialMembers);
  const counts = metadata.data()?.counts ?? {};
  return {
    activeMembers,
    trialMembers,
    monthlyRecurringRevenue: Math.round(monthlyRecurringRevenue * 100) / 100,
    failedPayments,
    quizToCheckoutRate: 0,
    checkoutToPaidRate: totalUsers ? Math.round((paidBase / totalUsers) * 1000) / 10 : 0,
    lessonCompletionRate: totalUsers ? Math.round((summaryRows.filter((item) => Number(item.completedLessonCount ?? 0) > 0).length / totalUsers) * 1000) / 10 : 0,
    totalUsers,
    certificateCount: certificatesCount.data().count,
    openTickets: tickets.docs.filter((document) => ["open", "in_progress", "waiting_for_user"].includes((document.data() as SupportTicket).status)).length,
    lessonsCompleted,
    content: { courses: Number(counts.courses ?? 0), lessons: Number(counts.lessons ?? 0), screens: Number(counts.screens ?? 0) },
    recentSubscriptions: subscriptionRows.slice(0, 8),
    generatedAt: new Date().toISOString(),
  };
}
