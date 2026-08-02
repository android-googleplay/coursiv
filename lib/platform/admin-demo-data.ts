import type { AdminOverview, SubscriptionRecord, UserProfile } from "./types";

export const demoOverview: AdminOverview = { activeMembers: 1284, trialMembers: 173, monthlyRecurringRevenue: 18640, failedPayments: 24, quizToCheckoutRate: 18.7, checkoutToPaidRate: 42.3, lessonCompletionRate: 61.8 };
export const demoUsers: UserProfile[] = [
  { id:"usr_1", email:"amy@example.com", displayName:"Amy Chen", role:"member", createdAt:"2026-07-18", lastActiveAt:"2026-07-21T09:42:00+08:00", onboardingCompleted:true },
  { id:"usr_2", email:"marcus@example.com", displayName:"Marcus Lee", role:"member", createdAt:"2026-07-17", lastActiveAt:"2026-07-21T08:15:00+08:00", onboardingCompleted:true },
  { id:"usr_3", email:"sarah@example.com", displayName:"Sarah Wong", role:"editor", createdAt:"2026-07-12", lastActiveAt:"2026-07-20T22:04:00+08:00", onboardingCompleted:false },
];
export const demoSubscriptions: SubscriptionRecord[] = [
  { id:"sub_1", userId:"usr_1", stripeCustomerId:"cus_demo_1", stripeSubscriptionId:"sub_demo_1", status:"active", priceId:"weekly", currentPeriodEnd:"2026-07-28", cancelAtPeriodEnd:false, updatedAt:"2026-07-21" },
  { id:"sub_2", userId:"usr_2", stripeCustomerId:"cus_demo_2", stripeSubscriptionId:"sub_demo_2", status:"past_due", priceId:"weekly", currentPeriodEnd:"2026-07-22", cancelAtPeriodEnd:false, updatedAt:"2026-07-21" },
  { id:"sub_3", userId:"usr_3", stripeCustomerId:"cus_demo_3", stripeSubscriptionId:"sub_demo_3", status:"trialing", priceId:"weekly", currentPeriodEnd:"2026-07-25", cancelAtPeriodEnd:false, updatedAt:"2026-07-20" },
];
