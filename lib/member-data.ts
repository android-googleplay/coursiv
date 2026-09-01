import { coursivCatalog } from "./generated/coursiv-catalog";

export type MemberTab = "courses" | "games" | "profile";
export type CatalogKind = "tool" | "use-case" | "program" | "challenge";
export type CourseStatus = "locked" | "available" | "in-progress" | "completed";

export type LessonDefinition = { id: string; title: string; implemented: boolean; sourceId?: string; screenIds?: string[]; hasAudio?: boolean; optional?: boolean };
export type CourseSection = { title?: string; lessons: LessonDefinition[] };
export type CourseDefinition = {
  id: string;
  programId: string;
  title: string;
  duration: string;
  color: string;
  image?: string;
  sourceUpdatedAt?: string;
  sections: CourseSection[];
};
export type CatalogItem = {
  id: string;
  kind: CatalogKind;
  title: string;
  categories: string[];
  lessonCount?: number;
  duration?: string;
  status?: CourseStatus;
  description?: string;
  image?: string;
};
export type ProgramDefinition = CatalogItem & { courseIds: string[]; description: string };
export type ChallengeDefinition = CatalogItem & { days: number; level: string; focus: string };
export type PromptCard = { id: string; category: string; subcategory: string; title: string; body: string };
export type PracticeQuestion = { id: string; question: string; answers: string[]; correct: number; explanation: string };
export type PracticeGame = { id: string; title: string; description: string; questions: PracticeQuestion[] };

const lessons = (titles: string[]): LessonDefinition[] =>
  titles.map((title) => ({
    id: title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/(^-|-$)/g, ""),
    title,
    implemented: true,
  }));

export const aiMasteryCourses: CourseDefinition[] = [
  {
    id: "chatgpt", programId: "ai-mastery", title: "ChatGPT", duration: "6h", color: "#75d948",
    sections: [
      { lessons: [{id:"discovering-modes",title:"Discovering Modes & Features",implemented:true}, ...lessons(["Voice Mode", "ChatGPT & Apps", "Image Generation With ChatGPT", "Stay Organized: Projects", "Build Your Own AI: Custom GPTs"])] },
      { title: "ChatGPT for Real Life", lessons: lessons(["Productivity & Daily Task Automation", "ChatGPT for Effective Communication", "Research Faster", "Plan Anything: Multi-Step Projects", "Organizing Personal Finances", "Create Content for Any Platform", "Bring a Creative Idea to Life"]) },
    ],
  },
  {
    id: "claude", programId: "ai-mastery", title: "Claude", duration: "5h", color: "#ffb069",
    sections: [
      { lessons: lessons(["Meet Claude", "Working With Projects", "Create With Artifacts"]) },
      { title: "Prompting for Claude", lessons: lessons(["Creativity Stimulation", "Analytical Frameworks", "Interconnected Reasoning"]) },
      { title: "Claude in Practice", lessons: lessons(["Writing & Editing", "Understanding, Research, and Synthesis", "Strategic Thinking and Critical Review", "Using Claude Alongside Other Tools"]) },
    ],
  },
  {
    id: "jasper", programId: "ai-mastery", title: "Jasper AI", duration: "5h", color: "#ff775e",
    sections: [
      { lessons: lessons(["Intro to Jasper AI", "Jasper’s Core Features", "Working with Jasper IQ", "From Idea to Finished Content"]) },
      { title: "Marketing Tasks You Can Solve with Jasper", lessons: lessons(["Writing Content for Your Website & Blog", "Jasper for Email Marketing", "Creating Short-Form Copy", "Launching an Offer with Jasper", "Jasper for Brand Building", "Combining Jasper with Other Tools"]) },
    ],
  },
  {
    id: "midjourney", programId: "ai-mastery", title: "Midjourney", duration: "6h", color: "#ef6fb1",
    sections: [
      { lessons: lessons(["Navigating Midjourney", "First AI Art", "Lighting", "Image Size", "Viewpoint"]) },
      { title: "Explore Techniques and Styles", lessons: lessons(["Shape Your Visual Direction", "Fine-Tune and Customize Your Images", "Combining Modes", "Smarter Creative Exploration"]) },
      { title: "Practice Midjourney Use Cases", lessons: lessons(["Stunning Product Images", "Powerful Marketing Visuals", "Images for Blogs and Social Media", "Illustrating Stories and Books"]) },
    ],
  },
  {
    id: "lovable", programId: "ai-mastery", title: "Lovable", duration: "4h", color: "#7d74ff",
    sections: [{ lessons: lessons(["Intro to Lovable", "Starting Your First Project", "Editing with Chat", "Working with Design Imports", "Using Lovable with Other Tools", "Writing Website Copy", "Publishing and Sharing", "Real-World Applications & Tips"]) }],
  },
];

