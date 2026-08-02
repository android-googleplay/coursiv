export type LessonGuidance = {
  objective: string;
  principle: string;
  framework: [string, string][];
  weakInstruction: string;
  strongInstruction: string;
  explanation: string;
  practice: string;
};

const commonFramework: [string, string][] = [
  ["Outcome", "Name the result you need"],
  ["Context", "Include only relevant background"],
  ["Constraints", "State limits that must remain true"],
  ["Evidence", "Ask how claims will be supported"],
  ["Review", "Define a check before accepting the result"],
];

export function lessonGuidance(title: string, courseTitle: string): LessonGuidance {
  const value = title.toLowerCase();
  if (/image|visual|art|lighting|viewpoint|style/.test(value)) return {
    objective: `Turn a visual idea into a controlled, reviewable ${title.toLowerCase()} result.`,
    principle: "Describe subject, composition, mood, and constraints separately.",
    framework: [["Subject","What must appear"],["Composition","Where elements sit"],["Style","The visual language"],["Light","Mood and direction"],["Exclude","What must not appear"]],
    weakInstruction: `Create a nice image using ${courseTitle}.`,
    strongInstruction: `Create one editorial image of [SUBJECT], waist-level viewpoint, soft window light, muted blue palette, 4:5 ratio, with no text or logos.`,
    explanation: "The stronger instruction controls the visible result and removes common failure modes.",
    practice: "Generate two versions changing only one visual variable, then compare which better serves the intended audience.",
  };
  if (/research|understanding|analysis|finance|excel|data|synthesis/.test(value)) return {
    objective: `Use ${title.toLowerCase()} to reach a conclusion that can be checked against evidence.`,
    principle: "Separate sources, observations, assumptions, and conclusions.",
    framework: [["Question","The decision to inform"],["Scope","Included dates and boundaries"],["Sources","Acceptable evidence"],["Conflict","How disagreements are shown"],["Decision","The required output"]],
    weakInstruction: `Research ${title} and tell me the answer.`,
    strongInstruction: `Research [QUESTION] within [SCOPE]. List dated sources, distinguish facts from assumptions, show contradictions, and end with what still requires verification.`,
    explanation: "A bounded question and evidence rules make the conclusion auditable.",
    practice: "Check one claim against its original source and record whether the evidence supports, weakens, or contradicts it.",
  };
  if (/writing|copy|content|email|communication|blog|social/.test(value)) return {
    objective: `Create ${title.toLowerCase()} that gives one audience a clear next action.`,
    principle: "Write for a reader and decision, not for a generic tone.",
    framework: [["Reader","Who receives it"],["Need","What they care about"],["Message","The main point"],["Proof","A concrete reason"],["Action","What happens next"]],
    weakInstruction: `Write professional ${title.toLowerCase()}.`,
    strongInstruction: `Write a [FORMAT] for [READER]. Lead with [MAIN POINT], keep it under [LENGTH], support it with [PROOF], and finish with one explicit action.`,
    explanation: "Audience, hierarchy, evidence, and length turn style into a usable deliverable.",
    practice: "Remove one vague adjective and replace it with a fact, example, or observable benefit.",
  };
  if (/website|code|app|lovable|project|workflow|automation|organizing/.test(value)) return {
    objective: `Build a small ${title.toLowerCase()} workflow with a clear success and failure path.`,
    principle: "Make inputs, state changes, and acceptance criteria visible.",
    framework: [["Trigger","What starts the flow"],["Input","Required information"],["Steps","The smallest sequence"],["Failure","How errors recover"],["Done","The acceptance check"]],
    weakInstruction: `Build a ${title.toLowerCase()} workflow for me.`,
    strongInstruction: `Design a workflow triggered by [EVENT], using [INPUTS], with numbered steps, owner at each handoff, recovery for missing data, and a final pass condition.`,
    explanation: "The stronger version defines behaviour, ownership, recovery, and completion.",
    practice: "Run the workflow once with missing input and improve the recovery instruction.",
  };
  if (/marketing|brand|offer|productivity|task|sales/.test(value)) return {
    objective: `Apply ${title.toLowerCase()} to one measurable business or productivity outcome.`,
    principle: "Tie every output to a user, constraint, and metric.",
    framework: [["User","Who benefits"],["Problem","What blocks them"],["Offer","The proposed value"],["Boundary","Cost, time, or channel"],["Metric","What improvement means"]],
    weakInstruction: `Give me ideas for ${title.toLowerCase()}.`,
    strongInstruction: `For [USER] facing [PROBLEM], propose three options within [BOUNDARY]. Rank them by expected [METRIC], effort, risk, and fastest test.`,
    explanation: "The result becomes prioritised and testable instead of a loose idea list.",
    practice: "Choose the most reversible option and write the smallest test that could disprove it.",
  };
  return {
    objective: `Use ${title.toLowerCase()} in ${courseTitle} to move from an intention to a verifiable result.`,
    principle: "Start with the result, then add only context that changes the answer.",
    framework: commonFramework,
    weakInstruction: `Help me with ${title.toLowerCase()}.`,
    strongInstruction: `For [CONTEXT], produce one specific ${title.toLowerCase()} result, follow [CONSTRAINTS], show supporting evidence, and finish with a checklist I can verify.`,
    explanation: "The result, constraints, evidence, and review method are explicit.",
    practice: `Use ${title.toLowerCase()} on one real task, then record the first change that materially improved the result.`,
  };
}
