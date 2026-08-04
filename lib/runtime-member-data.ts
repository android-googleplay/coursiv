import type { RuntimeCatalogEntry } from "./coursiv-content.server";
import type { CatalogItem, CourseDefinition } from "./member-data";
import { coursivMediaUrl } from "./coursiv-media-url";

export function runtimeCatalogItem(entry: RuntimeCatalogEntry): CatalogItem {
  return {
    id: entry.id,
    kind: entry.kind,
    title: entry.title,
    categories: entry.categories,
    lessonCount: entry.sections.reduce((total, section) => total + section.lessons.length, 0),
    duration: entry.duration,
    status: "available",
    image: coursivMediaUrl(entry.image || entry.localImage),
  };
}

export function runtimeCourseDefinition(entry: RuntimeCatalogEntry): CourseDefinition {
  return {
    id: entry.id,
    programId: entry.kind === "tool" ? "tool-library" : "use-case-library",
    title: entry.title,
    duration: entry.duration,
    color: "#6d63f2",
    image: coursivMediaUrl(entry.image || entry.localImage),
    sections: entry.sections.map((section) => ({
      title: section.title,
      lessons: section.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        implemented: true,
        sourceId: lesson.sourceId,
        screenIds: lesson.screenIds,
        hasAudio: lesson.hasAudio,
      })),
    })),
  };
}
