import { slugifyCoursiv } from "../coursiv-content";

export function cmsAuthorSlug(
  value: string,
  kind: "course" | "lesson",
  createId: () => string,
) {
  const slug = slugifyCoursiv(value);
  if (slug !== "lesson" || value.trim().toLowerCase() === "lesson") return slug;
  const suffix = createId().replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase();
  return `${kind}-${suffix || "content"}`;
}
