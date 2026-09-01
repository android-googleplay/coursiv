import { access, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const courseId = "google-slide-with-ai-short";
const coursePath = join(root, "content/coursiv/courses", `${courseId}.json`);
const videoRoot = join(root, "public/shorts/google-slide-with-ai");
const manifestPath = join(root, "content/coursiv/manifest.json");
const generatedCatalogPath = join(root, "lib/generated/coursiv-catalog.ts");

const lessons = [
  {
    slug: "how-to-use-gemini-in-google-slides",
    title: "How to Use Gemini in Google Slides",
    video: "how-to-use-gemini-in-google-slides.mp4",
    sourceFile: "How to use Google Gemini in Google Slides.mp4",
    prompt: "Help me use Gemini in Google Slides for [presentation task]. Give me the exact prompt to enter, tell me which slide or source file to select, and explain how to verify the result before presenting.",
  },
  {
    slug: "create-stunning-presentations-in-minutes",
    title: "Create Stunning Presentations in Minutes",
    video: "create-stunning-presentations-in-minutes.mp4",
    sourceFile: "Create stunning presentations in minutes with Gemini in Google Slides!.mp4",
    prompt: "Create a [number]-slide presentation for [audience] about [topic]. Use a clear story from problem to evidence to recommendation, keep each slide concise, and suggest one useful visual for every slide.",
  },
  {
    slug: "create-faster-work-smarter-visualize-everything",
    title: "Create Faster, Work Smarter, Visualize Everything",
    video: "create-faster-work-smarter-visualize-everything.mp4",
    sourceFile: "Create faster. Work smarter. Visualize everything with Gemini in Google Slides.mp4",
    prompt: "Review this Google Slides deck for [audience]. Improve the structure, shorten crowded text, recommend stronger layouts and visuals, and list the three changes that will create the biggest improvement fastest.",
  },
];

function buildLesson(lesson, index) {
  const order = index + 1;
  const screenId = `google-slide-short-${order}`;
  const blocks = [
    { id: `${screenId}-video`, type: "video", src: `/shorts/google-slide-with-ai/${lesson.video}` },
    { id: `${screenId}-copy-prompt`, type: "callout", title: "Try this prompt", text: lesson.prompt, tone: "copy-prompt" },
  ];
  return {
    schemaVersion: 3,
    sourceId: screenId,
    sourceUnitId: "google-slide-with-ai-short-feed",
    sourceGuideId: "coursiv-original-google-slide-with-ai-short",
    slug: lesson.slug,
    title: lesson.title,
    order,
    readUrl: `/course/${courseId}/lesson/${lesson.slug}`,
    hasAudio: false,
    screens: [{ id: screenId, sourcePageId: `${screenId}-page`, order: 0, type: "chunk", presentation: "media", interactionPolicy: "read", blocks }],
    blocks,
    raw: { sourceFile: lesson.sourceFile },
  };
}

for (const lesson of lessons) await access(join(videoRoot, lesson.video));

const course = {
  schemaVersion: 3,
  id: courseId,
  sourceId: "coursiv-original-google-slide-with-ai-short",
  kind: "tool",
  title: "Google Slide with AI (Short)",
  duration: "3 shorts",
  categories: ["New", "Productivity", "Shorts"],
  units: [{ sourceId: "google-slide-with-ai-short-feed", title: "Shorts Feed", order: 1, lessons: lessons.map(buildLesson) }],
};
await writeFile(coursePath, `${JSON.stringify(course, null, 2)}\n`);

const catalogEntry = {
  id: course.id,
  sourceId: course.sourceId,
  kind: course.kind,
  title: course.title,
  duration: course.duration,
  categories: course.categories,
  sections: course.units.map((unit) => ({
    title: unit.title,
    sourceId: unit.sourceId,
    lessons: unit.lessons.map((lesson) => ({ id: lesson.slug, sourceId: lesson.sourceId, title: lesson.title, screenIds: lesson.screens.map((screen) => screen.id), hasAudio: lesson.hasAudio })),
  })),
};
const generatedSource = await readFile(generatedCatalogPath, "utf8");
const marker = "export const coursivCatalog: CoursivCatalogEntry[] = ";
const markerStart = generatedSource.indexOf(marker);
const arrayStart = markerStart === -1 ? -1 : markerStart + marker.length;
const arrayEnd = generatedSource.lastIndexOf("];" );
if (arrayStart === -1 || arrayEnd === -1) throw new Error("Could not parse generated Coursiv catalog.");
const generatedCatalog = JSON.parse(generatedSource.slice(arrayStart, arrayEnd + 1));
const generatedIndex = generatedCatalog.findIndex((entry) => entry.id === course.id);
if (generatedIndex === -1) generatedCatalog.push(catalogEntry); else generatedCatalog[generatedIndex] = catalogEntry;
await writeFile(generatedCatalogPath, `${generatedSource.slice(0, arrayStart)}${JSON.stringify(generatedCatalog, null, 2)};\n`);

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const manifestEntry = { duration: course.duration, file: `courses/${course.id}.json`, id: course.id, kind: course.kind, lessonCount: lessons.length, sourceId: course.sourceId, title: course.title };
const manifestIndex = manifest.courses.findIndex((entry) => entry.id === course.id);
if (manifestIndex === -1) manifest.courses.push(manifestEntry); else manifest.courses[manifestIndex] = manifestEntry;
const courseFiles = (await readdir(join(root, "content/coursiv/courses"))).filter((file) => file.endsWith(".json"));
const courses = await Promise.all(courseFiles.map(async (file) => JSON.parse(await readFile(join(root, "content/coursiv/courses", file), "utf8"))));
manifest.totals.courses = courses.length;
manifest.totals.lessons = courses.reduce((total, item) => total + item.units.reduce((unitTotal, unit) => unitTotal + unit.lessons.length, 0), 0);
manifest.totals.screens = courses.reduce((total, item) => total + item.units.reduce((unitTotal, unit) => unitTotal + unit.lessons.reduce((lessonTotal, lesson) => lessonTotal + lesson.screens.length, 0), 0), 0);
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Built and indexed ${lessons.length} Google Slide with AI Short video lessons at ${coursePath}`);