const programCourseIds = [
  ["chatgpt", "claude", "jasper", "midjourney", "lovable"],
  ["chatgpt", "claude", "gemini", "perplexity", "canva-ai"],
  ["claude", "claude-excel", "communicating-ai", "perplexity", "chatgpt"],
  ["jasper", "chatgpt", "canva-ai", "midjourney", "communicating-ai"],
  ["midjourney", "stable-diffusion", "canva-ai", "lovable", "chatgpt"],
  ["midjourney", "stable-diffusion", "canva-ai", "gemini", "chatgpt"],
  ["kling", "midjourney", "canva-ai", "chatgpt", "gemini"],
  ["chatgpt", "claude", "perplexity", "lovable", "communicating-ai"],
  ["jasper", "canva-ai", "chatgpt", "perplexity", "gemini"],
  ["claude-excel", "chatgpt", "claude", "perplexity", "gemini"],
  ["claude", "communicating-ai", "chatgpt", "perplexity", "gemini"],
  ["claude-code", "lovable", "chatgpt-deep", "gemini", "perplexity"],
  ["chatgpt", "claude", "jasper", "canva-ai", "perplexity"],
  ["claude", "perplexity", "communicating-ai", "chatgpt", "gemini"],
  ["claude", "jasper", "canva-ai", "communicating-ai", "chatgpt"],
  ["claude-excel", "perplexity", "gemini", "chatgpt", "deepseek"],
  ["chatgpt", "claude", "lovable", "claude-code"],
] as const;

export const certificatePrograms: ProgramDefinition[] = [
  "AI Mastery Certificate Program", "Personalized AI Certificate Program", "Claude-Powered Accounting Program", "AI Content and Social Media Program", "AI for Creatives Program", "AI Visuals Program", "AI Video Creator Program", "AI Business Accelerator Program", "AI Marketing and Growth Program", "AI for Business and Finance", "AI for Managers and Leaders Program", "AI for Tech and Product Program", "AI-Powered Career and Income Program", "Claude-Powered Project Management Program", "Claude-Powered SMM Program", "AI for Data Analysis and Research Program", "AI Workflow Automation Program",
].map((title, index) => ({
  id: index === 0 ? "ai-mastery" : `program-${index + 1}`,
  kind: "program",
  title,
  categories: index < 2 ? ["General"] : index < 6 ? ["Business"] : index < 10 ? ["Marketing & Growth"] : ["Tech"],
  lessonCount: index === 16 ? 4 : 5,
  status: index === 0 ? "in-progress" : "available",
  courseIds: [...programCourseIds[index]],
  description: index === 0
    ? "Build practical confidence across five leading AI tools."
    : `A focused pathway for applying AI to ${title.replace(/Program|Certificate/gi, "").trim().toLowerCase()}.`,
}));

const baseToolCourses: CatalogItem[] = [
  ["claude", "Claude", 10, "5h"], ["claude-excel", "Claude for Excel", 8, "3h"], ["claude-deep", "Claude: Deep Dive", 13, "5h"],
  ["midjourney", "Midjourney", 13, "6h"], ["lovable", "Lovable", 8, "4h"], ["gemini", "Gemini", 10, "4h"], ["google-sheet-with-ai", "Google Sheet with AI", 11, "1h"], ["google-sheet-with-ai-shorts", "Google Sheet with AI (Shorts)", 4, "4 shorts"], ["google-slide-with-ai", "Google Slide with AI", 11, "1h"], ["google-slide-with-ai-short", "Google Slide with AI (Short)", 3, "3 shorts"],
  ["chatgpt", "ChatGPT", 13, "6h"], ["jasper", "Jasper AI", 10, "5h"], ["chatgpt-deep", "ChatGPT: Deep Dive", 12, "4h"],
  ["stable-diffusion", "Stable Diffusion", 10, "4h"], ["deepseek", "DeepSeek", 10, "5h"], ["omni", "Omni", 10, "4h"],
  ["perplexity", "Perplexity", 11, "5h"], ["kling", "Kling", 11, "3h"], ["canva-ai", "Canva AI", 8, "3h"],
  ["communicating-ai", "Communicating With AI", 5, "2h"], ["claude-code", "Claude Code", 7, "2h"],
  ["notion", "Notion: Build Your Life Hub", 9, "3h"],
].map(([id, title, lessonCount, duration]) => ({ id: String(id), kind: "tool" as const, title: String(title), categories: ["New"], lessonCount: Number(lessonCount), duration: String(duration), status: id === "chatgpt" ? "in-progress" as const : "available" as const }));

