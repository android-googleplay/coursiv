import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import type { CoursivCourse } from "../coursiv-content";
import { coursivMediaUrl } from "../coursiv-media-url";
import type { MediaAsset } from "./types";

type CanonicalManifest = {
  scrapedAt?: string;
  courses: Array<{ file: string }>;
};

const mimeTypes: Record<string, string> = {
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".webm": "video/webm",
  ".webp": "image/webp",
};

function mediaExtension(value: string) {
  try {
    return extname(new URL(value, "https://coursiv.local").pathname).toLowerCase();
  } catch {
    return extname(value.split("?")[0]).toLowerCase();
  }
}

function mediaChecksum(value: string) {
  const filename = basename(value.split("?")[0], mediaExtension(value));
  return /^[a-f0-9]{64}$/i.test(filename)
    ? filename.toLowerCase()
    : createHash("sha256").update(value).digest("hex");
}

export function collectCanonicalMediaAssets(
  courses: CoursivCourse[],
  importedAt = "1970-01-01T00:00:00.000Z",
) {
  const assets = new Map<string, MediaAsset>();

  for (const course of courses) {
    const courseCover = course.localImage || course.image;
    if (courseCover) {
      const extension = mediaExtension(courseCover);
      const mimeType = mimeTypes[extension];
      if (mimeType?.startsWith("image/")) {
        const checksum = mediaChecksum(courseCover);
        assets.set(checksum, {
          id: `canonical-${checksum.slice(0, 24)}`,
          name: `Course cover — ${course.title}${extension}`,
          path: courseCover,
          url: coursivMediaUrl(courseCover) ?? courseCover,
          mimeType,
          bytes: 0,
          checksum,
          uploadedBy: "canonical-import",
          createdAt: importedAt,
          usagePaths: [`course:${course.id}:cover`],
        });
      }
    }
    for (const unit of course.units) {
      for (const lesson of unit.lessons) {
        for (const [screenIndex, screen] of lesson.screens.entries()) {
          for (const block of screen.blocks) {
            if (block.type !== "image" && block.type !== "video") continue;
            const source = block.type === "image" ? block.localSrc || block.src : block.src;
            if (!source) continue;
            const extension = mediaExtension(source);
            const mimeType = mimeTypes[extension];
            if (!mimeType) continue;
            const checksum = mediaChecksum(source);
            const usagePath = `course:${course.id}:lesson:${lesson.slug}:screen:${screen.id}:block:${block.id}`;
            const current = assets.get(checksum);
            if (current) {
              if (!current.usagePaths?.includes(usagePath)) current.usagePaths = [...(current.usagePaths ?? []), usagePath];
              continue;
            }
            assets.set(checksum, {
              id: `canonical-${checksum.slice(0, 24)}`,
              name: `Screen ${screenIndex + 1} — ${lesson.title} · ${course.title}${extension}`,
              path: source,
              url: coursivMediaUrl(source) ?? source,
              mimeType,
              bytes: 0,
              checksum,
              uploadedBy: "canonical-import",
              createdAt: importedAt,
              usagePaths: [usagePath],
            });
          }
        }
      }
    }
  }

  return [...assets.values()];
}

let canonicalAssetsPromise: Promise<MediaAsset[]> | null = null;

export function listCanonicalMediaAssets() {
  canonicalAssetsPromise ??= (async () => {
    const contentRoot = join(process.cwd(), "content", "coursiv");
    const manifest = JSON.parse(await readFile(join(contentRoot, "manifest.json"), "utf8")) as CanonicalManifest;
    const courses = await Promise.all(
      manifest.courses.map(async ({ file }) => JSON.parse(await readFile(join(contentRoot, file), "utf8")) as CoursivCourse),
    );
    const assets = collectCanonicalMediaAssets(courses, manifest.scrapedAt);
    await Promise.all(assets.map(async (asset) => {
      if (!asset.url.startsWith("/")) return;
      try {
        asset.bytes = (await stat(join(process.cwd(), "public", asset.url))).size;
      } catch {
        asset.bytes = 0;
      }
    }));
    return assets;
  })();
  return canonicalAssetsPromise;
}

export function mergeMediaAssets(...groups: MediaAsset[][]) {
  const merged = new Map<string, MediaAsset>();
  for (const group of groups) {
    for (const asset of group) {
      const current = merged.get(asset.checksum);
      merged.set(asset.checksum, current
        ? { ...current, ...asset, usagePaths: [...new Set([...(current.usagePaths ?? []), ...(asset.usagePaths ?? [])])] }
        : asset);
    }
  }
  return [...merged.values()];
}
