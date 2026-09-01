export type UserRole = "member" | "editor" | "support" | "admin";
export type StaffRole = "admin" | "editor" | "support" | "analyst";
export type SubscriptionStatus = "none" | "trialing" | "active" | "past_due" | "canceled" | "unpaid";
export type ContentStatus = "draft" | "scheduled" | "published" | "archived";

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
  lastActiveAt: string;
  onboardingCompleted: boolean;
}

export interface SubscriptionRecord {
  id: string;
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status: SubscriptionStatus;
  priceId: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  updatedAt: string;
}

export interface CmsLesson {
  id: string;
  courseId: string;
  title: string;
  order: number;
  status: ContentStatus;
  artworkUrl?: string;
  estimatedMinutes: number;
  screens: CmsLessonScreen[];
  updatedAt: string;
}

export interface CmsLessonScreen {
  id: string;
  type: "text" | "image" | "quiz" | "task" | "summary";
  title?: string;
  body?: string;
  imageUrl?: string;
  choices?: { id: string; label: string; correct?: boolean }[];
}

export interface FunnelEvent {
  id: string;
  userId?: string;
  anonymousId: string;
  name: "landing_viewed" | "quiz_started" | "quiz_completed" | "email_captured" | "paywall_viewed" | "checkout_started" | "purchase_completed" | "onboarding_completed" | "lesson_started" | "lesson_completed" | "subscription_canceled";
  properties: Record<string, string | number | boolean | null>;
  occurredAt: string;
}

export interface AdminOverview {
  activeMembers: number;
  trialMembers: number;
  monthlyRecurringRevenue: number;
  failedPayments: number;
  quizToCheckoutRate: number;
  checkoutToPaidRate: number;
  lessonCompletionRate: number;
}

export interface IssuedCertificate {
  id: string;
  credentialId: string;
  userId: string;
  recipientEmail: string;
  learnerName: string;
  courseId: string;
  courseTitle: string;
  courseHours: number;
  issuedAt: string;
  visibility: "public" | "private";
  emailStatus: "not_configured" | "queued" | "sent" | "failed";
  emailId?: string;
}

export interface WelcomeEmailDelivery {
  id: string;
  userId: string;
  recipientEmail: string;
  recipientName: string;
  templateVersion: 1;
  status: "queued" | "sent" | "failed";
  attempts: number;
  providerMessageId?: string | null;
  lastErrorCode?: string | null;
  createdAt: string;
  updatedAt: string;
  sentAt?: string | null;
}

export interface SupportTicket {
  id: string;
  userId: string;
  email: string | null;
  type: "support" | "feedback";
  message: string;
  status: "open" | "in_progress" | "waiting_for_user" | "resolved" | "closed";
  priority?: "low" | "normal" | "high" | "urgent";
  assigneeId?: string | null;
  tags?: string[];
  subject?: string;
  firstResponseAt?: string | null;
  slaDueAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  lastMessageAt?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  notificationStatus: "not_configured" | "sent" | "failed";
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderType: "user" | "staff" | "email" | "system";
  senderId?: string | null;
  senderEmail?: string | null;
  channel: "app" | "email" | "internal";
  bodyText: string;
  bodyHtml?: string;
  internal: boolean;
  attachments: { id: string; filename: string; contentType: string; size?: number; url?: string }[];
  providerMessageId?: string;
  deliveryStatus?: "queued" | "sent" | "delivered" | "bounced" | "failed" | "received";
  createdAt: string;
}

export interface AdminUserSummary {
  id: string;
  email: string;
  displayName: string;
  registeredAt: string;
  lastActiveAt: string;
  onboardingCompleted: boolean;
  subscriptionStatus: SubscriptionStatus;
  currentPeriodEnd: string | null;
  certificateCount: number;
  completedLessonCount: number;
  openTicketCount: number;
  accountStatus: "active" | "suspended" | "deleted";
  tags: string[];
}

export interface MediaAsset {
  id: string;
  name?: string;
  path: string;
  url: string;
  mimeType: string;
  bytes: number;
  width?: number;
  height?: number;
  checksum: string;
  uploadedBy: string;
  createdAt: string;
  usagePaths?: string[];
}
