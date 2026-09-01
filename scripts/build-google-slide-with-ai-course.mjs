import { access, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const coursePath = join(root, "content/coursiv/courses/google-slide-with-ai.json");
const imageRoot = join(root, "public/images/courses/google-slide-with-ai");
const manifestPath = join(root, "content/coursiv/manifest.json");
const generatedCatalogPath = join(root, "lib/generated/coursiv-catalog.ts");

const lessons = [
  {
    title: "Why Do Slide Presentations Need AI?",
    slug: "why-slide-presentations-need-ai",
    key: "why-ai",
    steps: [
      ["Recognize the friction in presentation work", "Identify where the format slows you down: blank-slide paralysis, dense information, competing visual choices, or pressure to persuade quickly.", "The challenges of creating slide presentations"],
      ["Separate the message from the design burden", "Define the core idea first. Let Gemini accelerate layout, formatting, and visual production while you retain control of the story.", "The visual canvas and its presentation challenges"],
      ["Map each friction point to a Gemini workflow", "Use Gemini to create or edit slides, generate visuals, draft speaker notes, summarize decks, and answer questions about the content.", "Gemini in Google Slides course workflows"],
    ],
    takeaway: "Before designing slides, help me define the audience, the one-sentence outcome, the three-part narrative, and the evidence required for a presentation about [topic].",
  },
  {
    title: "Introduction to Gemini in Google Slides",
    slug: "introduction-to-gemini-in-google-slides",
    key: "introduction",
    steps: [
      ["Open Google Slides with Gemini available", "Open a new or existing presentation and confirm your account has Gemini access. Use Gemini as your design and storytelling partner.", "Introduction to Gemini in Google Slides"],
      ["Choose the right Gemini interface", "Use Ask Gemini for broad requests, Enhance this slide for layouts, and Help me visualize for slides, images, or infographics.", "Ways to interact with Gemini in Slides"],
      ["Configure Workspace Intelligence and sources", "In the prompt box, add relevant Drive, Gmail, Chat, or web sources, then review every result for accuracy and sensitive information.", "Workspace Intelligence and Gemini source settings"],
    ],
    takeaway: "Using @[Drive file], create a five-slide presentation for [audience] that explains [topic]. Use only information supported by the source and flag anything that needs verification.",
  },
  {
    title: "How to Navigate the Rest of This Course",
    slug: "how-to-navigate-this-course",
    key: "course-navigation",
    steps: [
      ["Use Creating workflows when starting a deck", "Choose Creating when you have a blank canvas, rough notes, or a source document that needs to become a structured presentation.", "Creating workflows in the course"],
      ["Use Enhancing workflows when improving a draft", "Choose Enhancing when the deck needs clearer text, better layouts, new visuals, edited images, or stronger speaker notes.", "Enhancing workflows in the course"],
      ["Use Consuming workflows when reviewing or taking action", "Choose Consuming to understand a dense deck, validate it against sources, or transform it into an email, report, or video.", "Consuming workflows in the course"],
    ],
    takeaway: "Blank or notes → Creating; existing draft → Enhancing; completed or unfamiliar deck → Consuming.",
    takeawayTitle: "Decision rule",
    takeawayIntro: "Use this rule to choose the right Gemini workflow.",
  },
  {
    title: "Creating: Generating Presentations and Slides",
    slug: "creating-presentations-and-slides",
    key: "creating",
    steps: [
      ["Strategize the presentation with Ask Gemini", "Define the audience, objective, narrative, number of slides, and desired tone before asking Gemini to generate content.", "Strategize a presentation with Ask Gemini"],
      ["Generate a presentation using trusted sources", "Choose Add sources, attach the relevant Drive files, and ask Gemini to create a presentation plan grounded in those sources.", "Generate a presentation and add sources"],
      ["Review the plan and add slides that match the deck", "Review the structure before generation. Ask Gemini to use the existing deck as style context when adding another slide.", "Add a new slide that matches the existing style"],
    ],
    takeaway: "Create a [number]-slide presentation for [audience] about [topic], grounded in @[source]. Structure it as problem, evidence, recommendation, and next steps. Keep titles concise and match the current deck's visual style.",
  },
  {
    title: "Enhancing: Refining Text and Visuals in Your Slides",
    slug: "enhancing-text-and-visuals",
    key: "enhancing",
    steps: [
      ["Improve an existing slide layout", "Select a slide and use Enhance this slide to generate a cleaner layout. Compare the preview before replacing or inserting it.", "Enhance an existing slide"],
      ["Create a custom visual or infographic", "Open Help me visualize and describe the information, style, aspect ratio, and audience. Use an infographic for processes or data stories.", "Generate a custom infographic"],
      ["Refine the script and speaker notes", "Ask Gemini to shorten crowded slide text, then create speaker notes that add context without repeating the slide word for word.", "Insert speaker notes with Gemini"],
    ],
    takeaway: "Enhance this slide for [audience]. Keep one clear message, reduce the on-slide copy to three concise points, suggest one useful visual, and write 60 seconds of speaker notes that explain the evidence.",
  },
  {
    title: "Consuming: Summarizing and Taking Action",
    slug: "summarizing-and-taking-action",
    key: "consuming",
    steps: [
      ["Summarize the presentation", "Ask Gemini for a concise summary of the deck's purpose, key claims, decisions, risks, and unresolved questions.", "Summarize a presentation with Gemini"],
      ["Ask targeted questions and validate the answers", "Ask about dates, owners, metrics, or recommendations. Compare Gemini's answer with the original source before relying on it.", "Validate a presentation against a source"],
      ["Turn the deck into a follow-up action", "Use the presentation context to draft a follow-up email, create a report in Docs, or convert the material into Google Vids.", "Draft a follow-up email from the deck"],
    ],
    takeaway: "Summarize this presentation in five bullets, list every decision and action item with an owner and deadline, identify claims that require source verification, and draft a follow-up email for the attendees.",
  },
  {
    title: "Conclusion",
    slug: "conclusion",
    key: "conclusion",
    steps: [
      ["Focus on the story and outsource repetitive design work", "Keep ownership of the message and audience outcome. Let Gemini accelerate layouts, formatting, imagery, and first-draft text.", "The two core principles for using Gemini in Slides"],
      ["Treat Gemini as a collaborative editor", "Ask Gemini to critique, shorten, reorganize, or regenerate the content while preserving the facts and your intent.", "Use Gemini as a collaborative editor"],
      ["Apply the workflow to the next real presentation", "Choose a real deck and repeat the full cycle: create, enhance, consume, verify, and present.", "Apply Gemini skills to the next workflow"],
    ],
    takeaway: "Review this deck as a critical presentation coach. Identify the weakest part of the narrative, the three most crowded slides, unsupported claims, and the single revision that would most improve audience understanding.",
  },
  {
    title: "Build Slides Fast with Gemini",
    slug: "build-slides-fast-with-gemini",
    key: "build-slides-fast",
    steps: [
      ["Create an introductory slide with Ask Gemini", "Ask Gemini to create an introductory slide for the presentation's topic, audience, and objective.", "Open Ask Gemini and create an introductory slide"],
      ["Reference a Drive document to create a summary slide", "Use @ to select a Drive file, ask Gemini for a summary slide, preview the result, and select Insert.", "Reference a Drive document and create a summary slide"],
      ["Generate and insert a custom image", "Describe the subject, setting, composition, and style, then insert the generated image that best supports the message.", "Generate and insert a custom image"],
    ],
    takeaway: "Create an introductory slide for [topic] aimed at [audience]. Then use @[Drive file] to create a summary slide. Finally, generate a [style] image of [subject] that supports the main recommendation.",
  },
  {
    title: "Gemini Slide Summaries",
    slug: "gemini-slide-summaries",
    key: "slide-summaries",
    steps: [
      ["Open or copy the sample deck", "Open the presentation. Make a copy if you need to preserve the original, then confirm the Gemini side panel is available.", "Open the sample Google Slides deck"],
      ["Summarize the presentation's purpose and key points", "Ask for a concise summary covering the deck's purpose, themes, evidence, decisions, and open questions.", "Generate a presentation summary"],
      ["Draft a follow-up email", "Keep the presentation context active and ask Gemini for an email with the summary, action items, owners, deadlines, and next steps.", "Draft a follow-up email with action items"],
    ],
    takeaway: "Summarize this deck for someone who missed the meeting. State its purpose, five key points, all decisions, unresolved questions, and action items. Then draft a concise follow-up email with owners and next steps.",
  },
  {
    title: "Presentation Scripts with Gemini",
    slug: "presentation-scripts-with-gemini",
    key: "presentation-scripts",
    steps: [
      ["Research the presentation topic", "Tell Gemini the topic, audience, goal, and constraints. Explore key concepts, examples, opposing viewpoints, and credible evidence.", "Research a presentation topic with Gemini"],
      ["Create a structured outline and export it to Docs", "Ask Gemini for sections with timing, supporting points, examples, and transitions, then export the outline to Google Docs.", "Export a structured presentation outline to Docs"],
      ["Generate talking points in Google Docs", "Ask Gemini in Docs for detailed talking points. Specify the section, tone, audience, and speaking time, then edit for accuracy.", "Create detailed talking points in Google Docs"],
    ],
    takeaway: "Research [topic] for a [duration]-minute presentation to [audience]. Build a timed outline with a hook, three sections, evidence, transitions, and a closing action. Then write natural talking points that do not simply repeat the slides.",
  },
  {
    title: "Presentations in Seconds with Nano Banana Pro",
    slug: "presentations-in-seconds-with-nano-banana-pro",
    key: "nano-banana-presentations",
    steps: [
      ["Select the content to visualize", "Open a slide with text or data that needs stronger visual treatment. For a cover design, create a blank slide.", "Open slide content or a blank cover slide"],
      ["Choose a visualization mode and enter a prompt", "Open Help Me Visualize, select Infographic or Slide, and describe the message, hierarchy, audience, and visual style.", "Choose Infographic or Slide mode and enter a prompt"],
      ["Review and insert the generated design", "Check the result for factual accuracy, legibility, and visual hierarchy, then insert the selected design into the deck.", "Insert the generated presentation design"],
    ],
    takeaway: "Create an infographic based on this slide for [audience]. Preserve every verified fact, establish a clear reading order, use concise labels, and apply a clean [style] visual system with accessible contrast.",
  },
];

function imageBlock(lessonNumber, stepNumber, alt) {
  const lesson = String(lessonNumber).padStart(2, "0");
  const step = String(stepNumber).padStart(2, "0");
  const src = `/images/courses/google-slide-with-ai/lesson-${lesson}-step-${step}.avif`;
  return { alt, id: `google-slides-lesson-${lesson}-step-${step}-image`, localSrc: src, src, type: "image" };
}

function buildLesson(lesson, lessonIndex) {
  const lessonNumber = lessonIndex + 1;
  const sourcePageId = `google-slides-${lesson.key}-page`;
  const instructionScreens = lesson.steps.map(([title, text, alt], stepIndex) => {
    const stepNumber = stepIndex + 1;
    const id = `google-slides-${lesson.key}-step-${stepNumber}`;
    return {
      blocks: [
        { id: `${id}-heading`, level: 2, text: `Step ${stepNumber}: ${title}`, type: "heading" },
        { id: `${id}-text`, text, type: "paragraph" },
        imageBlock(lessonNumber, stepNumber, alt),
      ],
      id,
      interactionPolicy: "read",
      order: stepIndex,
      presentation: "content",
      sourcePageId,
      type: "chunk",
    };
  });
  const takeawayId = `google-slides-${lesson.key}-takeaway`;
  const takeawayScreen = {
    blocks: [
      { id: `${takeawayId}-heading`, level: 2, text: "Step 4: Takeaway", type: "heading" },
      { id: `${takeawayId}-text`, text: lesson.takeawayIntro ?? "Copy this prompt and adapt it to your presentation.", type: "paragraph" },
      { id: `google-slides-lesson-${String(lessonNumber).padStart(2, "0")}-copy-prompt`, text: lesson.takeaway, title: lesson.takeawayTitle ?? "Ready-to-use prompt", tone: "copy-prompt", type: "callout" },
    ],
    id: takeawayId,
    interactionPolicy: "read",
    order: 3,
    presentation: "content",
    sourcePageId,
    type: "chunk",
  };
  const screens = [...instructionScreens, takeawayScreen];
  return {
    blocks: screens.flatMap((screen) => screen.blocks),
    hasAudio: false,
    order: lessonNumber,
    raw: {},
    readUrl: `/course/google-slide-with-ai/lesson/${lesson.slug}`,
    schemaVersion: 3,
    screens,
    slug: lesson.slug,
    sourceGuideId: "coursiv-original-google-slide-with-ai",
    sourceId: `google-slides-${lesson.key}`,
    sourceUnitId: "google-slide-with-ai-essentials",
    title: lesson.title,
  };
}

for (let lessonNumber = 1; lessonNumber <= lessons.length; lessonNumber += 1) {
  for (let stepNumber = 1; stepNumber <= 3; stepNumber += 1) {
    await access(join(imageRoot, `lesson-${String(lessonNumber).padStart(2, "0")}-step-${String(stepNumber).padStart(2, "0")}.avif`));
  }
}

const previous = JSON.parse(await readFile(coursePath, "utf8"));
const course = {
  ...previous,
  units: [{ lessons: lessons.map(buildLesson), order: 1, sourceId: "google-slide-with-ai-essentials", title: "Google Slides Essentials" }],
};
await writeFile(coursePath, `${JSON.stringify(course, null, 2)}\n`);

const catalogEntry = {
  id: course.id,
  sourceId: course.sourceId,
  kind: course.kind,
  title: course.title,
  duration: course.duration,
  categories: course.categories,
  ...(course.sourceUpdatedAt ? { sourceUpdatedAt: course.sourceUpdatedAt } : {}),
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
const arrayEnd = generatedSource.lastIndexOf("];");
if (arrayStart === -1 || arrayEnd === -1) throw new Error("Could not parse generated Coursiv catalog.");
const generatedCatalog = JSON.parse(generatedSource.slice(arrayStart, arrayEnd + 1));
const generatedIndex = generatedCatalog.findIndex((entry) => entry.id === course.id);
if (generatedIndex === -1) generatedCatalog.push(catalogEntry);
else generatedCatalog[generatedIndex] = catalogEntry;
await writeFile(generatedCatalogPath, `${generatedSource.slice(0, arrayStart)}${JSON.stringify(generatedCatalog, null, 2)};\n`);

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const manifestEntry = { duration: course.duration, file: `courses/${course.id}.json`, id: course.id, kind: course.kind, lessonCount: lessons.length, sourceId: course.sourceId, title: course.title };
const manifestIndex = manifest.courses.findIndex((entry) => entry.id === course.id);
if (manifestIndex === -1) manifest.courses.push(manifestEntry);
else manifest.courses[manifestIndex] = manifestEntry;
const courseFiles = (await readdir(join(root, "content/coursiv/courses"))).filter((file) => file.endsWith(".json"));
const courses = await Promise.all(courseFiles.map(async (file) => JSON.parse(await readFile(join(root, "content/coursiv/courses", file), "utf8"))));
manifest.totals.courses = courses.length;
manifest.totals.lessons = courses.reduce((total, item) => total + item.units.reduce((unitTotal, unit) => unitTotal + unit.lessons.length, 0), 0);
manifest.totals.screens = courses.reduce((total, item) => total + item.units.reduce((unitTotal, unit) => unitTotal + unit.lessons.reduce((lessonTotal, lesson) => lessonTotal + lesson.screens.length, 0), 0), 0);
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Built and indexed ${lessons.length} Google Slide with AI lessons at ${coursePath}`);
