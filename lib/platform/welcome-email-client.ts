"use client";

export async function queueWelcomeEmail(idToken: string | null) {
  if (!idToken) return { status: "skipped" as const };
  const response = await fetch("/api/auth/welcome", {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const data = await response.json().catch(() => null) as { status?: "queued" | "sent" | "failed"; error?: string } | null;
  if (!response.ok) throw new Error(data?.error ?? "Welcome email could not be queued");
  return { status: data?.status ?? "queued" };
}
