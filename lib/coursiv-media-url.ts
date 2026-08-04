const LOCAL_MEDIA_PREFIX = "/coursiv-media/";
const FIREBASE_MEDIA_BASE = "https://courseai-73920.web.app/coursiv-media";

export function coursivMediaUrl(value?: string) {
  if (!value || !value.startsWith(LOCAL_MEDIA_PREFIX)) return value;
  const configuredBase = (process.env.NEXT_PUBLIC_COURSIV_MEDIA_BASE_URL || (process.env.NODE_ENV === "production" ? FIREBASE_MEDIA_BASE : "")).replace(/\/$/, "");
  return configuredBase ? `${configuredBase}/${value.slice(LOCAL_MEDIA_PREFIX.length)}` : value;
}
