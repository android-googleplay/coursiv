const INTERNAL_PATH = /^\/(?!\/)[^\\\u0000-\u001f]*$/;

export function safeAuthDestination(value: string | null | undefined, fallback = "/dashboard") {
  return value && INTERNAL_PATH.test(value) ? value : fallback;
}

export function isAdminDestination(value: string) {
  return value === "/admin" || value.startsWith("/admin/");
}
