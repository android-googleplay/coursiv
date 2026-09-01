import { access, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const courseId = "google-sheet-with-ai-shorts";
const coursePath = join(root, "content/coursiv/courses", `${courseId}.json`);
const videoRoot = join(root, "public/shorts/google-sheet-with-ai");
const manifestPath = join(root, "content/coursiv/manifest.json");
const generatedCatalogPath = join(root, "lib/generated/coursiv-catalog.ts");

const lessons = [
  {
    slug: "use-gemini-in-google-sheets",
    title: "Use Gemini in Google Sheets",
    video: "how-to-use-gemini-in-google-sheets.mp4",
    sourceFile: "How to use Google Gemini in Google Sheets.mp4",
    prompt: "Help me use Gemini in Google Sheets for [task]. Explain which cells or range to select, give me the exact prompt to enter, and tell me how to verify the result.",
  },
  {
    slug: "work-smarter-in-google-sheets",
    title: "Work Smarter in Google Sheets",
    video: "work-smarter-in-google-sheets.mp4",
    sourceFile: "Work Smarter Not Harder in Google Sheets.mp4",
    prompt: "Review this Google Sheet workflow for [task]. Identify three repetitive steps I can simplify with formulas, Gemini, or automation, and give me the fastest implementation order.",
  },
  {
    slug: "create-a-table-with-one-prompt",
    title: "Create a Table with One Prompt",
    video: "create-a-table-with-one-prompt.mp4",
    sourceFile: "Google Sheets Hack You Must Know  Create a table with Only One Prompt  Gemini AI Tutorial.mp4",
    prompt: "Create a [type] table in Google Sheets with columns for [fields]. Add [number] realistic sample rows, format the headers, and suggest useful dropdowns or data validation.",
  },
  {
    slug: "build-a-google-sheets-agent",
    title: "Build a Google Sheets Agent with WhatsApp, ChatGPT and n8n",
    video: "build-a-google-sheets-agent.mp4",
    sourceFile: "Build your first Google sheets Agent only with WhatsApp and ChatGPT in #n8n #aiautomation (NO CODE).mp4",
    prompt: "Design a no-code Google Sheets agent that receives WhatsApp messages, sends the request to ChatGPT, and reads or updates Google Sheets through n8n. List the nodes, field mappings, credentials, safety checks, and a test message.",
  },
];

function buildLesson(lesson, index) {
  const order = index + 1;
  const screenId = `google-sheet-shorts-${order}`;
  const blocks = [
    {
      id: `${screenId}-video`,
      type: "video",
      src: `/shorts/google-sheet-with-ai/${lesson.video}`,
    },
    {
      id: `${screenId}-copy-prompt`,
      type: "callout",
      title: "Try this prompt",
      text: lesson.prompt,
      tone: "copy-prompt",
    },
  ];
  return {
    schemaVersion: 3,
    sourceId: screenId,
    sourceUnitId: "google-sheet-with-ai-shorts-feed",
    sourceGuideId: "coursiv-original-google-sheet-with-ai-shorts",
    slug: lesson.slug,
    title: lesson.title,
    order,
    readUrl: `/course/${courseId}/lesson/${lesson.slug}`,
    hasAudio: false,
    screens: [{
      id: screenId,
      sourcePageId: `${screenId}-page`,
      order: 0,
      type: "chunk",
      presentation: "media",
      interactionPolicy: "read",
      blocks,
    }],
    blocks,
    raw: { sourceFile: lesson.sourceFile },
  };
}

for (const lesson of lessons) await access(join(videoRoot, lesson.video));

const course = {
  schemaVersion: 3,
  id: courseId,
  sourceId: "coursiv-original-google-sheet-with-ai-shorts",
  kind: "tool",
  title: "Google Sheet with AI (Shorts)",
  duration: "4 shorts",
  categories: ["New", "Productivity", "Shorts"],
  units: [{
    sourceId: "google-sheet-with-ai-shorts-feed",
    title: "Shorts Feed",
    order: 1,
    lessons: lessons.map(buildLesson),
  }],
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
    lessons: unit.lessons.map((lesson) => ({
      id: lesson.slug,
      sourceId: lesson.sourceId,
      title: lesson.title,
      screenIds: lesson.screens.map((screen) => screen.id),
      hasAudio: lesson.hasAudio,
    })),
  })),
};

const generatedSource = await readFile(generatedCatalogPath, "utf8");
const assignmentMarker = "export const coursivCatalog: CoursivCatalogEntry[] = ";
const assignmentStart = generatedSource.indexOf(assignmentMarker);
const arrayStart = assignmentStart === -1 ? -1 : assignmentStart + assignmentMarker.length;
const arrayEnd = generatedSource.lastIndexOf("];" );
if (arrayStart === -1 || arrayEnd === -1) throw new Error("Could not parse generated Coursiv catalog.");
const generatedCatalog = JSON.parse(generatedSource.slice(arrayStart, arrayEnd + 1));
const generatedIndex = generatedCatalog.findIndex((entry) => entry.id === course.id);
if (generatedIndex === -1) generatedCatalog.push(catalogEntry);
else generatedCatalog[generatedIndex] = catalogEntry;
await writeFile(generatedCatalogPath, `${generatedSource.slice(0, arrayStart)}${JSON.stringify(generatedCatalog, null, 2)};\n`);

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const manifestEntry = {
  duration: course.duration,
  file: `courses/${course.id}.json`,
  id: course.id,
  kind: course.kind,
  lessonCount: lessons.length,
  sourceId: course.sourceId,
  title: course.title,
};
const manifestIndex = manifest.courses.findIndex((entry) => entry.id === course.id);
if (manifestIndex === -1) manifest.courses.push(manifestEntry);
else manifest.courses[manifestIndex] = manifestEntry;

const courseFiles = (await readdir(join(root, "content/coursiv/courses"))).filter((file) => file.endsWith(".json"));
const courses = await Promise.all(courseFiles.map(async (file) => JSON.parse(await readFile(join(root, "content/coursiv/courses", file), "utf8"))));
manifest.totals.courses = courses.length;
manifest.totals.lessons = courses.reduce((total, item) => total + item.units.reduce((unitTotal, unit) => unitTotal + unit.lessons.length, 0), 0);
manifest.totals.screens = courses.reduce((total, item) => total + item.units.reduce((unitTotal, unit) => unitTotal + unit.lessons.reduce((lessonTotal, lesson) => lessonTotal + lesson.screens.length, 0), 0), 0);
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Built and indexed ${lessons.length} Google Sheet with AI Shorts lessons at ${coursePath}`);
