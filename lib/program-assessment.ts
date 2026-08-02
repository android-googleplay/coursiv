export const programAssessmentQuestions = [
  { question:"What should a strong AI instruction define first?", answers:["The newest model","The desired outcome","A long role description"], correct:1 },
  { question:"What is the safest response to an unsupported claim?", answers:["Repeat it confidently","Remove all detail","Ask for evidence and mark uncertainty"], correct:2 },
  { question:"Which workflow is easiest to improve?", answers:["One with a clear input, owner, and quality check","One with the most tools","One with no human review"], correct:0 },
  { question:"When should an AI output be accepted?", answers:["When it sounds polished","When it passes defined checks","When it is produced quickly"], correct:1 },
  { question:"What makes learning transferable?", answers:["Memorising one interface","Saving a repeatable method and reviewing results","Using only one AI tool"], correct:1 },
] as const;

export function gradeProgramAssessment(answers: number[]) {
  if (answers.length !== programAssessmentQuestions.length || answers.some((answer) => !Number.isInteger(answer) || answer < 0 || answer > 2)) return null;
  const correct = answers.filter((answer, index) => answer === programAssessmentQuestions[index].correct).length;
  const score = Math.round((correct / programAssessmentQuestions.length) * 100);
  return { score, passed: score >= 70 };
}
