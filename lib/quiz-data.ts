export type QuestionType = "single" | "multiple";

export type QuizOption = {
  id: string;
  label: string;
  emoji: string;
  hint?: string;
};

export type QuizQuestion = {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  type: QuestionType;
  options: QuizOption[];
};

export const quizQuestions: QuizQuestion[] = [
  {
    id: "goal",
    eyebrow: "Your north star",
    title: "What would you most like AI to help you achieve?",
    subtitle: "Choose the outcome that feels most valuable right now.",
    type: "single",
    options: [
      { id: "income", emoji: "💸", label: "Create a new income stream", hint: "Build something that earns" },
      { id: "career", emoji: "🚀", label: "Accelerate my career", hint: "Stand out and move faster" },
      { id: "business", emoji: "📈", label: "Grow my business", hint: "Scale without adding overhead" },
      { id: "time", emoji: "⏳", label: "Save more time", hint: "Automate repetitive work" },
    ],
  },
  {
    id: "experience",
    eyebrow: "Starting point",
    title: "How experienced are you with AI tools?",
    subtitle: "No judgment — we will tailor the plan to your level.",
    type: "single",
    options: [
      { id: "new", emoji: "🌱", label: "Complete beginner" },
      { id: "exploring", emoji: "🔎", label: "I have tried a few tools" },
      { id: "regular", emoji: "⚡", label: "I use AI regularly" },
      { id: "advanced", emoji: "🧠", label: "I build advanced workflows" },
    ],
  },
  {
    id: "skills",
    eyebrow: "Your advantage",
    title: "Which skills do you already bring?",
    subtitle: "Select all that apply.",
    type: "multiple",
    options: [
      { id: "writing", emoji: "✍️", label: "Writing & content" },
      { id: "design", emoji: "🎨", label: "Design & creativity" },
      { id: "sales", emoji: "🤝", label: "Sales & marketing" },
      { id: "tech", emoji: "💻", label: "Tech & development" },
      { id: "none", emoji: "✨", label: "Still discovering mine" },
    ],
  },
  {
    id: "time",
    eyebrow: "Your rhythm",
    title: "How much time can you invest each day?",
    subtitle: "Consistency matters more than long sessions.",
    type: "single",
    options: [
      { id: "5", emoji: "☕", label: "5–10 minutes" },
      { id: "15", emoji: "🎯", label: "15–30 minutes" },
      { id: "30", emoji: "🔥", label: "30–60 minutes" },
      { id: "60", emoji: "🏆", label: "More than 1 hour" },
    ],
  },
  {
    id: "motivation",
    eyebrow: "What drives you",
    title: "Why is now the right time to start?",
    subtitle: "Your motivation helps us set the right pace.",
    type: "single",
    options: [
      { id: "security", emoji: "🛡️", label: "I want more financial security" },
      { id: "freedom", emoji: "🌍", label: "I want more freedom" },
      { id: "future", emoji: "🔮", label: "I do not want to fall behind" },
      { id: "curious", emoji: "💡", label: "I am ready for a new challenge" },
    ],
  },
  {
    id: "interests",
    eyebrow: "Opportunity map",
    title: "Which AI paths sound exciting?",
    subtitle: "Select everything you would like to explore.",
    type: "multiple",
    options: [
      { id: "content", emoji: "🎬", label: "Content creation" },
      { id: "freelance", emoji: "🧑‍💻", label: "AI freelancing" },
      { id: "products", emoji: "📦", label: "Digital products" },
      { id: "automation", emoji: "🤖", label: "Business automation" },
      { id: "marketing", emoji: "📣", label: "AI-powered marketing" },
    ],
  },
  {
    id: "income-target",
    eyebrow: "Your target",
    title: "What is your first monthly income goal?",
    subtitle: "Pick an ambitious but motivating milestone.",
    type: "single",
    options: [
      { id: "250", emoji: "🌤️", label: "$250–$500 / month" },
      { id: "1000", emoji: "🌟", label: "$500–$1,000 / month" },
      { id: "3000", emoji: "💎", label: "$1,000–$3,000 / month" },
      { id: "5000", emoji: "🚀", label: "$3,000+ / month" },
    ],
  },
  {
    id: "work-style",
    eyebrow: "How you work",
    title: "Which working style fits you best?",
    subtitle: "We will shape lessons around your natural mode.",
    type: "single",
    options: [
      { id: "solo", emoji: "🎧", label: "Focused solo creator" },
      { id: "social", emoji: "🫶", label: "Collaborative connector" },
      { id: "builder", emoji: "🧩", label: "Hands-on experimenter" },
      { id: "planner", emoji: "🗺️", label: "Strategic planner" },
    ],
  },
  {
    id: "blocks",
    eyebrow: "Remove friction",
    title: "What usually stops you from making progress?",
    subtitle: "Select all that feel familiar.",
    type: "multiple",
    options: [
      { id: "time", emoji: "⌛", label: "Not enough time" },
      { id: "direction", emoji: "🌫️", label: "Too many options" },
      { id: "confidence", emoji: "🫥", label: "Lack of confidence" },
      { id: "consistency", emoji: "📆", label: "Staying consistent" },
      { id: "tech", emoji: "🛠️", label: "Technical complexity" },
    ],
  },
  {
    id: "learning",
    eyebrow: "Learning fit",
    title: "How do you learn fastest?",
    subtitle: "Your plan should feel natural, not like homework.",
    type: "single",
    options: [
      { id: "video", emoji: "▶️", label: "Short visual lessons" },
      { id: "practice", emoji: "🧪", label: "Hands-on challenges" },
      { id: "steps", emoji: "✅", label: "Clear step-by-step guides" },
      { id: "coach", emoji: "💬", label: "Guidance from a coach" },
    ],
  },
  {
    id: "tools",
    eyebrow: "Your toolkit",
    title: "Which tools have you already tried?",
    subtitle: "Select all that apply — including none.",
    type: "multiple",
    options: [
      { id: "chatgpt", emoji: "💬", label: "ChatGPT or Claude" },
      { id: "image", emoji: "🖼️", label: "AI image tools" },
      { id: "video", emoji: "🎥", label: "AI video tools" },
      { id: "automation", emoji: "⚙️", label: "Automation tools" },
      { id: "none", emoji: "🌱", label: "None yet" },
    ],
  },
  {
    id: "confidence",
    eyebrow: "Quick pulse check",
    title: "How confident are you about earning with AI?",
    subtitle: "Choose what feels true today.",
    type: "single",
    options: [
      { id: "1", emoji: "😶", label: "Not confident yet" },
      { id: "2", emoji: "🙂", label: "A little confident" },
      { id: "3", emoji: "😎", label: "Confident with a roadmap" },
      { id: "4", emoji: "🔥", label: "Very confident" },
    ],
  },
  {
    id: "timeline",
    eyebrow: "Momentum",
    title: "When do you want to see your first result?",
    subtitle: "We use this to prioritize your first actions.",
    type: "single",
    options: [
      { id: "week", emoji: "⚡", label: "Within 7 days" },
      { id: "month", emoji: "🗓️", label: "Within 30 days" },
      { id: "quarter", emoji: "📈", label: "Within 3 months" },
      { id: "explore", emoji: "🧭", label: "I am exploring for now" },
    ],
  },
  {
    id: "support",
    eyebrow: "Support system",
    title: "What would keep you moving forward?",
    subtitle: "Select the support you would value most.",
    type: "multiple",
    options: [
      { id: "plan", emoji: "🗺️", label: "A personalized roadmap" },
      { id: "nudges", emoji: "🔔", label: "Daily motivation" },
      { id: "coach", emoji: "🤖", label: "An always-on AI coach" },
      { id: "community", emoji: "👥", label: "A learning community" },
      { id: "wins", emoji: "🏅", label: "Visible progress & wins" },
    ],
  },
  {
    id: "commitment",
    eyebrow: "Final step",
    title: "Ready to commit to your 30-day AI challenge?",
    subtitle: "Your personalized growth plan is one step away.",
    type: "single",
    options: [
      { id: "ready", emoji: "🚀", label: "Yes — I am ready" },
      { id: "curious", emoji: "✨", label: "Show me what is possible" },
      { id: "gentle", emoji: "🌿", label: "Start me at a gentle pace" },
    ],
  },
];