export const toolCourses: CatalogItem[] = baseToolCourses.map((item) => {
  const scraped = coursivCatalog.find((course) => course.id === item.id);
  return scraped ? { ...item, title:scraped.title,image:scraped.image,duration:scraped.duration||item.duration,categories:scraped.categories.length?scraped.categories:item.categories,lessonCount:scraped.sections.reduce((total,section)=>total+section.lessons.length,0) } : item;
});

const baseUseCases: CatalogItem[] = [
  "Managing Personal Finances With AI", "AI for Accountants", "AI-Powered Real Estate", "AI Copywriting", "AI Side Hustle", "AI-Powered Creative Income", "No-Code Websites and Apps", "AI in Design", "Land Jobs With AI", "AI for Business Operations", "Boost Your Sales with AI", "Marketing Your Business with AI", "AI Essentials for Project Managers", "AI for Product Development", "Build a Strong Portfolio with AI", "Turbocharge Your Productivity with AI", "AI in SMM", "AI Social Influence & Blogging", "AI Performance Marketing", "AI for SEO",
].map((title, index) => ({ id: `use-case-${index + 1}`, kind: "use-case", title, categories: index < 5 ? ["New"] : index < 11 ? ["Business"] : ["Marketing and Growth"], lessonCount: 8 + (index % 5), duration: `${2 + (index % 4)}h`, status: "available" as const }));

export const useCases: CatalogItem[] = baseUseCases.map((item) => {
  const scraped = coursivCatalog.find((course) => course.id === item.id);
  return scraped ? { ...item,title:scraped.title,image:scraped.image,duration:scraped.duration||item.duration,categories:scraped.categories.length?scraped.categories:item.categories,lessonCount:scraped.sections.reduce((total,section)=>total+section.lessons.length,0) } : item;
});

export const courseCatalog: CatalogItem[] = [...toolCourses, ...useCases];

export const challenges: ChallengeDefinition[] = [
  ["28-Day AI Certificate Program", 28, "core AI skills"], ["14-Day AI Side Gigs Challenge", 14, "a sellable service"], ["Junior AI Challenge", 7, "safe AI fundamentals"], ["2025 28-Day AI Challenge", 28, "everyday productivity"], ["No Code Challenge", 14, "a working no-code product"], ["28-Day Claude Mastery Plan", 28, "advanced Claude workflows"], ["7-Day Claude Beginner Challenge", 7, "Claude essentials"],
].map(([title, days, focus], index) => ({ id: `challenge-${index + 1}`, kind: "challenge", title: String(title), categories: ["Challenges"], days: Number(days), level: index === 5 ? "Intermediate" : "Beginner", focus: String(focus), description: `A guided daily path that turns ${focus} into a finished, reviewable outcome.`, status: "available" }));

export const promptCategories = ["Web Development & No-Code", "Basic Applications", "Productivity", "Sales", "E-Commerce", "Investing", "Customer Support", "Conversion Rate Optimisation", "Product Management", "Human Resources"];

export const promptSubcategories = ["Planning & strategy", "Writing & communication", "Analysis & improvement", "Automation workflows"];

