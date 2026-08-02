export type FirebaseActionMode = "resetPassword" | "verifyEmail" | "recoverEmail";

export function parseFirebaseAction(search: Pick<URLSearchParams, "get">) {
  const mode = search.get("mode");
  const code = search.get("oobCode")?.trim() ?? "";
  const continueUrl = search.get("continueUrl");
  const supported = mode === "resetPassword" || mode === "verifyEmail" || mode === "recoverEmail";
  return {
    mode: supported ? mode as FirebaseActionMode : null,
    code,
    continueUrl: continueUrl?.startsWith("/") && !continueUrl.startsWith("//") ? continueUrl : null,
    valid: supported && code.length > 0,
  };
}

export function friendlyAuthError(reason: unknown) {
  const code = typeof reason === "object" && reason && "code" in reason ? String(reason.code) : "";
  if (code.includes("expired-action-code")) return "This recovery link has expired. Request a new one.";
  if (code.includes("invalid-action-code")) return "This recovery link is invalid or has already been used.";
  if (code.includes("weak-password")) return "Use a password with at least 8 characters.";
  if (code.includes("too-many-requests")) return "Too many attempts. Wait a few minutes and try again.";
  if (code.includes("invalid-email")) return "Enter a valid email address.";
  return reason instanceof Error ? reason.message : "Unable to complete account recovery.";
}
