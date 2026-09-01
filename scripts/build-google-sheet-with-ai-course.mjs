import { access, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const coursePath = join(root, "content/coursiv/courses/google-sheet-with-ai.json");
const imageRoot = join(root, "public/images/courses/google-sheet-with-ai");
const manifestPath = join(root, "content/coursiv/manifest.json");
const generatedCatalogPath = join(root, "lib/generated/coursiv-catalog.ts");

const lessons = [
  {
    title: "Create Tables",
    slug: "create-tables",
    key: "create-tables",
    steps: [
      ["Open Gemini in Sheets", "Open a new or existing Google Sheet, then click Ask Gemini to open the Gemini side panel.", "Open Gemini in Sheets"],
      ["Prompt Gemini to create a table", "Describe the tracker or table you need, including the purpose, columns, and any starting data.", "Prompt Gemini to create a table"],
      ["Review the created table", "Check the generated headers, rows, and structure. Adjust column names, statuses, or missing fields before using it.", "Review the created table"],
    ],
    takeaway: "Create a [project/event/team] tracker in Google Sheets with columns for Owner, Task, Priority, Due Date, Status, and Notes. Add 10 realistic starter rows.",
  },
  {
    title: "Auto Populate",
    slug: "auto-populate",
    key: "auto-populate",
    steps: [
      ["Select the column to complete", "Choose the column where Gemini should infer or generate missing values, such as category, description, or status.", "Select the column to complete"],
      ["Fill extra rows", "Use Gemini to continue the pattern from existing rows or generate content for blank cells.", "Fill extra rows"],
      ["Run the generative cell action", "Apply Gemini's suggestion to the selected range, then scan for consistency and edge cases.", "Run the generative cell action"],
    ],
    takeaway: "Fill the blank cells in column [column name] using the pattern from the completed rows. Keep the output concise and consistent with the existing categories.",
  },
  {
    title: "Generate Formulas",
    slug: "generate-formulas",
    key: "generate-formulas",
    steps: [
      ["Ask Gemini for a formula", "Explain the calculation you need in plain English and identify the relevant columns or cells.", "Ask Gemini for a formula"],
      ["Apply the formula to real data", "Paste or accept the formula, then test it against the row values in your sheet.", "Apply the formula to real data"],
      ["Ask questions about the result", "Use Gemini to explain the result, spot mistakes, or answer a question from the table.", "Ask questions about the result"],
    ],
    takeaway: "Write a Google Sheets formula for [business rule]. My data has [column A meaning], [column B meaning], and [column C meaning]. Explain where to paste it and how to fill it down.",
  },
  {
    title: "Insights and Visualizations",
    slug: "insights-and-visualizations",
    key: "insights-and-visualizations",
    steps: [
      ["Ask Gemini to analyze your sheet", "Open a dataset and ask Gemini for patterns, anomalies, or summary insights.", "Ask Gemini to analyze the sheet"],
      ["Create a chart", "Ask Gemini to turn the data into a relevant chart, such as a pie chart, bar chart, or trend chart.", "Create a chart"],
      ["Use insights in a dashboard", "Review the chart and Gemini's explanation, then decide what action the data supports.", "Use insights in a dashboard"],
    ],
    takeaway: "Analyze this sheet and tell me the top 3 insights, the biggest risk, and the best chart to show the trend to a manager.",
  },
  {
    title: "No-Code Sheets & Scripts",
    slug: "no-code-sheets-and-scripts",
    key: "no-code-sheets-scripts",
    steps: [
      ["Open Gemini for a Sheets task", "Start with a specific Sheets problem you want solved without manually writing code.", "Open Gemini for a Sheets task"],
      ["Ask for data insights or automation help", "Describe the exact output you want, such as a summary, script, calculation, or workflow.", "Ask for data insights or automation help"],
      ["Use the answer without code expertise", "Review Gemini's response and apply it inside Sheets or Apps Script depending on the task.", "Use the answer without code expertise"],
    ],
    takeaway: "Create a Google Apps Script for Sheets that [task]. Include where I should paste it, how to run it, and how to test that it worked.",
  },
  {
    title: "Gemini Image-to-Sheets Hack",
    slug: "gemini-image-to-sheets-hack",
    key: "image-to-sheets-hack",
    steps: [
      ["Start from source data", "Take a screenshot or photo of a table, receipt, chart, or structured list.", "Start from source data"],
      ["Prompt Gemini to structure it", "Ask Gemini to read the image and convert the visible information into a clean table.", "Prompt Gemini to structure data"],
      ["Review the structured sheet", "Check headings, row count, dates, numbers, and any ambiguous text before using the output.", "Review the structured sheet"],
    ],
    takeaway: "Turn the data in this image into a spreadsheet table. Preserve the original columns, normalize dates and numbers, and mark anything uncertain as \"Needs review\".",
  },
  {
    title: "Automate Tasks with Gemini and Apps Script",
    slug: "automate-tasks-with-gemini-and-apps-script",
    key: "apps-script-automation",
    steps: [
      ["Open the Apps Script platform", "Open a Sheet, then go to Extensions > Apps Script to prepare the automation workspace.", "Open the Apps Script platform"],
      ["Select the Sheets add-on or script target", "Confirm the automation is connected to the correct Google Sheet and workflow.", "Select the Sheets add-on or script target"],
      ["Edit the code block", "Paste Gemini's Apps Script, save the project, refresh the Sheet, and run the menu or function.", "Edit the code block for automation"],
    ],
    takeaway: "Create a Google Apps Script for my Sheet that adds a custom menu called \"AI Boost Action\" and, when clicked, shows a success alert. Include the full code and setup steps.",
  },
  {
    title: "Advanced Analysis in Sheets",
    slug: "advanced-analysis-in-sheets",
    key: "advanced-analysis",
    steps: [
      ["Ask Gemini to analyze data", "Open a dataset and ask Gemini a clear analysis question about spending, performance, or trends.", "Ask Gemini to analyze data"],
      ["Create a visualization", "Ask Gemini to create the best chart for the question, then insert it into the sheet.", "Create a visualization"],
      ["Review strategic insights", "Use Gemini's explanation to identify what action to take next.", "Review strategic insights"],
    ],
    takeaway: "Create a chart that shows [metric] by [category], then explain the biggest insight, the likely cause, and one action I should take next.",
  },
  {
    title: "Talk to Your Data in Sheets",
    slug: "talk-to-your-data-in-sheets",
    key: "talk-to-your-data",
    steps: [
      ["Prepare sortable data", "Use a sheet with category, date, and numeric columns so Gemini has enough structure to work with.", "Prepare sortable data"],
      ["Ask a natural language question", "Use plain English to ask Gemini to sort, filter, format, or explain the data.", "Ask a natural language question"],
      ["Filter, sort, or visualize", "Apply Gemini's action and confirm the output matches your intended view.", "Filter, sort, or visualize"],
    ],
    takeaway: "Sort this sheet by [number column] from highest to lowest, highlight values over [threshold] in green, and filter to only show [category].",
  },
  {
    title: "AI Magic in a Sheets Cell",
    slug: "ai-magic-in-a-sheets-cell",
    key: "ai-magic-in-sheets-cell",
    steps: [
      ["Type the AI function", "Use =AI() in a cell to generate text from a prompt and another cell's value.", "Type the AI function"],
      ["Generate text at scale", "Fill the formula down so Sheets generates copy, summaries, or labels across many rows.", "Generate text at scale"],
      ["Summarize or categorize data", "Use =AI() to summarize long text, classify sentiment, assign categories, or standardize messy entries.", "Summarize or categorize data"],
    ],
    takeaway: '=AI("Summarize this customer feedback in 10 words or less and classify sentiment as Positive, Negative, or Mixed.", A2)',
    takeawayTitle: "Formula idea",
    takeawayIntro: "Copy this formula and adapt it to your sheet.",
  },
  {
    title: "Notes to Sheets with Gemini",
    slug: "notes-to-sheets-with-gemini",
    key: "notes-to-sheets",
    steps: [
      ["Reference source notes", "Choose a Google Drive file with meeting notes, project details, tasks, or budget information.", "Reference source notes"],
      ["Prompt for an organized tracker", "In Gemini, reference the source file with @ and ask it to create a tracker or table.", "Prompt for an organized tracker"],
      ["Review the generated tracker", "Check the generated columns, colors, categories, and action items before using the tracker.", "Review the generated tracker"],
    ],
    takeaway: "Create a project tracker using the tasks in @ [file name]. Include Owner, Task, Priority, Due Date, Status, Budget Impact, and Next Step.",
  },
];

function imageBlock(lessonNumber, stepNumber, alt) {
  const number = String(lessonNumber).padStart(2, "0");
  const step = String(stepNumber).padStart(2, "0");
  const src = `/images/courses/google-sheet-with-ai/lesson-${number}-step-${step}.avif`;
  return {
    alt,
    id: `google-sheets-lesson-${number}-step-${step}-image`,
    localSrc: src,
    src,
    type: "image",
  };
}

function buildLesson(lesson, lessonIndex) {
  const lessonNumber = lessonIndex + 1;
  const sourcePageId = `google-sheets-${lesson.key}-page`;
  const instructionScreens = lesson.steps.map(([title, text, alt], stepIndex) => {
    const stepNumber = stepIndex + 1;
    const id = `google-sheets-${lesson.key}-step-${stepNumber}`;
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
  const takeawayId = `google-sheets-${lesson.key}-takeaway`;
  const takeawayScreen = {
    blocks: [
      { id: `${takeawayId}-heading`, level: 2, text: "Step 4: Takeaway", type: "heading" },
      { id: `${takeawayId}-text`, text: lesson.takeawayIntro ?? "Copy this prompt and paste it into Ask Gemini.", type: "paragraph" },
      {
        id: `google-sheets-lesson-${String(lessonNumber).padStart(2, "0")}-copy-prompt`,
        text: lesson.takeaway,
        title: lesson.takeawayTitle ?? "Ready-to-use prompt",
        tone: "copy-prompt",
        type: "callout",
      },
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
    readUrl: `/course/google-sheet-with-ai/lesson/${lesson.slug}`,
    schemaVersion: 3,
    screens,
    slug: lesson.slug,
    sourceGuideId: "coursiv-original-google-sheet-with-ai",
    sourceId: `google-sheets-${lesson.key}`,
    sourceUnitId: "google-sheet-with-ai-essentials",
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
  units: [
    {
      lessons: lessons.map(buildLesson),
      order: 1,
      sourceId: "google-sheet-with-ai-essentials",
      title: "Google Sheets Essentials",
    },
  ],
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
const arrayEnd = generatedSource.lastIndexOf("];");
if (arrayStart === -1 || arrayEnd === -1) throw new Error("Could not parse generated Coursiv catalog.");
const generatedCatalog = JSON.parse(generatedSource.slice(arrayStart, arrayEnd + 1));
const generatedIndex = generatedCatalog.findIndex((entry) => entry.id === course.id);
if (generatedIndex === -1) generatedCatalog.push(catalogEntry);
else generatedCatalog[generatedIndex] = catalogEntry;
await writeFile(
  generatedCatalogPath,
  `${generatedSource.slice(0, arrayStart)}${JSON.stringify(generatedCatalog, null, 2)};\n`,
);

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
const courses = await Promise.all(
  courseFiles.map(async (file) => JSON.parse(await readFile(join(root, "content/coursiv/courses", file), "utf8"))),
);
manifest.totals.courses = courses.length;
manifest.totals.lessons = courses.reduce(
  (total, item) => total + item.units.reduce((unitTotal, unit) => unitTotal + unit.lessons.length, 0),
  0,
);
manifest.totals.screens = courses.reduce(
  (total, item) => total + item.units.reduce(
    (unitTotal, unit) => unitTotal + unit.lessons.reduce(
      (lessonTotal, lesson) => lessonTotal + lesson.screens.length,
      0,
    ),
    0,
  ),
  0,
);
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Built and indexed ${lessons.length} Google Sheet with AI lessons at ${coursePath}`);