const promptTopics: Record<string, [string, string, string, string]> = {
  "Web Development & No-Code": ["website launch", "landing-page copy", "usability audit", "content publishing workflow"],
  "Basic Applications": ["everyday task", "clear explanation", "quality review", "repeatable assistant workflow"],
  "Productivity": ["weekly priorities", "status update", "time audit", "task triage workflow"],
  "Sales": ["account plan", "follow-up message", "pipeline review", "lead qualification workflow"],
  "E-Commerce": ["store growth plan", "product description", "catalogue audit", "order support workflow"],
  "Investing": ["research plan", "investment memo", "risk review", "portfolio monitoring workflow"],
  "Customer Support": ["service playbook", "customer reply", "ticket analysis", "escalation workflow"],
  "Conversion Rate Optimisation": ["experiment roadmap", "test brief", "funnel diagnosis", "experiment reporting workflow"],
  "Product Management": ["product strategy", "feature brief", "discovery synthesis", "feedback triage workflow"],
  "Human Resources": ["people plan", "candidate message", "policy review", "onboarding workflow"],
};

const promptTemplates = [
  (topic: string) => `Act as a practical strategist. Build a ${topic} for [CONTEXT]. Ask up to three essential questions, then return priorities, trade-offs, owners, and measurable success criteria.`,
  (topic: string) => `Draft a ${topic} for [AUDIENCE] about [SUBJECT]. Use a clear, respectful tone, lead with the main point, include one specific next action, and remove unsupported claims.`,
  (topic: string) => `Review this ${topic}: [PASTE MATERIAL]. Separate facts from assumptions, identify the three highest-impact weaknesses, and propose fixes with a simple way to verify each one.`,
  (topic: string) => `Design a human-reviewed ${topic}. Map trigger, inputs, steps, decision points, failure handling, and final quality check. Recommend the simplest tool setup that meets the need.`,
];

export const promptLibrary: PromptCard[] = promptCategories.flatMap((category) =>
  promptSubcategories.map((subcategory, index) => ({
    id: `${category}-${subcategory}`.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/(^-|-$)/g, ""),
    category,
    subcategory,
    title: `${subcategory.split(" & ")[0]}: ${promptTopics[category][index]}`,
    body: promptTemplates[index](promptTopics[category][index]),
  })),
);

export const practiceGames: PracticeGame[] = [
  { id: "ai-spotter", title: "AI Spotter", description: "Spot AI vs real images", questions: [
    { id: "specificity", question: "Which answer sounds more specific and human?", answers: ["A polished solution for every modern need.", "I missed the 7:15 bus, so I tested the voice feature while walking."], correct: 1, explanation: "Concrete time, context, and action make the second answer more grounded." },
    { id: "evidence", question: "Which product claim is more trustworthy?", answers: ["Our tool revolutionises productivity for everyone.", "In a five-person trial, the checklist cut handoff time from 18 to 11 minutes."], correct: 1, explanation: "The second claim names the sample, measure, and observed change." },
    { id: "voice", question: "Which line has a clearer personal voice?", answers: ["This remarkable destination offers unforgettable experiences.", "The bakery opens at six; arrive early for the still-warm sesame loaf."], correct: 1, explanation: "The second line uses useful detail instead of generic praise." },
    { id: "uncertainty", question: "Which answer handles uncertainty responsibly?", answers: ["This plan will definitely double revenue.", "This may improve conversion; test it on 10% of traffic before rollout."], correct: 1, explanation: "Responsible advice states uncertainty and proposes a test." },
  ] },
  { id: "prompt-master", title: "Prompt Master", description: "Good or bad prompt?", questions: [
    { id: "headlines", question: "Which is the stronger prompt?", answers: ["Write marketing copy.", "Write three 20-word headlines for a quiet productivity app, aimed at freelance designers."], correct: 1, explanation: "The stronger prompt defines format, length, product, and audience." },
    { id: "summary", question: "Which prompt produces a decision-ready summary?", answers: ["Summarise this report.", "Summarise this report in five bullets: finding, evidence, risk, open question, and recommended next step."], correct: 1, explanation: "A defined structure makes the result easier to use." },
    { id: "research", question: "Which research prompt is safer?", answers: ["Tell me the truth about this market.", "List claims, supporting evidence, source dates, contradictions, and what still needs verification."], correct: 1, explanation: "The second prompt asks for evidence and exposes uncertainty." },
    { id: "revision", question: "Which prompt gives actionable editing direction?", answers: ["Make this better.", "Shorten this email to 120 words, keep the deadline, and make the requested action explicit."], correct: 1, explanation: "Specific constraints define what better means." },
  ] },
  { id: "prompt-detective", title: "Prompt Detective", description: "Match prompt & result", questions: [
    { id: "table", question: "Which prompt is most likely to return a comparison table?", answers: ["Tell me about these tools.", "Compare these tools by price, best use, learning curve, and limitations in a Markdown table."], correct: 1, explanation: "The second prompt explicitly defines columns and format." },
    { id: "checklist", question: "Which prompt should return a launch checklist?", answers: ["Help me launch.", "Create a pre-launch checklist grouped by owner, deadline, dependency, and pass condition."], correct: 1, explanation: "The requested grouping turns advice into an operational checklist." },
    { id: "interview", question: "Which prompt should produce better interview questions?", answers: ["Give me interview questions.", "Write eight behavioural questions for a support lead, each tied to one competency and a scoring guide."], correct: 1, explanation: "Role, quantity, method, and evaluation are all specified." },
    { id: "diagnosis", question: "Which prompt should reveal a workflow bottleneck?", answers: ["Improve my workflow.", "Map each step, wait time, handoff, rework cause, and owner; then rank bottlenecks by weekly hours lost."], correct: 1, explanation: "The second asks for the evidence needed to locate the bottleneck." },
  ] },
];

