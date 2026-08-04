const LOCAL_MEDIA_PREFIX = "/coursiv-media/";

export function coursivMediaUrl(value?: string) {
  if (!value || !value.startsWith(LOCAL_MEDIA_PREFIX)) return value;
  const configuredBase = process.env.NEXT_PUBLIC_COURSIV_MEDIA_BASE_URL?.replace(/\/$/, "");
  return configuredBase ? `${configuredBase}/${value.slice(LOCAL_MEDIA_PREFIX.length)}` : value;
}
