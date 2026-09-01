export type ShortsQuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

export const shortsQuizData: Record<string, Record<string, ShortsQuizQuestion[]>> = {
  "google-sheet-with-ai-shorts": {
    "use-gemini-in-google-sheets": [
      {
        id: "open-gemini",
        question: "Where do you start when you want Gemini to help inside Google Sheets?",
        options: ["Open the Ask Gemini side panel", "Export the sheet as a PDF", "Open Google Slides"],
        correctIndex: 0,
        explanation: "The Ask Gemini side panel is the starting point for requesting help without leaving your spreadsheet.",
      },
      {
        id: "strong-prompt",
        question: "Which prompt gives Gemini the clearest instructions?",
        options: ["Make this better", "Summarize A2:A30 as five bullet points", "Do something with my data"],
        correctIndex: 1,
        explanation: "A strong prompt names the task, the range, and the expected output.",
      },
      {
        id: "verify-output",
        question: "What should you do before relying on Gemini's result?",
        options: ["Delete the source data", "Share it immediately", "Check it against the selected cells and your goal"],
        correctIndex: 2,
        explanation: "Always verify AI output against the source data before applying or sharing it.",
      },
    ],
    "work-smarter-in-google-sheets": [
      {
        id: "best-task",
        question: "Which task is the best first candidate for automation?",
        options: ["A repeated weekly cleanup", "A one-time creative decision", "Choosing a company strategy"],
        correctIndex: 0,
        explanation: "Frequent, repeatable tasks usually deliver the quickest automation payoff.",
      },
      {
        id: "right-tool",
        question: "What is a practical way to reduce repetitive spreadsheet work?",
        options: ["Add more manual copies", "Use formulas, Gemini, or an automated workflow", "Create duplicate tabs every day"],
        correctIndex: 1,
        explanation: "Formulas, Gemini, and automation can each remove different kinds of repetitive work.",
      },
      {
        id: "safe-test",
        question: "How should you test a new automated workflow?",
        options: ["Run it on every row immediately", "Skip testing", "Try it on a small sample and compare the result"],
        correctIndex: 2,
        explanation: "A small sample exposes mistakes before they affect the full sheet.",
      },
    ],
    "create-a-table-with-one-prompt": [
      {
        id: "table-prompt",
        question: "What should a good table-generation prompt include?",
        options: ["Purpose, columns, and sample-row requirements", "Only the word table", "A request with no context"],
        correctIndex: 0,
        explanation: "Purpose, columns, and sample-row details give Gemini a clear table specification.",
      },
      {
        id: "review-table",
        question: "What should you check first after Gemini creates a table?",
        options: ["The browser theme", "Headers and sample values", "Your email inbox"],
        correctIndex: 1,
        explanation: "Headers and sample values reveal whether the structure matches your intended use.",
      },
      {
        id: "consistent-entry",
        question: "Which feature helps users enter consistent values?",
        options: ["Random colours", "Merged cells", "Dropdowns and data validation"],
        correctIndex: 2,
        explanation: "Dropdowns and validation reduce inconsistent or invalid entries.",
      },
    ],
    "build-a-google-sheets-agent": [
      {
        id: "workflow-role",
        question: "What does n8n do in this Google Sheets agent?",
        options: ["Connects WhatsApp, ChatGPT, and Google Sheets", "Replaces every spreadsheet formula", "Designs the phone interface"],
        correctIndex: 0,
        explanation: "n8n coordinates the trigger, AI request, and spreadsheet action in one workflow.",
      },
      {
        id: "trigger",
        question: "What starts the workflow in this example?",
        options: ["A slide transition", "An incoming WhatsApp message", "A printer notification"],
        correctIndex: 1,
        explanation: "The incoming WhatsApp message is the trigger that begins the automation.",
      },
      {
        id: "safe-launch",
        question: "What is essential before letting the agent update a live sheet?",
        options: ["Remove all credentials", "Give everyone editor access", "Verify credentials, permissions, and a test message"],
        correctIndex: 2,
        explanation: "Controlled permissions and a test message reduce the risk of incorrect live updates.",
      },
    ],
  },
  "google-slide-with-ai-short": {
    "how-to-use-gemini-in-google-slides": [
      {
        id: "open-gemini",
        question: "Where can you ask Gemini for help in Google Slides?",
        options: ["The Ask Gemini side panel", "The print dialog", "The speaker settings"],
        correctIndex: 0,
        explanation: "The Ask Gemini side panel lets you create and revise presentation content in context.",
      },
      {
        id: "grounding",
        question: "How can you make Gemini's slide suggestions more relevant?",
        options: ["Give it no topic", "Reference the right source file or slide", "Use only one-word prompts"],
        correctIndex: 1,
        explanation: "Selecting the relevant source gives Gemini the context needed for a useful response.",
      },
      {
        id: "review",
        question: "What should happen before you present AI-generated slides?",
        options: ["Publish them without reading", "Hide every source", "Check facts, wording, and visual fit"],
        correctIndex: 2,
        explanation: "AI output still needs a human check for accuracy, clarity, and presentation quality.",
      },
    ],
    "create-stunning-presentations-in-minutes": [
      {
        id: "prompt-inputs",
        question: "Which details make a presentation prompt more useful?",
        options: ["Audience, objective, topic, and slide count", "Only a colour name", "No audience or goal"],
        correctIndex: 0,
        explanation: "Those details define who the deck is for and what it must achieve.",
      },
      {
        id: "first-review",
        question: "What should you review before polishing individual slides?",
        options: ["The animation speed", "The overall outline and story", "The file name font"],
        correctIndex: 1,
        explanation: "A clear story should be fixed before spending time on slide-level polish.",
      },
      {
        id: "clear-slide",
        question: "What usually makes a slide easier to understand?",
        options: ["Several competing messages", "Long paragraphs", "One clear message with a useful visual"],
        correctIndex: 2,
        explanation: "One clear message and a relevant visual reduce cognitive load.",
      },
    ],
    "create-faster-work-smarter-visualize-everything": [
      {
        id: "improvement-order",
        question: "What should you improve first in a weak presentation?",
        options: ["The structure and flow", "Every animation", "The page number colour"],
        correctIndex: 0,
        explanation: "Better structure creates a larger improvement than cosmetic details.",
      },
      {
        id: "crowded-slide",
        question: "What is the best response to an overcrowded slide?",
        options: ["Add another paragraph", "Shorten the text and keep the key message", "Make all text smaller"],
        correctIndex: 1,
        explanation: "Removing non-essential text improves readability without hiding the main point.",
      },
      {
        id: "visual-choice",
        question: "Which visual should you choose?",
        options: ["The most decorative one", "A random stock photo", "One that explains the message quickly and clearly"],
        correctIndex: 2,
        explanation: "A useful visual supports understanding instead of acting as decoration only.",
      },
    ],
  },
};