const challengeActions = ["Define the outcome", "Collect two examples", "Write a clear instruction", "Run a first attempt", "Check facts and risks", "Improve the weakest part", "Save a reusable template"];

export function challengeTasks(challenge: ChallengeDefinition) {
  return Array.from({ length: challenge.days }, (_, index) => {
    const cycle = Math.floor(index / challengeActions.length) + 1;
    const action = challengeActions[index % challengeActions.length];
    return { day: index + 1, title: `${action}: ${challenge.focus}`, detail: `Cycle ${cycle}: complete one small deliverable, record what changed, and keep the result for your final challenge portfolio.` };
  });
}

export function getProgramCourses(programId: string) {
  const program = certificatePrograms.find((item) => item.id === programId) ?? certificatePrograms[0];
  return program.courseIds.map(getCourse);
}

export function getCourse(courseId: string) {
  const scraped = coursivCatalog.find((course) => course.id === courseId);
  if (scraped) return {
    id:scraped.id,programId:scraped.kind==="tool"?"tool-library":"use-case-library",title:scraped.title,image:scraped.image,duration:scraped.duration||"1h",color:"#6d63f2",sourceUpdatedAt:scraped.sourceUpdatedAt,
    sections:scraped.sections.map((section)=>({title:section.title,lessons:section.lessons.map((lesson)=>({id:lesson.id,title:lesson.title,implemented:true,sourceId:lesson.sourceId,screenIds:lesson.screenIds,hasAudio:lesson.hasAudio,optional:lesson.optional}))})),
  } satisfies CourseDefinition;
  const defined = aiMasteryCourses.find((course) => course.id === courseId);
  if (defined) return defined;
  const catalog = courseCatalog.find((course) => course.id === courseId);
  if (catalog) {
    const lessonCount = Math.max(5, catalog.lessonCount ?? 5);
    const foundations = [`Getting Started With ${catalog.title}`, "Core Concepts and Safe Use", "Writing Clear Instructions"];
    const applications = [
      "Build a Repeatable Workflow", "Review and Improve the Result", "Work With Real Examples", "Handle Errors and Uncertainty",
      "Combine This Tool With Your Workflow", "Create a Reusable Template", "Measure Quality and Impact", "Complete a Practical Project",
      "Present and Share Your Result", "Plan Your Next-Level Practice",
    ];
    const applicationLessons = Array.from({ length: lessonCount - foundations.length }, (_, index) => applications[index] ?? `Practical Project ${index + 1}`);
    return {
      id: catalog.id,
      programId: "tool-library",
      title: catalog.title,
      duration: catalog.duration ?? "3h",
      color: "#6d63f2",
      sections: [
        { lessons: lessons(foundations) },
        { title: "Apply Your Skills", lessons: lessons(applicationLessons) },
      ],
    } satisfies CourseDefinition;
  }
  return aiMasteryCourses[0];
}

export function allCourseLessons(course: CourseDefinition) {
  return course.sections.flatMap((section) => section.lessons);
}

export function requiredCourseLessons(course: CourseDefinition) {
  return allCourseLessons(course).filter((lesson) => !lesson.optional);
}
